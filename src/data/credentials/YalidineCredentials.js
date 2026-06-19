/** Yalidine credentials: API ID (token) + API KEY */
export class YalidineCredentials {
  /**
   * @param {object} params
   * @param {string} params.token - Your API ID (X-API-ID header)
   * @param {string} params.apiKey - Your API Token (X-API-TOKEN header)
   */
  constructor({ token, apiKey }) {
    if (!token) throw new Error('YalidineCredentials require a "token" (API ID).');
    if (!apiKey) throw new Error('YalidineCredentials require an "apiKey" (API Token).');
    this.token = token;
    this.apiKey = apiKey;
  }

  /**
   * @param {object} data
   * @param {string} data.token - API ID
   * @param {string} data.key - API Token
   * @returns {YalidineCredentials}
   */
  static fromObject(data) {
    return new YalidineCredentials({
      token: data.token ?? (() => { throw new Error('Yalidine credentials require a "token".'); })(),
      apiKey: data.key ?? data.apiKey ?? (() => { throw new Error('Yalidine credentials require a "key".'); })(),
    });
  }
}
