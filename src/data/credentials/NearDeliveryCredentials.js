/**
 * Credentials for Near Delivery — two headers: ApiKey + ApiSecret.
 */
export class NearDeliveryCredentials {
  /**
   * @param {object} params
   * @param {string} params.key - API key (sent as the ApiKey header)
   * @param {string} params.secret - API secret (sent as the ApiSecret header)
   */
  constructor({ key, secret }) {
    this.key = key;
    this.secret = secret;
  }

  /**
   * Accepts { key, secret } plus the aliases api_key/apiKey and api_secret/apiSecret.
   * @param {object} data
   * @returns {NearDeliveryCredentials}
   */
  static fromObject(data) {
    const key = data?.key ?? data?.api_key ?? data?.apiKey;
    const secret = data?.secret ?? data?.api_secret ?? data?.apiSecret;
    if (typeof key !== 'string' || key.trim() === '') {
      throw new Error('Near Delivery credentials require a non-empty "key" (api_key).');
    }
    if (typeof secret !== 'string' || secret.trim() === '') {
      throw new Error('Near Delivery credentials require a non-empty "secret" (api_secret).');
    }
    return new NearDeliveryCredentials({ key: key.trim(), secret: secret.trim() });
  }
}
