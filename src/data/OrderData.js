import {
  TRACKING_STATUS,
  getStatusLabel,
  getStatusLabelFr,
  getStatusLabelAr,
  isTerminalStatus,
  isSuccessfulStatus,
} from '../enums/TrackingStatus.js';

/**
 * Unified order / shipment response.
 *
 * Regardless of the provider, getOrder() and createOrder() always return
 * this identical shape so application code remains provider-agnostic.
 */
export class OrderData {
  /**
   * @param {object} params
   * @param {string} params.orderId - Your internal order/reference ID
   * @param {string} params.trackingNumber - The provider's own tracking / parcel number
   * @param {string} params.provider - Provider ID (PROVIDERS constant)
   * @param {string} params.status - Canonical status (TRACKING_STATUS constant)
   * @param {string} params.recipientName - Recipient full name
   * @param {string} params.phone - Recipient phone
   * @param {string} params.address - Delivery address
   * @param {number} params.toWilayaId - Destination wilaya ID (1-58)
   * @param {string} params.toCommune - Destination commune name
   * @param {number} params.price - Cash-on-delivery amount in DZD
   * @param {number|null} [params.shippingFee] - Shipping fee in DZD (if known)
   * @param {string|null} [params.rawStatus] - Raw, untransformed status from the provider
   * @param {string|null} [params.notes] - Additional notes from the provider
   * @param {Date|string|null} [params.createdAt] - When the order was first created at the provider
   * @param {Date|string|null} [params.updatedAt] - When the record was last updated at the provider
   * @param {object} [params.raw] - Full raw API response payload for debugging
   */
  constructor({
    orderId,
    trackingNumber,
    provider,
    status,
    recipientName,
    phone,
    address,
    toWilayaId,
    toCommune,
    price,
    shippingFee = null,
    rawStatus = null,
    notes = null,
    createdAt = null,
    updatedAt = null,
    raw = {},
  }) {
    this.orderId = orderId;
    this.trackingNumber = trackingNumber;
    this.provider = provider;
    this.status = status ?? TRACKING_STATUS.UNKNOWN;
    this.recipientName = recipientName;
    this.phone = phone;
    this.address = address;
    this.toWilayaId = toWilayaId;
    this.toCommune = toCommune;
    this.price = price;
    this.shippingFee = shippingFee;
    this.rawStatus = rawStatus;
    this.notes = notes;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.raw = raw;
  }

  /** Human-readable English status label */
  label() {
    return getStatusLabel(this.status);
  }

  /** Human-readable French status label */
  labelFr() {
    return getStatusLabelFr(this.status);
  }

  /** Human-readable Arabic status label */
  labelAr() {
    return getStatusLabelAr(this.status);
  }

  /** Whether the parcel was successfully delivered */
  isDelivered() {
    return isSuccessfulStatus(this.status);
  }

  /** Whether this status is a final/terminal state */
  isTerminal() {
    return isTerminalStatus(this.status);
  }

  /** Serialize to a plain object */
  toJSON() {
    return {
      order_id: this.orderId,
      tracking_number: this.trackingNumber,
      provider: this.provider,
      status: this.status,
      status_label: this.label(),
      status_label_fr: this.labelFr(),
      status_label_ar: this.labelAr(),
      recipient_name: this.recipientName,
      phone: this.phone,
      address: this.address,
      to_wilaya_id: this.toWilayaId,
      to_commune: this.toCommune,
      price: this.price,
      shipping_fee: this.shippingFee,
      raw_status: this.rawStatus,
      notes: this.notes,
      created_at: this.createdAt instanceof Date
        ? this.createdAt.toISOString()
        : this.createdAt,
      updated_at: this.updatedAt instanceof Date
        ? this.updatedAt.toISOString()
        : this.updatedAt,
    };
  }
}
