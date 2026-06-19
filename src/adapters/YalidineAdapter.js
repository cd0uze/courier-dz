import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { DELIVERY_TYPE } from '../enums/DeliveryType.js';
import { OrderData } from '../data/OrderData.js';
import { RateData } from '../data/RateData.js';
import { LabelData } from '../data/LabelData.js';
import { CourierError } from '../exceptions/CourierError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

/** @type {Record<string, string>} */
const STATUS_MAP = {
  'En préparation': TRACKING_STATUS.PENDING,
  'Prêt à expédier': TRACKING_STATUS.PENDING,
  'En attente': TRACKING_STATUS.PENDING,
  'Enlevé': TRACKING_STATUS.PICKED_UP,
  "Reçu à l'agence": TRACKING_STATUS.IN_TRANSIT,
  'Transféré': TRACKING_STATUS.IN_TRANSIT,
  'En cours de livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'En attente du client': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'Livré': TRACKING_STATUS.DELIVERED,
  'Tentative échouée': TRACKING_STATUS.FAILED_DELIVERY,
  'Absent': TRACKING_STATUS.FAILED_DELIVERY,
  'Reporté': TRACKING_STATUS.FAILED_DELIVERY,
  'Refusé': TRACKING_STATUS.FAILED_DELIVERY,
  'En retour': TRACKING_STATUS.RETURNING,
  'Retourné': TRACKING_STATUS.RETURNED,
  'Annulé': TRACKING_STATUS.CANCELLED,
  'Stop desk': TRACKING_STATUS.READY_FOR_PICKUP,
  'Disponible en agence': TRACKING_STATUS.READY_FOR_PICKUP,
  'Perdu': TRACKING_STATUS.EXCEPTION,
  'Endommagé': TRACKING_STATUS.EXCEPTION,
};

/**
 * Adapter for the Yalidine API engine.
 *
 * Also used for Yalitec (same engine, different subdomain).
 * Auth: X-API-ID + X-API-TOKEN headers.
 */
export class YalidineAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/YalidineCredentials.js').YalidineCredentials} params.credentials
   * @param {string} [params.provider] - PROVIDERS.YALIDINE or PROVIDERS.YALITEC
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, provider = PROVIDERS.YALIDINE, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(provider),
      defaultHeaders: {
        'X-API-ID': credentials.token,
        'X-API-TOKEN': credentials.apiKey,
      },
      httpClient,
    });
    this.providerEnum = provider;
    this.credentials = credentials;
  }

  normalizeStatus(rawStatus) {
    return STATUS_MAP[rawStatus] ?? TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      const response = await this.get('v1/parcels', { page_size: 1 });
      return response.data != null || response.total != null;
    } catch {
      return false;
    }
  }

  async getRates(fromWilayaId = null, _toWilayaId = null) {
    if (fromWilayaId == null) {
      throw new CourierError(`${this.providerEnum} requires a fromWilayaId to retrieve rates.`);
    }

    const data = await this.get(`v1/delivery-fees/${fromWilayaId}`);
    const rows = data.data ?? data;

    if (!Array.isArray(rows)) return [];

    return rows.map((item) => new RateData({
      provider: this.providerEnum,
      toWilayaId: Number(item.wilaya_id ?? 0),
      toWilayaName: String(item.wilaya_name ?? ''),
      homeDeliveryPrice: Number(item.home_price ?? 0),
      stopDeskPrice: Number(item.desk_price ?? 0),
      deliveryType: DELIVERY_TYPE.HOME,
      fromWilayaId,
    }));
  }

  getCreateOrderValidationRules() {
    return {
      order_id: { required: true, type: 'string', maxLength: 255 },
      first_name: { required: true, type: 'string', maxLength: 100 },
      last_name: { required: true, type: 'string', maxLength: 100 },
      phone: { required: true, type: 'string', pattern: /^0[5-7][0-9]{8}$/ },
      address: { required: true, type: 'string', maxLength: 500 },
      to_wilaya_id: { required: true, type: 'integer', min: 1, max: 58 },
      to_commune: { required: true, type: 'string' },
      product_description: { required: true, type: 'string' },
      price: { required: true, type: 'number', min: 0 },
      delivery_type: { required: true, type: 'integer', enum: [1, 2] },
      from_wilaya_id: { required: false, type: 'integer', min: 1, max: 58 },
      phone_alt: { required: false, type: 'string' },
      notes: { required: false, type: 'string' },
      weight: { required: false, type: 'number', min: 0 },
      stop_desk_id: { required: false, type: 'integer' },
    };
  }

  async createOrder(data) {
    const payload = {
      tracking: data.orderId,
      firstname: data.firstName,
      familyname: data.lastName,
      contact_phone: data.phone,
      address: data.address,
      to_wilaya_id: data.toWilayaId,
      to_commune_name: data.toCommune,
      product_list: data.productDescription,
      price: Math.round(data.price),
      is_stopdesk: data.deliveryType === DELIVERY_TYPE.STOP_DESK ? 1 : 0,
      freeshipping: data.freeShipping ? 1 : 0,
      has_exchange: data.hasExchange ? 1 : 0,
    };

    if (data.fromWilayaId != null) payload.from_wilaya_id = data.fromWilayaId;
    if (data.phoneAlt != null) payload.contact_phone_b = data.phoneAlt;
    if (data.notes != null) payload.note = data.notes;
    if (data.stopDeskId != null) payload.stopdesk_id = data.stopDeskId;
    if (data.weight != null) payload.weight = data.weight;
    if (data.hasExchange && data.exchangeProduct != null) {
      payload.product_to_collect = data.exchangeProduct;
    }

    const response = await this.post('v1/parcels', payload);
    return this._hydrateOrder(response);
  }

  async getOrder(trackingNumber) {
    const response = await this.get(`v1/parcels/${trackingNumber}`);

    if (!response || Object.keys(response).length === 0) {
      throw new OrderNotFoundError(trackingNumber);
    }

    return this._hydrateOrder(response);
  }

  async getLabel(trackingNumber) {
    const response = await this.get(`v1/parcels/${trackingNumber}/label`);

    if (response.url) {
      return LabelData.fromUrl(this.providerEnum, trackingNumber, response.url);
    }

    if (response.data) {
      return LabelData.fromBase64(this.providerEnum, trackingNumber, response.data);
    }

    throw new CourierError(
      `${this.providerEnum} returned an unrecognisable label format for [${trackingNumber}].`,
    );
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _hydrateOrder(raw) {
    const rawStatus = String(raw.last_status ?? raw.status ?? '');
    return new OrderData({
      orderId: String(raw.tracking ?? ''),
      trackingNumber: String(raw.tracking ?? ''),
      provider: this.providerEnum,
      status: this.normalizeStatus(rawStatus),
      recipientName: `${raw.firstname ?? ''} ${raw.familyname ?? ''}`.trim(),
      phone: String(raw.contact_phone ?? ''),
      address: String(raw.address ?? ''),
      toWilayaId: Number(raw.to_wilaya_id ?? 0),
      toCommune: String(raw.to_commune_name ?? ''),
      price: Number(raw.price ?? 0),
      shippingFee: raw.price_delivery != null ? Number(raw.price_delivery) : null,
      rawStatus,
      notes: raw.note ?? null,
      createdAt: this.parseDate(raw.date),
      updatedAt: this.parseDate(raw.last_update),
      raw,
    });
  }
}
