/**
 * Credentials for Noest Express (app.noest-dz.com, /api/public).
 *
 * Two values are needed:
 *   token     : Bearer API token — sent as `Authorization: Bearer {token}` on
 *               EVERY request (read and write).
 *   guid      : account user GUID — sent in the JSON body as `user_guid` on
 *               WRITE/ACTION calls only (create, valid, delete, update, …).
 *
 * Confirmed live during the Phase 0/1 audit: read endpoints
 * (get/wilayas, get/communes, fees, desks) work with the Bearer token alone;
 * create/order and delete/order return HTTP 422
 * ("Le champ user guid est obligatoire.") when `user_guid` is omitted.
 */
export class NoestCredentials {
  /**
   * @param {object} params
   * @param {string} params.token - Bearer API token (Authorization header)
   * @param {string} params.guid - Account user GUID (sent as user_guid on writes)
   */
  constructor({ token, guid }) {
    if (!token) throw new Error('NoestCredentials require a "token".');
    if (!guid) throw new Error('NoestCredentials require a "guid".');
    this.token = token;
    this.guid = guid;
  }

  /** @param {object} data @returns {NoestCredentials} */
  static fromObject(data) {
    return new NoestCredentials({
      token: data.token ?? data.api_token ?? data.apiToken
        ?? (() => { throw new Error('Noest credentials require a "token" (api_token).'); })(),
      guid: data.guid ?? data.user_guid ?? data.userGuid
        ?? (() => { throw new Error('Noest credentials require a "guid" (user_guid).'); })(),
    });
  }
}
