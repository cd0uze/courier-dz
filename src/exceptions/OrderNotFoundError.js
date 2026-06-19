import { CourierError } from './CourierError.js';

/** Thrown when an order / parcel is not found at the provider */
export class OrderNotFoundError extends CourierError {
  /**
   * @param {string} trackingNumber
   * @param {Error|null} [cause]
   */
  constructor(trackingNumber, cause = null) {
    super(`Order not found: "${trackingNumber}".`, 404, cause);
    this.name = 'OrderNotFoundError';
    this.trackingNumber = trackingNumber;
  }
}
