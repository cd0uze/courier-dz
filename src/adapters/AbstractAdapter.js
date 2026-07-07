import axios from 'axios';
import { CourierError } from '../exceptions/CourierError.js';
import { AuthenticationError } from '../exceptions/AuthenticationError.js';
import { UnsupportedOperationError } from '../exceptions/UnsupportedOperationError.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { getProviderMetadata } from '../enums/Provider.js';

/**
 * Abstract base for all courier adapters.
 *
 * Provides:
 *  - A pre-configured axios HTTP client.
 *  - Shared helpers: get(), post(), put(), delete(), postForm(), requestRaw().
 *  - Uniform HTTP error → exception translation.
 *  - Built-in PER-PROVIDER rate limiting: a sliding-window limiter enforcing
 *    each provider's documented quota(s) preventively (e.g. Yalidine 5/s + 50/min),
 *    plus automatic retry on HTTP 429 as a curative safety net.
 *  - Default metadata() delegating to the Provider enum.
 *  - Default "unsupported" stubs for optional operations.
 */

/**
 * Default rate limit when a provider's docs specify none.
 * Mission "règle d'or": absent a documented limit, apply a 50 req/min floor.
 * @type {Array<{max:number, windowMs:number}>}
 */
const DEFAULT_RATE_LIMITS = [{ max: 50, windowMs: 60_000 }];

/** Max retries on 429 before giving up */
const MAX_429_RETRIES = 3;

export class AbstractAdapter {
  /**
   * @param {object} params
   * @param {string} params.baseUrl - Base URL for the API
   * @param {object} [params.defaultHeaders] - Default headers to merge on every request
   * @param {number} [params.timeoutMs] - Request timeout in milliseconds (default: 30000)
   * @param {Array<{max:number, windowMs:number}>} [params.rateLimits] - Documented quota window(s)
   *   for this provider. Defaults to a 50 req/min floor when omitted.
   * @param {number} [params.minRequestGap] - Optional minimum ms between consecutive requests,
   *   layered on top of the windows (used to smooth bursts). Default: 0.
   * @param {import('axios').AxiosInstance|null} [params.httpClient] - Injectable for testing
   */
  constructor({
    baseUrl,
    defaultHeaders = {},
    timeoutMs = 30_000,
    rateLimits = DEFAULT_RATE_LIMITS,
    minRequestGap = 0,
    httpClient = null,
  }) {
    this.baseUrl = baseUrl.replace(/\/$/, '') + '/';
    this.defaultHeaders = defaultHeaders;
    this.timeoutMs = timeoutMs;
    this.minRequestGap = minRequestGap;

    /**
     * Documented quota window(s) for this provider, enforced preventively.
     * @type {Array<{max:number, windowMs:number}>}
     */
    this.rateLimits = Array.isArray(rateLimits) && rateLimits.length > 0
      ? rateLimits
      : DEFAULT_RATE_LIMITS;

    /** @type {string} Set by each concrete adapter */
    this.providerEnum = null;

    /** @type {number[]} Timestamps (ms) of requests sent inside the largest window */
    this._requestTimestamps = [];

    this.http = httpClient ?? axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
      },
    });
  }

  // ─── Identity ─────────────────────────────────────────────────────────────

  /** Returns the provider ID string for this adapter */
  provider() {
    return this.providerEnum;
  }

  /** Returns static metadata for this provider without hitting any API */
  metadata() {
    return getProviderMetadata(this.providerEnum);
  }

  // ─── Optional operation stubs ─────────────────────────────────────────────

  async getRates(_fromWilayaId = null, _toWilayaId = null) {
    throw new UnsupportedOperationError('getRates', this.providerEnum);
  }

  async cancelOrder(_trackingNumber) {
    throw new UnsupportedOperationError('cancelOrder', this.providerEnum);
  }

  // ─── Default status normalizer ────────────────────────────────────────────

  normalizeStatus(_rawStatus) {
    return TRACKING_STATUS.UNKNOWN;
  }

  // ─── HTTP helpers ─────────────────────────────────────────────────────────

  /**
   * @param {string} path
   * @param {object} [params] - Query params
   * @param {object} [headers] - Extra headers
   * @returns {Promise<object>}
   */
  async get(path, params = {}, headers = {}) {
    return this._request('GET', path, { params, headers });
  }

  /**
   * @param {string} path
   * @param {object} [payload] - JSON body
   * @param {object} [headers] - Extra headers
   * @returns {Promise<object>}
   */
  async post(path, payload = {}, headers = {}) {
    return this._request('POST', path, { data: payload, headers });
  }

  /**
   * @param {string} path
   * @param {object} [payload] - URL-encoded form data
   * @param {object} [headers] - Extra headers
   * @returns {Promise<object>}
   */
  async postForm(path, payload = {}, headers = {}) {
    const params = new URLSearchParams(payload).toString();
    return this._request('POST', path, {
      data: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    });
  }

  /**
   * @param {string} path
   * @param {object} [payload] - JSON body
   * @param {object} [headers] - Extra headers
   * @returns {Promise<object>}
   */
  async put(path, payload = {}, headers = {}) {
    return this._request('PUT', path, { data: payload, headers });
  }

  /**
   * @param {string} path
   * @param {object} [payload] - JSON body
   * @param {object} [headers] - Extra headers
   * @returns {Promise<object>}
   */
  async patch(path, payload = {}, headers = {}) {
    return this._request('PATCH', path, { data: payload, headers });
  }

  /**
   * @param {string} path
   * @param {object} [headers] - Extra headers
   * @param {object|null} [payload] - Optional JSON body (some APIs accept a body on DELETE)
   * @returns {Promise<object>}
   */
  async delete(path, headers = {}, payload = null) {
    const opts = { headers };
    if (payload != null) opts.data = payload;
    return this._request('DELETE', path, opts);
  }

  /**
   * Preventive per-provider rate limiter (sliding window).
   *
   * Blocks until sending one more request keeps every configured window under
   * its documented quota, then records the send timestamp. Layered on top, an
   * optional minRequestGap smooths consecutive calls.
   * @returns {Promise<void>}
   */
  async _throttle() {
    const maxWindow = Math.max(...this.rateLimits.map((l) => l.windowMs));

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const now = Date.now();
      this._requestTimestamps = this._requestTimestamps.filter((t) => now - t < maxWindow);

      let waitMs = 0;

      for (const { max, windowMs } of this.rateLimits) {
        const inWindow = this._requestTimestamps.filter((t) => now - t < windowMs);
        if (inWindow.length >= max) {
          const oldest = Math.min(...inWindow);
          waitMs = Math.max(waitMs, windowMs - (now - oldest) + 1);
        }
      }

      if (this.minRequestGap > 0 && this._requestTimestamps.length > 0) {
        const last = Math.max(...this._requestTimestamps);
        waitMs = Math.max(waitMs, this.minRequestGap - (now - last));
      }

      if (waitMs <= 0) break;
      await new Promise((r) => setTimeout(r, waitMs));
    }

    this._requestTimestamps.push(Date.now());
  }

  /**
   * Compute how long to wait before retrying a 429, robustly.
   *
   * Honors a numeric `Retry-After` header (seconds) when present and valid, but
   * always enforces an exponential backoff floor (2s, 4s, 8s…) so a missing,
   * zero, or malformed header can never produce a 0 ms / negative wait that
   * would hammer the API. Capped at 60s.
   *
   * @param {object} response - axios response
   * @param {number} attempt - zero-based retry attempt
   * @returns {number} milliseconds to wait
   */
  _retryDelayMs(response, attempt) {
    let retryAfter = parseInt(response?.headers?.['retry-after'] ?? '', 10);
    if (!Number.isFinite(retryAfter) || retryAfter < 0) retryAfter = 0;
    const serverMs = retryAfter * 1000;
    const backoffMs = Math.min(2000 * Math.pow(2, attempt), 30_000); // 2s,4s,8s,16s…≤30s
    return Math.min(Math.max(serverMs, backoffMs), 60_000);
  }

  /**
   * Fetch raw response bytes (used for binary PDF responses).
   * @param {string} method
   * @param {string} path
   * @param {object} [options]
   * @returns {Promise<Buffer>}
   */
  async requestRaw(method, path, options = {}) {
    for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
      await this._throttle();

      try {
        const response = await this.http.request({
          method,
          url: path.replace(/^\//, ''),
          responseType: 'arraybuffer',
          ...options,
          headers: { ...this.defaultHeaders, ...(options.headers ?? {}) },
        });

        const status = response.status;

        if (status === 429) {
          const waitMs = this._retryDelayMs(response, attempt);
          console.warn(
            `[RateLimit] ${this.providerEnum} 429 — retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_429_RETRIES + 1})`
          );
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        if (status === 401 || status === 403) {
          throw new AuthenticationError(
            `Authentication failed for ${this.providerEnum} (HTTP ${status}).`,
            status,
          );
        }
        if (status >= 400) {
          throw new CourierError(
            `${this.providerEnum} API returned HTTP ${status}.`,
            status,
          );
        }

        return Buffer.from(response.data);
      } catch (err) {
        if (err instanceof CourierError) throw err;
        if (attempt < MAX_429_RETRIES) {
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 10_000);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw new CourierError(
          `Error communicating with ${this.providerEnum}: ${err.message}`,
          0,
          err,
        );
      }
    }
  }

  // ─── Raw request + error translation ─────────────────────────────────────

  /**
   * @param {string} method
   * @param {string} path
   * @param {object} [options] - Axios request options
   * @returns {Promise<object>}
   */
  async _request(method, path, options = {}) {
    const { headers: extraHeaders = {}, ...rest } = options;

    for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
      // ── Preventive per-provider rate-limiting gate ───────────────────────
      await this._throttle();

      try {
        const response = await this.http.request({
          method,
          url: path.replace(/^\//, ''),
          headers: extraHeaders,
          validateStatus: () => true,
          ...rest,
        });

        const status = response.status;
        const body = response.data;

        // ── 429 Too Many Requests → wait & retry ──────────────────────────
        if (status === 429) {
          const waitMs = this._retryDelayMs(response, attempt);
          console.warn(
            `[RateLimit] ${this.providerEnum} 429 — retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_429_RETRIES + 1})`
          );
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        if (status === 401 || status === 403) {
          throw new AuthenticationError(
            `Authentication failed for ${this.providerEnum} (HTTP ${status}).`,
            status,
          );
        }

        if (status >= 400) {
          const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
          throw new CourierError(
            `${this.providerEnum} API returned HTTP ${status}: ${bodyText}`,
            status,
          );
        }

        if (body === '' || body === null || body === undefined) {
          return {};
        }

        if (typeof body === 'string') {
          if (body.trim() === '' || body.trim() === 'null') return {};
          try {
            const parsed = JSON.parse(body);
            return typeof parsed === 'object' && parsed !== null ? parsed : { data: parsed };
          } catch {
            return {};
          }
        }

        return typeof body === 'object' ? body : { data: body };
      } catch (err) {
        if (err instanceof CourierError) throw err;
        // Network error — retry with backoff if attempts remain
        if (attempt < MAX_429_RETRIES) {
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 10_000);
          console.warn(
            `[Retry] ${this.providerEnum} network error — retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_429_RETRIES + 1}): ${err.message}`
          );
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw new CourierError(
          `Error communicating with ${this.providerEnum}: ${err.message}`,
          0,
          err,
        );
      }
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  /**
   * Safe nested object key access.
   * @param {object} data
   * @param {...string} keys
   * @returns {*}
   */
  dig(data, ...keys) {
    let current = data;
    for (const key of keys) {
      if (current == null || typeof current !== 'object' || !(key in current)) {
        return null;
      }
      current = current[key];
    }
    return current;
  }

  /**
   * Parse a date string or return null.
   * @param {string|null|undefined} value
   * @returns {Date|null}
   */
  parseDate(value) {
    if (value == null || value === '') return null;
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
}
