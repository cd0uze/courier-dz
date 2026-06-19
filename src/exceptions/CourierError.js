/** Base error class for all courier-dz errors */
export class CourierError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode]
   * @param {Error|null} [cause]
   */
  constructor(message, statusCode = 0, cause = null) {
    super(message);
    this.name = 'CourierError';
    this.statusCode = statusCode;
    if (cause) this.cause = cause;
  }
}
