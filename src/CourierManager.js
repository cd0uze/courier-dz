import { PROVIDERS, isYalidineEngine, isEcotrackEngine, getProviderMetadata, getAllProvidersMetadata } from './enums/Provider.js';
import { EcotrackAdapter } from './adapters/EcotrackAdapter.js';
import { YalidineAdapter } from './adapters/YalidineAdapter.js';
import { MaystroAdapter } from './adapters/MaystroAdapter.js';
import { ProcolisAdapter } from './adapters/ProcolisAdapter.js';
import { ZimouAdapter } from './adapters/ZimouAdapter.js';
import { ZrExpressNewAdapter } from './adapters/ZrExpressNewAdapter.js';
import { TokenCredentials } from './data/credentials/TokenCredentials.js';
import { YalidineCredentials } from './data/credentials/YalidineCredentials.js';
import { ProcolisCredentials } from './data/credentials/ProcolisCredentials.js';
import { ZrExpressNewCredentials } from './data/credentials/ZrExpressNewCredentials.js';
import { InvalidCredentialsError } from './exceptions/InvalidCredentialsError.js';

/**
 * CourierManager — the main entry point for courier-dz.
 *
 * Resolves the correct adapter for a given provider, hydrates credentials
 * from config or runtime values, and caches adapter instances for re-use.
 *
 * All 30 Algerian courier providers are supported. Ecotrack-engine sub-providers
 * (DHD, Conexlog, Anderson, Swift, AlloLivraison, etc.) reuse EcotrackAdapter
 * with provider-specific base URLs.
 *
 * @example
 * import { CourierManager, PROVIDERS } from 'courier-dz';
 *
 * const courier = new CourierManager({
 *   providers: {
 *     yalidine: { token: 'YOUR_API_ID', key: 'YOUR_API_KEY' },
 *     maystro:  { token: 'YOUR_TOKEN' },
 *     dhd:      { token: 'YOUR_DHD_TOKEN' },
 *   },
 * });
 *
 * const adapter = courier.provider(PROVIDERS.YALIDINE);
 * const order = await adapter.createOrder(orderData);
 */
export class CourierManager {
  /**
   * @param {object} config - Configuration object
   * @param {Record<string, object>} [config.providers] - Credentials keyed by provider ID
   */
  constructor(config = {}) {
    this.config = config;
    /** @type {Map<string, object>} Cached adapter instances */
    this._resolved = new Map();
    /** @type {Map<string, Function>} Custom adapter factories */
    this._customDrivers = new Map();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Resolve an adapter by provider ID.
   *
   * @param {string} providerKey - Provider ID (use PROVIDERS constant)
   * @param {object|null} [credentials] - Runtime credentials (overrides config)
   * @returns {import('./adapters/AbstractAdapter.js').AbstractAdapter}
   */
  provider(providerKey, credentials = null) {
    const cacheKey = credentials
      ? `${providerKey}:${JSON.stringify(credentials)}`
      : providerKey;

    if (this._resolved.has(cacheKey)) {
      return this._resolved.get(cacheKey);
    }

    if (this._customDrivers.has(providerKey)) {
      const adapter = this._customDrivers.get(providerKey)(credentials);
      this._resolved.set(cacheKey, adapter);
      return adapter;
    }

    const adapter = this._make(providerKey, credentials);
    this._resolved.set(cacheKey, adapter);
    return adapter;
  }

  /**
   * Alias for provider() — resolve by string provider ID.
   *
   * @param {string} providerKey
   * @param {object|null} [credentials]
   * @returns {import('./adapters/AbstractAdapter.js').AbstractAdapter}
   */
  via(providerKey, credentials = null) {
    return this.provider(providerKey, credentials);
  }

  /**
   * Get static metadata for a provider without instantiating an adapter.
   * Useful for building provider-selection UIs.
   *
   * @param {string} providerKey
   * @returns {object} Provider metadata
   */
  metadataFor(providerKey) {
    return getProviderMetadata(providerKey);
  }

  /**
   * Get metadata for all providers.
   *
   * @returns {Record<string, object>} All provider metadata keyed by provider ID
   */
  allMetadata() {
    return getAllProvidersMetadata();
  }

  /**
   * Register a custom adapter factory for a given provider.
   * Useful for testing or extending with a custom implementation.
   *
   * @param {string} providerKey - Provider ID
   * @param {function(object|null): object} factory - Factory function
   * @returns {CourierManager} For chaining
   *
   * @example
   * courier.extend(PROVIDERS.DHD, (creds) => new MyCustomDhdAdapter(creds));
   */
  extend(providerKey, factory) {
    this._customDrivers.set(providerKey, factory);
    this._resolved.delete(providerKey);
    return this;
  }

  /**
   * Flush the resolved adapter cache.
   * Useful in tests or when credentials change at runtime.
   *
   * @returns {CourierManager} For chaining
   */
  flushResolved() {
    this._resolved.clear();
    return this;
  }

  // ─── Internal factory ─────────────────────────────────────────────────────

  _make(providerKey, runtimeCredentials) {
    const creds = runtimeCredentials ?? this._credentialsFromConfig(providerKey);

    // ── Yalidine engine (Yalidine + Yalitec) ──────────────────────────────
    if (isYalidineEngine(providerKey)) {
      return new YalidineAdapter({
        credentials: this._buildYalidineCredentials(providerKey, creds),
        provider: providerKey,
      });
    }

    // ── Maystro ───────────────────────────────────────────────────────────
    if (providerKey === PROVIDERS.MAYSTRO) {
      return new MaystroAdapter({
        credentials: this._buildTokenCredentials(providerKey, creds),
      });
    }

    // ── Procolis engine (Procolis + ZR Express legacy) ────────────────────
    if (providerKey === PROVIDERS.PROCOLIS || providerKey === PROVIDERS.ZREXPRESS) {
      return new ProcolisAdapter({
        credentials: this._buildProcolisCredentials(providerKey, creds),
        provider: providerKey,
      });
    }

    // ── Zimou Express ─────────────────────────────────────────────────────
    if (providerKey === PROVIDERS.ZIMOU) {
      return new ZimouAdapter({
        credentials: this._buildTokenCredentials(providerKey, creds),
      });
    }

    // ── ZR Express NEW ────────────────────────────────────────────────────
    if (providerKey === PROVIDERS.ZREXPRESS_NEW) {
      return new ZrExpressNewAdapter({
        credentials: this._buildZrExpressNewCredentials(providerKey, creds),
      });
    }

    // ── Ecotrack engine (generic base + all sub-providers) ────────────────
    if (isEcotrackEngine(providerKey)) {
      return new EcotrackAdapter({
        credentials: this._buildTokenCredentials(providerKey, creds),
        provider: providerKey,
      });
    }

    throw new Error(`No adapter factory defined for provider "${providerKey}".`);
  }

  // ─── Config helpers ───────────────────────────────────────────────────────

  _credentialsFromConfig(providerKey) {
    const providerConfig =
      this.config?.providers?.[providerKey] ??
      this.config?.[providerKey] ??
      null;

    if (!providerConfig || typeof providerConfig !== 'object') {
      throw new InvalidCredentialsError(
        providerKey,
        `No configuration found under providers.${providerKey}.`,
      );
    }

    return providerConfig;
  }

  // ─── Credential builders ──────────────────────────────────────────────────

  _buildYalidineCredentials(providerKey, creds) {
    try {
      return YalidineCredentials.fromObject(creds);
    } catch (err) {
      throw new InvalidCredentialsError(providerKey, err.message, err);
    }
  }

  _buildTokenCredentials(providerKey, creds) {
    try {
      return TokenCredentials.fromObject(creds);
    } catch (err) {
      throw new InvalidCredentialsError(providerKey, err.message, err);
    }
  }

  _buildProcolisCredentials(providerKey, creds) {
    try {
      return ProcolisCredentials.fromObject(creds);
    } catch (err) {
      throw new InvalidCredentialsError(providerKey, err.message, err);
    }
  }

  _buildZrExpressNewCredentials(providerKey, creds) {
    try {
      return ZrExpressNewCredentials.fromObject(creds);
    } catch (err) {
      throw new InvalidCredentialsError(providerKey, err.message, err);
    }
  }
}
