/** Procolis / ZR Express (legacy) credentials: token + key pair */
export class ProcolisCredentials {
  /**
   * @param {object} params
   * @param {string} params.token - Your Procolis token
   * @param {string} params.key - Your Procolis API key
   */
  constructor({ token, key }) {
    if (!token) throw new Error('ProcolisCredentials require a "token".');
    if (!key) throw new Error('ProcolisCredentials require a "key".');
    this.token = token;
    this.key = key;
  }

  /**
   * Accepts both { token, key } and legacy { id, token } objects.
   * @param {object} data
   * @returns {ProcolisCredentials}
   */
  static fromObject(data) {
    const token = data.token ?? data.id
      ?? (() => { throw new Error('Procolis credentials require a "token".'); })();
    const key = data.key ?? data.id
      ?? (() => { throw new Error('Procolis credentials require a "key".'); })();
    return new ProcolisCredentials({ token, key });
  }
}
