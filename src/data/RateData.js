/**
 * Unified shipping rate entry.
 */
export class RateData {
  /**
   * @param {object} params
   * @param {string} params.provider - Provider ID
   * @param {number} params.toWilayaId - Destination wilaya ID
   * @param {string} params.toWilayaName - Destination wilaya name
   * @param {number} params.homeDeliveryPrice - Home delivery price in DZD
   * @param {number} params.stopDeskPrice - Stop-desk price in DZD
   * @param {number} params.deliveryType - DELIVERY_TYPE value
   * @param {number|null} [params.fromWilayaId] - Origin wilaya ID
   * @param {string|null} [params.fromWilayaName] - Origin wilaya name
   * @param {number|null} [params.estimatedDaysMin] - Minimum estimated delivery days
   * @param {number|null} [params.estimatedDaysMax] - Maximum estimated delivery days
   */
  constructor({
    provider,
    toWilayaId,
    toWilayaName,
    homeDeliveryPrice,
    stopDeskPrice,
    deliveryType,
    fromWilayaId = null,
    fromWilayaName = null,
    estimatedDaysMin = null,
    estimatedDaysMax = null,
  }) {
    this.provider = provider;
    this.toWilayaId = toWilayaId;
    this.toWilayaName = toWilayaName;
    this.homeDeliveryPrice = homeDeliveryPrice;
    this.stopDeskPrice = stopDeskPrice;
    this.deliveryType = deliveryType;
    this.fromWilayaId = fromWilayaId;
    this.fromWilayaName = fromWilayaName;
    this.estimatedDaysMin = estimatedDaysMin;
    this.estimatedDaysMax = estimatedDaysMax;
  }

  toJSON() {
    return {
      provider: this.provider,
      from_wilaya_id: this.fromWilayaId,
      from_wilaya_name: this.fromWilayaName,
      to_wilaya_id: this.toWilayaId,
      to_wilaya_name: this.toWilayaName,
      home_delivery_price: this.homeDeliveryPrice,
      stop_desk_price: this.stopDeskPrice,
      delivery_type: this.deliveryType,
      estimated_days_min: this.estimatedDaysMin,
      estimated_days_max: this.estimatedDaysMax,
    };
  }
}
