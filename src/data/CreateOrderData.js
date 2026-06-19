import { DELIVERY_TYPE } from '../enums/DeliveryType.js';

/**
 * Unified order-creation payload.
 *
 * All adapters receive this object and map its fields to their provider-specific
 * API shape. The caller never has to remember which field names each provider uses.
 */
export class CreateOrderData {
  /**
   * @param {object} params
   * @param {string} params.orderId - Your internal order/reference ID
   * @param {string} params.firstName - Recipient's first name
   * @param {string} params.lastName - Recipient's last name / family name
   * @param {string} params.phone - Primary contact phone (Algerian: 05/06/07XXXXXXXX)
   * @param {string} params.address - Full delivery address string
   * @param {number|string} params.toWilayaId - Destination wilaya ID (1-58)
   * @param {string} params.toCommune - Destination commune / city name
   * @param {string} params.productDescription - Description of the product(s)
   * @param {number} params.price - Cash-on-delivery amount in DZD (0 = free/prepaid)
   * @param {number} [params.deliveryType] - DELIVERY_TYPE.HOME or DELIVERY_TYPE.STOP_DESK
   * @param {boolean} [params.freeShipping] - Whether the delivery fee is waived
   * @param {boolean} [params.hasExchange] - Whether this parcel has an exchange/return product
   * @param {string|null} [params.exchangeProduct] - Product to collect in exchange
   * @param {number|null} [params.stopDeskId] - Stop-desk ID when deliveryType = STOP_DESK
   * @param {number|string|null} [params.fromWilayaId] - Origin wilaya ID
   * @param {string|null} [params.phoneAlt] - Secondary contact phone number
   * @param {string|null} [params.notes] - Additional notes or delivery instructions
   * @param {number|null} [params.weight] - Parcel weight in kilograms
   * @param {number|null} [params.length] - Parcel length in centimetres
   * @param {number|null} [params.width] - Parcel width in centimetres
   * @param {number|null} [params.height] - Parcel height in centimetres
   * @param {number|null} [params.quantity] - Total number of items
   */
  constructor({
    orderId,
    firstName,
    lastName,
    phone,
    address,
    toWilayaId,
    toCommune,
    productDescription,
    price,
    deliveryType = DELIVERY_TYPE.HOME,
    freeShipping = false,
    hasExchange = false,
    exchangeProduct = null,
    stopDeskId = null,
    fromWilayaId = null,
    phoneAlt = null,
    notes = null,
    weight = null,
    length = null,
    width = null,
    height = null,
    quantity = null,
  }) {
    this.orderId = orderId;
    this.firstName = firstName;
    this.lastName = lastName;
    this.phone = phone;
    this.address = address;
    this.toWilayaId = toWilayaId;
    this.toCommune = toCommune;
    this.productDescription = productDescription;
    this.price = price;
    this.deliveryType = deliveryType;
    this.freeShipping = freeShipping;
    this.hasExchange = hasExchange;
    this.exchangeProduct = exchangeProduct;
    this.stopDeskId = stopDeskId;
    this.fromWilayaId = fromWilayaId;
    this.phoneAlt = phoneAlt;
    this.notes = notes;
    this.weight = weight;
    this.length = length;
    this.width = width;
    this.height = height;
    this.quantity = quantity;
  }

  /**
   * Create from a plain object (useful when accepting raw request body).
   * Accepts both camelCase and snake_case keys.
   *
   * @param {object} data
   * @returns {CreateOrderData}
   */
  static fromObject(data) {
    const deliveryTypeRaw = data.delivery_type ?? data.deliveryType;
    const isStopdesk = data.is_stopdesk ?? data.isStopdesk ?? false;
    const deliveryType = deliveryTypeRaw != null
      ? Number(deliveryTypeRaw)
      : (isStopdesk ? DELIVERY_TYPE.STOP_DESK : DELIVERY_TYPE.HOME);

    return new CreateOrderData({
      orderId: String(data.order_id ?? data.orderId ?? ''),
      firstName: String(data.first_name ?? data.firstName ?? ''),
      lastName: String(data.last_name ?? data.lastName ?? ''),
      phone: String(data.phone ?? data.contact_phone ?? ''),
      address: String(data.address ?? ''),
      toWilayaId: Number(data.to_wilaya_id ?? data.toWilayaId ?? 0),
      toCommune: String(data.to_commune ?? data.toCommune ?? data.to_commune_name ?? ''),
      productDescription: String(data.product_description ?? data.product_list ?? ''),
      price: Number(data.price ?? 0),
      deliveryType,
      freeShipping: Boolean(data.free_shipping ?? data.freeShipping ?? data.freeshipping ?? false),
      hasExchange: Boolean(data.has_exchange ?? data.hasExchange ?? false),
      exchangeProduct: data.exchange_product != null
        ? String(data.exchange_product)
        : (data.product_to_collect != null ? String(data.product_to_collect) : null),
      stopDeskId: data.stop_desk_id != null
        ? Number(data.stop_desk_id)
        : (data.stopdesk_id != null ? Number(data.stopdesk_id) : null),
      fromWilayaId: data.from_wilaya_id != null
        ? Number(data.from_wilaya_id)
        : (data.fromWilayaId != null ? Number(data.fromWilayaId) : null),
      phoneAlt: data.phone_alt != null ? String(data.phone_alt) : null,
      notes: data.notes != null ? String(data.notes) : null,
      weight: data.weight != null ? Number(data.weight) : null,
      length: data.length != null ? Number(data.length) : null,
      width: data.width != null ? Number(data.width) : null,
      height: data.height != null ? Number(data.height) : null,
      quantity: data.quantity != null
        ? Number(data.quantity)
        : (data.quantity_items != null ? Number(data.quantity_items) : null),
    });
  }

  /** Dump to a plain snake_case object */
  toJSON() {
    return {
      order_id: this.orderId,
      first_name: this.firstName,
      last_name: this.lastName,
      phone: this.phone,
      address: this.address,
      to_wilaya_id: this.toWilayaId,
      to_commune: this.toCommune,
      product_description: this.productDescription,
      price: this.price,
      delivery_type: this.deliveryType,
      free_shipping: this.freeShipping,
      has_exchange: this.hasExchange,
      exchange_product: this.exchangeProduct,
      stop_desk_id: this.stopDeskId,
      from_wilaya_id: this.fromWilayaId,
      phone_alt: this.phoneAlt,
      notes: this.notes,
      weight: this.weight,
      length: this.length,
      width: this.width,
      height: this.height,
      quantity: this.quantity,
    };
  }
}
