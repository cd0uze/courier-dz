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
 *  - Default metadata() delegating to the Provider enum.
 *  - Default "unsupported" stubs for optional operations.
 */
export class AbstractAdapter {
  /**
   * @param {object} params
   * @param {string} params.baseUrl - Base URL for the API
   * @param {object} [params.defaultHeaders] - Default headers to merge on every request
   * @param {number} [params.timeoutMs] - Request timeout in milliseconds (default: 30000)
   * @param {import('axios').AxiosInstance|null} [params.httpClient] - Injectable for testing
   */
  constructor({ baseUrl, defaultHeaders = {}, timeoutMs = 30_000, httpClient = null }) {
    this.baseUrl = baseUrl.replace(/\/$/, '') + '/';
    this.defaultHeaders = defaultHeaders;
    this.timeoutMs = timeoutMs;

    /** @type {string} Set by each concrete adapter */
    this.providerEnum = null;

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
   * @param {object} [headers] - Extra headers
   * @returns {Promise<object>}
   */
  async delete(path, headers = {}) {
    return this._request('DELETE', path, { headers });
  }

  /**
   * Fetch raw response bytes (used for binary PDF responses).
   * @param {string} method
   * @param {string} path
   * @param {object} [options]
   * @returns {Promise<Buffer>}
   */
  async requestRaw(method, path, options = {}) {
    try {
      const response = await this.http.request({
        method,
        url: path.replace(/^\//, ''),
        responseType: 'arraybuffer',
        ...options,
        headers: { ...this.defaultHeaders, ...(options.headers ?? {}) },
      });

      const status = response.status;
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
      throw new CourierError(
        `Error communicating with ${this.providerEnum}: ${err.message}`,
        0,
        err,
      );
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

    try {
      const response = await this.http.request({
        method,
        url: path.replace(/^\//, ''),
        headers: extraHeaders,
        validateStatus: () => true, // Never throw on HTTP status
        ...rest,
      });

      const status = response.status;
      const body = response.data;

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
      throw new CourierError(
        `Error communicating with ${this.providerEnum}: ${err.message}`,
        0,
        err,
      );
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
