/**
 * Unified shipping rate entry.
 */
export class RateData {
  /**
   * @param {object} params
   * @param {string} params.provider - Provider ID
   * @param {number} params.toWilayaId - Destination wilaya ID
   * @param {string} params.toWilayaName - Destination wilaya name
   * @param {string|null} [params.toWilayaNameAr] - Destination wilaya name (Arabic)
   * @param {number} params.homeDeliveryPrice - Home delivery price in DZD
   * @param {number} params.stopDeskPrice - Stop-desk price in DZD
   * @param {number} params.deliveryType - DELIVERY_TYPE value
   * @param {number|null} [params.fromWilayaId] - Origin wilaya ID
   * @param {string|null} [params.fromWilayaName] - Origin wilaya name
   * @param {number|null} [params.estimatedDaysMin] - Minimum estimated delivery days
   * @param {number|null} [params.estimatedDaysMax] - Maximum estimated delivery days
   * @param {boolean} [params.hasCommunePricing] - Whether provider supports per-commune pricing
   * @param {Array<{id:*, name:string, nameAr:string|null, home:number, desk:number}>|null} [params.communes] - Per-commune prices
   * @param {number|null} [params.returnPrice] - Return fee (when the provider exposes one)
   * @param {string|number|null} [params.territoryId] - Provider-specific territory identifier
   *   (e.g. ZR Express NEW UUID) when the rate is keyed by an opaque territory id.
   * @param {string|null} [params.territoryLevel] - 'wilaya' or 'commune' when the provider
   *   returns rates at mixed levels (ZR Express NEW). Lets callers store commune-level rows faithfully.
   */
  constructor({
    provider,
    toWilayaId,
    toWilayaName,
    toWilayaNameAr = null,
    homeDeliveryPrice,
    stopDeskPrice,
    deliveryType,
    fromWilayaId = null,
    fromWilayaName = null,
    estimatedDaysMin = null,
    estimatedDaysMax = null,
    hasCommunePricing = false,
    communes = null,
    returnPrice = null,
    territoryId = null,
    territoryLevel = null,
    oversizeFee = null,
  }) {
    this.provider = provider;
    this.toWilayaId = toWilayaId;
    this.toWilayaName = toWilayaName;
    this.toWilayaNameAr = toWilayaNameAr;
    this.homeDeliveryPrice = homeDeliveryPrice;
    this.stopDeskPrice = stopDeskPrice;
    this.deliveryType = deliveryType;
    this.fromWilayaId = fromWilayaId;
    this.fromWilayaName = fromWilayaName;
    this.estimatedDaysMin = estimatedDaysMin;
    this.estimatedDaysMax = estimatedDaysMax;
    this.hasCommunePricing = hasCommunePricing;
    this.communes = communes;
    this.returnPrice = returnPrice;
    this.territoryId = territoryId;
    this.territoryLevel = territoryLevel;
    /** Per-kg fee charged on billable weight above 5kg (Yalidine `oversize_fee`). */
    this.oversizeFee = oversizeFee;
  }

  toJSON() {
    return {
      provider: this.provider,
      from_wilaya_id: this.fromWilayaId,
      from_wilaya_name: this.fromWilayaName,
      to_wilaya_id: this.toWilayaId,
      to_wilaya_name: this.toWilayaName,
      to_wilaya_name_ar: this.toWilayaNameAr,
      home_delivery_price: this.homeDeliveryPrice,
      stop_desk_price: this.stopDeskPrice,
      return_price: this.returnPrice,
      delivery_type: this.deliveryType,
      estimated_days_min: this.estimatedDaysMin,
      estimated_days_max: this.estimatedDaysMax,
      has_commune_pricing: this.hasCommunePricing,
      communes: this.communes,
      territory_id: this.territoryId,
      territory_level: this.territoryLevel,
      oversize_fee: this.oversizeFee,
    };
  }
}
