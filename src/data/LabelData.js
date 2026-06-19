import { LABEL_TYPE } from '../enums/LabelType.js';
import { CourierError } from '../exceptions/CourierError.js';

/**
 * Unified shipping label response.
 *
 * Contains either a base64-encoded PDF blob or a URL — never both at the same time.
 * Check the `type` field to determine which property is populated.
 */
export class LabelData {
  /**
   * @param {object} params
   * @param {string} params.provider - Provider ID
   * @param {string} params.trackingNumber - Tracking number
   * @param {string} params.type - LABEL_TYPE value
   * @param {string|null} [params.base64] - Populated when type === LABEL_TYPE.PDF_BASE64
   * @param {string|null} [params.url] - Populated when type === LABEL_TYPE.PDF_URL or IMAGE_URL or HTML_URL
   */
  constructor({ provider, trackingNumber, type, base64 = null, url = null }) {
    this.provider = provider;
    this.trackingNumber = trackingNumber;
    this.type = type;
    this.base64 = base64;
    this.url = url;
  }

  /**
   * Build from a base64-encoded PDF blob.
   * @param {string} provider
   * @param {string} trackingNumber
   * @param {string} base64
   * @returns {LabelData}
   */
  static fromBase64(provider, trackingNumber, base64) {
    return new LabelData({
      provider,
      trackingNumber,
      type: LABEL_TYPE.PDF_BASE64,
      base64,
    });
  }

  /**
   * Build from a PDF / image / HTML URL.
   * @param {string} provider
   * @param {string} trackingNumber
   * @param {string} url
   * @param {string} [type]
   * @returns {LabelData}
   */
  static fromUrl(provider, trackingNumber, url, type = LABEL_TYPE.PDF_URL) {
    return new LabelData({ provider, trackingNumber, type, url });
  }

  /**
   * Decode the base64 blob to raw binary PDF bytes (Buffer in Node.js).
   * @returns {Buffer}
   * @throws {CourierError} if label is not of type PDF_BASE64
   */
  decodePdf() {
    if (this.type !== LABEL_TYPE.PDF_BASE64 || this.base64 == null) {
      throw new CourierError('Cannot decode PDF: label is not of type PDF_BASE64.');
    }
    return Buffer.from(this.base64, 'base64');
  }

  toJSON() {
    return {
      provider: this.provider,
      tracking_number: this.trackingNumber,
      type: this.type,
      base64: this.base64,
      url: this.url,
    };
  }
}
