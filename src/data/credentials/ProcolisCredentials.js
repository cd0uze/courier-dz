/** Procolis / ZR Express (legacy) credentials: id + token pair */
export class ProcolisCredentials {
  /**
   * @param {object} params
   * @param {string} params.id - Your Procolis account ID
   * @param {string} params.token - Your Procolis token
   */
  constructor({ id, token }) {
    if (!id) throw new Error('ProcolisCredentials require an "id".');
    if (!token) throw new Error('ProcolisCredentials require a "token".');
    this.id = id;
    this.token = token;
  }

  /** @param {object} data @returns {ProcolisCredentials} */
  static fromObject(data) {
    return new ProcolisCredentials({
      id: data.id ?? (() => { throw new Error('Procolis credentials require an "id".'); })(),
      token: data.token ?? (() => { throw new Error('Procolis credentials require a "token".'); })(),
    });
  }
}
