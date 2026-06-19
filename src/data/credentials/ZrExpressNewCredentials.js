/**
 * Credentials for the ZR Express NEW platform (api.zrexpress.app).
 *
 * Completely different from the legacy Procolis-based ZR Express credentials.
 * Both headers must be present on every request:
 *   X-Tenant  : your tenant UUID
 *   X-Api-Key : your API secret key
 */
export class ZrExpressNewCredentials {
  /**
   * @param {object} params
   * @param {string} params.tenantId - Tenant UUID sent as X-Tenant header
   * @param {string} params.apiKey - Secret API key sent as X-Api-Key header
   */
  constructor({ tenantId, apiKey }) {
    if (!tenantId) throw new Error('ZrExpressNewCredentials require a "tenantId".');
    if (!apiKey) throw new Error('ZrExpressNewCredentials require an "apiKey".');
    this.tenantId = tenantId;
    this.apiKey = apiKey;
  }

  /** @param {object} data @returns {ZrExpressNewCredentials} */
  static fromObject(data) {
    return new ZrExpressNewCredentials({
      tenantId: data.tenant_id ?? data.tenantId
        ?? (() => { throw new Error('ZR Express NEW credentials require "tenant_id".'); })(),
      apiKey: data.api_key ?? data.apiKey
        ?? (() => { throw new Error('ZR Express NEW credentials require "api_key".'); })(),
    });
  }
}
