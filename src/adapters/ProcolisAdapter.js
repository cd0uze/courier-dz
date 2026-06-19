import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { DELIVERY_TYPE } from '../enums/DeliveryType.js';
import { OrderData } from '../data/OrderData.js';
import { RateData } from '../data/RateData.js';
import { UnsupportedOperationError } from '../exceptions/UnsupportedOperationError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

/** @type {Record<string, string>} */
const STATUS_MAP = {
  'en attente': TRACKING_STATUS.PENDING,
  'préparation': TRACKING_STATUS.PENDING,
  'en préparation': TRACKING_STATUS.PENDING,
  'ramassé': TRACKING_STATUS.PICKED_UP,
  'enlevé': TRACKING_STATUS.PICKED_UP,
  'collecté': TRACKING_STATUS.PICKED_UP,
  'en transit': TRACKING_STATUS.IN_TRANSIT,
  'reçu en entrepôt': TRACKING_STATUS.IN_TRANSIT,
  'en cours de livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'sorti en livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'livré': TRACKING_STATUS.DELIVERED,
  'livraison effectuée': TRACKING_STATUS.DELIVERED,
  'tentative échouée': TRACKING_STATUS.FAILED_DELIVERY,
  'non livré': TRACKING_STATUS.FAILED_DELIVERY,
  'absent': TRACKING_STATUS.FAILED_DELIVERY,
  'refusé': TRACKING_STATUS.FAILED_DELIVERY,
  'retour en cours': TRACKING_STATUS.RETURNING,
  'en retour': TRACKING_STATUS.RETURNING,
  'retourné': TRACKING_STATUS.RETURNED,
  'retour livré': TRACKING_STATUS.RETURNED,
  'annulé': TRACKING_STATUS.CANCELLED,
  'perdu': TRACKING_STATUS.EXCEPTION,
  'endommagé': TRACKING_STATUS.EXCEPTION,
};

/**
 * Adapter for the Procolis API (also used by legacy ZR Express).
 *
 * Auth: id + token in request body / query params.
 */
export class ProcolisAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/ProcolisCredentials.js').ProcolisCredentials} params.credentials
   * @param {string} [params.provider] - PROVIDERS.PROCOLIS or PROVIDERS.ZREXPRESS
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, provider = PROVIDERS.PROCOLIS, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(PROVIDERS.PROCOLIS),
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
      const response = await this.get('livraisons', this._authParams({ page: '1' }));
      return response.livraisons != null || response.data != null || Array.isArray(response);
    } catch {
      return false;
    }
  }

  async getRates(fromWilayaId = null, toWilayaId = null) {
    const params = this._authParams();
    if (toWilayaId != null) params.wilaya_id = String(toWilayaId);

    const data = await this.get('tarifs', params);
    const rows = data.tarifs ?? data.data ?? data;

    if (!Array.isArray(rows)) return [];

    return rows.map((item) => new RateData({
      provider: this.providerEnum,
      toWilayaId: Number(item.wilaya_id ?? 0),
      toWilayaName: String(item.wilaya_name ?? ''),
      homeDeliveryPrice: Number(item.tarif_domicile ?? item.tarif ?? 0),
      stopDeskPrice: Number(item.tarif_bureau ?? item.tarif ?? 0),
      deliveryType: DELIVERY_TYPE.HOME,
      fromWilayaId,
    }));
  }

  getCreateOrderValidationRules() {
    return {
      order_id: { required: true, type: 'string', maxLength: 255 },
      first_name: { required: true, type: 'string', maxLength: 100 },
      last_name: { required: true, type: 'string', maxLength: 100 },
      phone: { required: true, type: 'string' },
      address: { required: true, type: 'string' },
      to_wilaya_id: { required: true, type: 'integer', min: 1, max: 58 },
      to_commune: { required: true, type: 'string' },
      product_description: { required: true, type: 'string' },
      price: { required: true, type: 'number', min: 0 },
      delivery_type: { required: true, type: 'integer', enum: [1, 2] },
      notes: { required: false, type: 'string' },
    };
  }

  async createOrder(data) {
    const payload = {
      ...this._authParams(),
      Tracking: data.orderId,
      TypeLivraison: data.deliveryType,
      TypeColis: 0,
      Confrimee: 0,
      Client: `${data.firstName} ${data.lastName}`,
      MobileA: data.phone,
      Adresse: data.address,
      IDWilaya: String(data.toWilayaId).padStart(2, '0'),
      Commune: data.toCommune,
      Total: String(data.price),
      TProduit: data.productDescription,
      id_Externe: data.orderId,
    };

    if (data.phoneAlt != null) payload.MobileB = data.phoneAlt;
    if (data.notes != null) payload.Note = data.notes;

    const response = await this.post('livraisons', payload);
    return this._hydrateOrder({ ...response, _input: data.toJSON() });
  }

  async getOrder(trackingNumber) {
    const response = await this.get(`livraisons/${trackingNumber}`, this._authParams());

    if (!response || Object.keys(response).length === 0 || response.error) {
      throw new OrderNotFoundError(trackingNumber);
    }

    return this._hydrateOrder(response);
  }

  async getLabel(_trackingNumber) {
    throw new UnsupportedOperationError('getLabel', this.providerEnum);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Build the auth params that Procolis requires on every request.
   * @param {object} [extra]
   * @returns {object}
   */
  _authParams(extra = {}) {
    return { id: this.credentials.id, token: this.credentials.token, ...extra };
  }

  _hydrateOrder(raw) {
    const rawStatus = String(raw.Statut ?? raw.statut ?? raw.status ?? '');
    const input = raw._input ?? {};

    return new OrderData({
      orderId: String(raw.Tracking ?? raw.id_Externe ?? input.order_id ?? ''),
      trackingNumber: String(raw.Tracking ?? ''),
      provider: this.providerEnum,
      status: this.normalizeStatus(rawStatus),
      recipientName: String(raw.Client ?? ''),
      phone: String(raw.MobileA ?? ''),
      address: String(raw.Adresse ?? ''),
      toWilayaId: Number(raw.IDWilaya ?? 0),
      toCommune: String(raw.Commune ?? ''),
      price: Number(raw.Total ?? 0),
      rawStatus,
      notes: raw.Note ?? null,
      createdAt: this.parseDate(raw.Date),
      updatedAt: this.parseDate(raw.DateModification),
      raw,
    });
  }
}
