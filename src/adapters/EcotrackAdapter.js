import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { DELIVERY_TYPE } from '../enums/DeliveryType.js';
import { LABEL_TYPE } from '../enums/LabelType.js';
import { OrderData } from '../data/OrderData.js';
import { RateData } from '../data/RateData.js';
import { LabelData } from '../data/LabelData.js';
import { CourierError } from '../exceptions/CourierError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

/** @type {Record<string, string>} */
const STATUS_MAP = {
  created: TRACKING_STATUS.PENDING,
  pending: TRACKING_STATUS.PENDING,
  'en attente': TRACKING_STATUS.PENDING,
  ready: TRACKING_STATUS.PENDING,
  picked_up: TRACKING_STATUS.PICKED_UP,
  collected: TRACKING_STATUS.PICKED_UP,
  'ramassé': TRACKING_STATUS.PICKED_UP,
  in_hub: TRACKING_STATUS.IN_TRANSIT,
  in_transit: TRACKING_STATUS.IN_TRANSIT,
  'en transit': TRACKING_STATUS.IN_TRANSIT,
  transferred: TRACKING_STATUS.IN_TRANSIT,
  out_for_delivery: TRACKING_STATUS.OUT_FOR_DELIVERY,
  'en cours de livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  delivered: TRACKING_STATUS.DELIVERED,
  'livré': TRACKING_STATUS.DELIVERED,
  delivery_failed: TRACKING_STATUS.FAILED_DELIVERY,
  failed: TRACKING_STATUS.FAILED_DELIVERY,
  'tentative échouée': TRACKING_STATUS.FAILED_DELIVERY,
  absent: TRACKING_STATUS.FAILED_DELIVERY,
  refused: TRACKING_STATUS.FAILED_DELIVERY,
  return_initiated: TRACKING_STATUS.RETURNING,
  returning: TRACKING_STATUS.RETURNING,
  'en retour': TRACKING_STATUS.RETURNING,
  returned: TRACKING_STATUS.RETURNED,
  'retourné': TRACKING_STATUS.RETURNED,
  cancelled: TRACKING_STATUS.CANCELLED,
  'annulé': TRACKING_STATUS.CANCELLED,
  stop_desk: TRACKING_STATUS.READY_FOR_PICKUP,
  exception: TRACKING_STATUS.EXCEPTION,
  lost: TRACKING_STATUS.EXCEPTION,
  damaged: TRACKING_STATUS.EXCEPTION,
};

/**
 * Adapter for the Ecotrack API engine.
 *
 * Handles the generic Ecotrack provider AND all branded sub-providers
 * (DHD, Conexlog, Anderson Delivery, WorldExpress, Swift, AlloLivraison, etc.)
 * — they share the same API surface; only the base URL and metadata differ.
 *
 * Auth: Bearer token.
 */
export class EcotrackAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/TokenCredentials.js').TokenCredentials} params.credentials
   * @param {string} [params.provider] - Provider ID (defaults to PROVIDERS.ECOTRACK)
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, provider = PROVIDERS.ECOTRACK, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(provider),
      defaultHeaders: {
        Authorization: `Bearer ${credentials.token}`,
      },
      httpClient,
    });
    this.providerEnum = provider;
    this.credentials = credentials;
  }

  normalizeStatus(rawStatus) {
    return STATUS_MAP[rawStatus.toLowerCase().trim()] ?? TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      await this.get('api/v1/parcels', { per_page: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async getRates(fromWilayaId = null, toWilayaId = null) {
    const params = {};
    if (toWilayaId != null) params.wilaya_id = toWilayaId;

    const data = await this.get('api/v1/tarifs', params);
    const rows = data.tarifs ?? data.data ?? data;

    if (!Array.isArray(rows)) return [];

    return rows.map((item) => new RateData({
      provider: this.providerEnum,
      toWilayaId: Number(item.wilaya_id ?? 0),
      toWilayaName: String(item.wilaya_name ?? ''),
      homeDeliveryPrice: Number(item.home_price ?? item.price ?? 0),
      stopDeskPrice: Number(item.stopdesk_price ?? item.price ?? 0),
      deliveryType: DELIVERY_TYPE.HOME,
      fromWilayaId,
    }));
  }

  getCreateOrderValidationRules() {
    return {
      order_id: { required: true, type: 'string' },
      first_name: { required: true, type: 'string' },
      last_name: { required: true, type: 'string' },
      phone: { required: true, type: 'string' },
      address: { required: true, type: 'string' },
      to_wilaya_id: { required: true, type: 'integer', min: 1, max: 58 },
      to_commune: { required: true, type: 'string' },
      product_description: { required: true, type: 'string' },
      price: { required: true, type: 'number', min: 0 },
      delivery_type: { required: true, type: 'integer', enum: [1, 2] },
      weight: { required: false, type: 'number' },
    };
  }

  async createOrder(data) {
    const payload = {
      reference: data.orderId,
      firstname: data.firstName,
      lastname: data.lastName,
      phone: data.phone,
      address: data.address,
      wilaya_id: data.toWilayaId,
      commune: data.toCommune,
      product: data.productDescription,
      cod: data.price,
      delivery_type: data.deliveryType,
      is_fragile: false,
    };

    if (data.phoneAlt != null) payload.phone2 = data.phoneAlt;
    if (data.notes != null) payload.note = data.notes;
    if (data.weight != null) payload.weight = data.weight;
    if (data.stopDeskId != null) payload.stop_desk_id = data.stopDeskId;
    if (data.hasExchange && data.exchangeProduct != null) {
      payload.exchange_product = data.exchangeProduct;
    }

    const response = await this.post('api/v1/parcels', payload);
    return this._hydrateOrder(response);
  }

  async getOrder(trackingNumber) {
    const response = await this.get(`api/v1/parcels/${trackingNumber}`);

    if (!response || Object.keys(response).length === 0 || response.error) {
      throw new OrderNotFoundError(trackingNumber);
    }

    return this._hydrateOrder(response);
  }

  async getLabel(trackingNumber) {
    const response = await this.get(`api/v1/parcels/${trackingNumber}/label`);

    if (response.url) {
      return LabelData.fromUrl(this.providerEnum, trackingNumber, response.url);
    }

    if (response.label) {
      return LabelData.fromBase64(this.providerEnum, trackingNumber, response.label);
    }

    throw new CourierError(
      `${this.providerEnum} returned an unrecognisable label format for [${trackingNumber}].`,
    );
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _hydrateOrder(raw) {
    const rawStatus = String(raw.status ?? '');
    return new OrderData({
      orderId: String(raw.reference ?? raw.id ?? ''),
      trackingNumber: String(raw.tracking ?? raw.barcode ?? raw.id ?? ''),
      provider: this.providerEnum,
      status: this.normalizeStatus(rawStatus),
      recipientName: `${raw.firstname ?? ''} ${raw.lastname ?? ''}`.trim(),
      phone: String(raw.phone ?? ''),
      address: String(raw.address ?? ''),
      toWilayaId: Number(raw.wilaya_id ?? 0),
      toCommune: String(raw.commune ?? ''),
      price: Number(raw.cod ?? 0),
      shippingFee: raw.delivery_fee != null ? Number(raw.delivery_fee) : null,
      rawStatus,
      notes: raw.note ?? null,
      createdAt: this.parseDate(raw.created_at),
      updatedAt: this.parseDate(raw.updated_at),
      raw,
    });
  }
}
