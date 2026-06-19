/** Single-token credentials used by Maystro and Ecotrack providers */
export class TokenCredentials {
  /** @param {object} params @param {string} params.token */
  constructor({ token }) {
    if (!token) throw new Error('TokenCredentials require a "token".');
    this.token = token;
  }

  /** @param {object} data @returns {TokenCredentials} */
  static fromObject(data) {
    return new TokenCredentials({
      token: data.token ?? (() => { throw new Error('Credentials require a "token".'); })(),
    });
  }
}
