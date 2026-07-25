import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl, getProviderRateLimits } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { DELIVERY_TYPE } from '../enums/DeliveryType.js';
import { OrderData } from '../data/OrderData.js';
import { RateData } from '../data/RateData.js';
import { UnsupportedOperationError } from '../exceptions/UnsupportedOperationError.js';
import { CourierError } from '../exceptions/CourierError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

/**
 * Procolis raw statuses → canonical TRACKING_STATUS.
 * Full 28-status dictionary confirmed by the Vargo ProcolisPackagesStatus
 * enum, merged with the legacy free-form labels already handled before.
 * @type {Record<string, string>}
 */
const STATUS_MAP = {
  // Documented Procolis statuses (Vargo census)
  'en preparation': TRACKING_STATUS.PENDING,
  'en traitement - prêt à expédie': TRACKING_STATUS.PENDING,
  'dispatcher': TRACKING_STATUS.IN_TRANSIT,
  'en livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'en livraison ( 1528 )': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'au bureau': TRACKING_STATUS.READY_FOR_PICKUP,
  'reporté': TRACKING_STATUS.FAILED_DELIVERY,
  'a relancé': TRACKING_STATUS.FAILED_DELIVERY,
  'échange': TRACKING_STATUS.IN_TRANSIT,
  'appel sans réponse 1': TRACKING_STATUS.FAILED_DELIVERY,
  'appel sans réponse 2': TRACKING_STATUS.FAILED_DELIVERY,
  'appel sans réponse 3': TRACKING_STATUS.FAILED_DELIVERY,
  'sd - appel sans réponse 1': TRACKING_STATUS.FAILED_DELIVERY,
  'sd - appel sans réponse 2': TRACKING_STATUS.FAILED_DELIVERY,
  'sd - appel sans réponse 3': TRACKING_STATUS.FAILED_DELIVERY,
  'sd - en attente du client': TRACKING_STATUS.READY_FOR_PICKUP,
  'sd - reporté': TRACKING_STATUS.FAILED_DELIVERY,
  'colis livrée': TRACKING_STATUS.DELIVERED,
  'livrée': TRACKING_STATUS.DELIVERED,
  'livrée [ encaisser ]': TRACKING_STATUS.DELIVERED,
  'annuler par le client': TRACKING_STATUS.CANCELLED,
  'sd - annuler par le client': TRACKING_STATUS.CANCELLED,
  'sd - annuler 3x': TRACKING_STATUS.CANCELLED,
  'retour de dispatche': TRACKING_STATUS.RETURNING,
  'retour livreur': TRACKING_STATUS.RETURNING,
  'retour navette': TRACKING_STATUS.RETURNING,
  'retour stock': TRACKING_STATUS.RETURNED,

  // Legacy free-form labels (kept for backward compatibility)
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
 * Auth: token + key sent as HTTP headers on every request.
 * Endpoints follow the ProcolisProviderIntegration reference:
 *   - token (GET)      → testCredentials
 *   - tarification (POST) → getRates
 *   - add_colis (POST)  → createOrder
 *   - lire (POST)       → getOrder
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
      rateLimits: getProviderRateLimits(provider),
    });
    this.providerEnum = provider;
    this.credentials = credentials;
  }

  /** Auth headers sent on every request */
  _authHeaders() {
    return {
      token: this.credentials.token,
      key: this.credentials.key,
    };
  }

  normalizeStatus(rawStatus) {
    return STATUS_MAP[String(rawStatus ?? '').toLowerCase().trim()] ?? TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      const response = await this.get('token', {}, this._authHeaders());
      return response?.Statut === 'Accès activé';
    } catch {
      return false;
    }
  }

  async getRates(fromWilayaId = null, toWilayaId = null) {
    const data = await this._request('POST', 'tarification', { headers: this._authHeaders() });
    const rows = Array.isArray(data) ? data : (data.data ?? data.tarifs ?? []);

    if (!Array.isArray(rows)) return [];

    let result = rows.map((item) => new RateData({
      provider: this.providerEnum,
      toWilayaId: Number(item.IDWilaya ?? item.wilaya_id ?? 0),
      toWilayaName: String(item.Wilaya ?? item.wilaya_name ?? ''),
      homeDeliveryPrice: Number(item.Domicile ?? item.tarif_domicile ?? item.tarif ?? 0),
      stopDeskPrice: Number(item.Stopdesk ?? item.tarif_bureau ?? item.tarif ?? 0),
      deliveryType: DELIVERY_TYPE.HOME,
      fromWilayaId,
    }));

    if (toWilayaId != null) {
      result = result.filter((r) => r.toWilayaId === Number(toWilayaId));
    }

    return result;
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

  _buildParcel(data) {
    const payload = {
      Tracking: data.orderId,
      TypeLivraison: data.deliveryType === DELIVERY_TYPE.STOP_DESK ? 1 : 0,
      TypeColis: data.hasExchange ? 1 : 0,
      Confrimee: 1,
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
    const note = this.notesWithFragile(data);
    if (note != null) payload.Note = note;
    return payload;
  }

  async createOrder(data) {
    const response = await this.post(
      'add_colis',
      { Colis: [this._buildParcel(data)] },
      this._authHeaders(),
    );

    const colis = response?.Colis?.[0];
    if (!colis) {
      throw new CourierError(
        `Procolis createOrder returned an unexpected response: ${JSON.stringify(response)}`,
      );
    }

    if (colis.MessageRetour === 'Double Tracking') {
      throw new CourierError(
        `Create Order failed (Duplicate Tracking): ${JSON.stringify(colis)}`,
      );
    }

    if (colis.MessageRetour !== 'Good') {
      throw new CourierError(
        `Create Order failed (${colis.MessageRetour}): ${JSON.stringify(colis)}`,
      );
    }

    return this._hydrateOrder(colis);
  }

  async getOrder(trackingNumber) {
    const response = await this.post(
      'lire',
      { Colis: [{ Tracking: trackingNumber }] },
      this._authHeaders(),
    );

    const colis = response?.Colis?.[0];
    if (!colis || Object.keys(colis).length === 0) {
      throw new OrderNotFoundError(trackingNumber);
    }

    return this._hydrateOrder(colis);
  }

  /**
   * Native bulk create — Procolis accepts several parcels in one
   * `POST add_colis` call. Returns one result per parcel.
   *
   * @param {Array<import('../data/CreateOrderData.js').CreateOrderData>} dataArray
   * @returns {Promise<Array<{orderId:string, success:boolean, tracking:(string|null), message:(string|null), order:(OrderData|null)}>>}
   */
  async bulkCreateOrders(dataArray) {
    const list = Array.isArray(dataArray) ? dataArray : [dataArray];
    const response = await this.post(
      'add_colis',
      { Colis: list.map((d) => this._buildParcel(d)) },
      this._authHeaders(),
    );
    const results = Array.isArray(response?.Colis) ? response.Colis : [];
    return list.map((data, i) => {
      const colis = results[i] ?? null;
      const success = colis?.MessageRetour === 'Good';
      return {
        orderId: data.orderId,
        success,
        tracking: success ? String(colis.Tracking ?? data.orderId) : null,
        message: colis?.MessageRetour ?? 'No response entry',
        order: success ? this._hydrateOrder(colis) : null,
      };
    });
  }

  /** Batch read: one `POST lire` call with several trackings. */
  async getOrders(trackingNumbers) {
    const response = await this.post(
      'lire',
      { Colis: trackingNumbers.map((t) => ({ Tracking: t })) },
      this._authHeaders(),
    );
    const rows = Array.isArray(response?.Colis) ? response.Colis : [];
    return rows
      .filter((c) => c && typeof c === 'object' && c.Tracking)
      .map((c) => this._hydrateOrder(c));
  }

  /**
   * Validate a parcel — flag it "Prêt à expédier" so Procolis dispatches it
   * (`POST pret`, endpoint confirmed by the Vargo integration).
   *
   * @param {string} trackingNumber
   * @returns {Promise<object>} raw Procolis response entry
   */
  async shipOrder(trackingNumber) {
    const response = await this.post(
      'pret',
      { Colis: [{ Tracking: trackingNumber }] },
      this._authHeaders(),
    );
    return response?.Colis?.[0] ?? response;
  }

  /** Validate several parcels in one `POST pret` call. */
  async bulkShipOrders(trackingNumbers) {
    const response = await this.post(
      'pret',
      { Colis: trackingNumbers.map((t) => ({ Tracking: t })) },
      this._authHeaders(),
    );
    return Array.isArray(response?.Colis) ? response.Colis : [];
  }

  async getLabel(_trackingNumber) {
    throw new UnsupportedOperationError('getLabel', this.providerEnum);
  }

  async cancelOrder(_trackingNumber) {
    throw new UnsupportedOperationError('cancelOrder', this.providerEnum);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _hydrateOrder(raw) {
    const rawStatus = String(raw.Statut ?? raw.statut ?? raw.status ?? '');
    const tracking = String(raw.Tracking ?? '');

    return new OrderData({
      orderId: tracking || String(raw.id_Externe ?? ''),
      trackingNumber: tracking,
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
