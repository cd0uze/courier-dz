import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl, getProviderRateLimits } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { DELIVERY_TYPE } from '../enums/DeliveryType.js';
import { OrderData } from '../data/OrderData.js';
import { CourierError } from '../exceptions/CourierError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

/**
 * E-COM Delivery raw statuses (French) → canonical TRACKING_STATUS.
 * Source: Vargo EcomDeliveryPackagesStatus enum (23 documented statuses).
 * @type {Record<string, string>}
 */
const STATUS_MAP = {
  'en préparation': TRACKING_STATUS.PENDING,
  'en traitement': TRACKING_STATUS.PENDING,
  'encours': TRACKING_STATUS.IN_TRANSIT,
  'dispatcher': TRACKING_STATUS.IN_TRANSIT,
  'au bureau': TRACKING_STATUS.READY_FOR_PICKUP,
  'sortir en livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'en livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'récupérer': TRACKING_STATUS.DELIVERED,
  'recouvert': TRACKING_STATUS.DELIVERED,
  'ne réponde pas #1': TRACKING_STATUS.FAILED_DELIVERY,
  'ne réponde pas #2': TRACKING_STATUS.FAILED_DELIVERY,
  'ne réponde pas #3': TRACKING_STATUS.FAILED_DELIVERY,
  'annuler': TRACKING_STATUS.CANCELLED,
  'annuler x3': TRACKING_STATUS.CANCELLED,
  'attend information': TRACKING_STATUS.EXCEPTION,
  'reporté': TRACKING_STATUS.FAILED_DELIVERY,
  'reporté commune erronée': TRACKING_STATUS.EXCEPTION,
  'reporté wilaya erronée': TRACKING_STATUS.EXCEPTION,
  'retour fournisseur': TRACKING_STATUS.RETURNED,
  'perdu': TRACKING_STATUS.EXCEPTION,
  'biz': TRACKING_STATUS.EXCEPTION,
  'appel tel': TRACKING_STATUS.PENDING,
  'sms envoyé': TRACKING_STATUS.PENDING,
};

/**
 * Adapter for the E-COM Delivery API (https://ecom-dz.net/Api_v1/…).
 *
 * A Procolis-style French API: parcels are wrapped in a `Colis` array with
 * PascalCase fields (NomComplet, Mobile_1, Wilaya, Total…).
 *
 * Auth: two headers — `Token` + `Key`.
 */
export class EcomDeliveryAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/ProcolisCredentials.js').ProcolisCredentials} params.credentials
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(PROVIDERS.ECOM_DELIVERY),
      defaultHeaders: {
        Token: credentials.token,
        Key: credentials.key,
      },
      httpClient,
      rateLimits: getProviderRateLimits(PROVIDERS.ECOM_DELIVERY),
    });
    this.providerEnum = PROVIDERS.ECOM_DELIVERY;
    this.credentials = credentials;
  }

  normalizeStatus(rawStatus) {
    return STATUS_MAP[String(rawStatus ?? '').toLowerCase().trim()] ?? TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      await this.get('Api_v1/Colis', { limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  getCreateOrderValidationRules() {
    return {
      order_id: { required: false, type: 'string', maxLength: 255 },
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
    const parcel = {
      Echange: data.hasExchange ? 1 : 0,
      Stopdesk: data.deliveryType === DELIVERY_TYPE.STOP_DESK ? 1 : 0,
      NomComplet: `${data.firstName} ${data.lastName}`.trim(),
      Mobile_1: data.phone,
      Adresse: data.address,
      Wilaya: String(data.toWilayaId),
      Commune: data.toCommune,
      Article: data.productDescription,
      Total: String(data.price),
      ID_Externe: data.orderId,
      Source: 'courier-dz',
    };
    if (data.deliveryType === DELIVERY_TYPE.STOP_DESK && data.stopDeskId != null) {
      parcel.CodeStopdesk = String(data.stopDeskId);
    }
    if (data.phoneAlt != null) parcel.Mobile_2 = data.phoneAlt;
    const note = this.notesWithFragile(data);
    if (note != null) parcel.NoteFournisseur = note;
    if (data.orderId) parcel.Ref_Article = data.orderId;
    return parcel;
  }

  async createOrder(data) {
    const response = await this.post('Api_v1/Colis', { Colis: [this._buildParcel(data)] });
    const colis = this._extractColis(response)[0];
    if (!colis) {
      throw new CourierError(
        `E-COM Delivery createOrder returned an unexpected response: ${JSON.stringify(response)}`,
      );
    }
    return this._hydrateOrder(colis, data);
  }

  /** Native bulk create — one POST with several Colis entries. */
  async bulkCreateOrders(dataArray) {
    const list = Array.isArray(dataArray) ? dataArray : [dataArray];
    const response = await this.post('Api_v1/Colis', {
      Colis: list.map((d) => this._buildParcel(d)),
    });
    return this._extractColis(response).map((c, i) => ({
      orderId: list[i]?.orderId ?? c?.ID_Externe ?? null,
      success: Boolean(c?.Tracking),
      tracking: c?.Tracking ?? null,
      raw: c,
    }));
  }

  async getOrder(trackingNumber) {
    const response = await this.get(`Api_v1/Colis/Tracking/${encodeURIComponent(trackingNumber)}`);
    const colis = this._extractColis(response)[0] ?? (response?.Tracking ? response : null);
    if (!colis) throw new OrderNotFoundError(trackingNumber);
    return this._hydrateOrder(colis);
  }

  /** Batch read: POST Api_v1/Colis/Liste with a list of trackings. */
  async getOrders(trackingNumbers) {
    const response = await this.post('Api_v1/Colis/Liste', {
      Colis: trackingNumbers.map((t) => ({ Tracking: t })),
    });
    return this._extractColis(response).map((c) => this._hydrateOrder(c));
  }

  /** Tracking history (GET Api_v1/Historique/Tracking/{tracking}). */
  async getTrackingHistory(trackingNumber) {
    const response = await this.get(`Api_v1/Historique/Tracking/${encodeURIComponent(trackingNumber)}`);
    const items = response?.Historique ?? response?.data ?? response;
    return Array.isArray(items) ? items : [];
  }

  /** Validate parcels: PUT Api_v1/aExpédier ("à expédier" = ready to ship). */
  async shipOrder(trackingNumber) {
    return this.bulkShipOrders([trackingNumber]);
  }

  async bulkShipOrders(trackingNumbers) {
    const response = await this.put('Api_v1/aExpédier', {
      Colis: trackingNumbers.map((t) => ({ Tracking: t })),
    });
    return response;
  }

  async updateOrder(trackingNumber, data) {
    const payload = this._buildParcel(data);
    delete payload.Echange;
    delete payload.Stopdesk;
    return this.put(`Api_v1/Colis/${encodeURIComponent(trackingNumber)}`, payload);
  }

  async cancelOrder(trackingNumber) {
    await this.bulkDeleteOrders([trackingNumber]);
    return true;
  }

  /** Native bulk delete: PUT Api_v1/Supprimer. */
  async bulkDeleteOrders(trackingNumbers) {
    const list = Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers];
    const response = await this.put('Api_v1/Supprimer', {
      Colis: list.map((t) => ({ Tracking: t })),
    });
    return this._extractColis(response).map((c, i) => ({
      tracking: c?.Tracking ?? list[i],
      deleted: true,
      raw: c,
    }));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _extractColis(response) {
    const body = response?.Colis ?? response?.data ?? response;
    if (Array.isArray(body)) return body.filter((c) => c && typeof c === 'object');
    return [];
  }

  _hydrateOrder(raw, requestData = null) {
    const rawStatus = String(raw.Situation ?? raw.Statut ?? raw.status ?? '');
    return new OrderData({
      orderId: String(raw.ID_Externe ?? raw.Ref_Article ?? requestData?.orderId ?? ''),
      trackingNumber: String(raw.Tracking ?? ''),
      provider: PROVIDERS.ECOM_DELIVERY,
      status: this.normalizeStatus(rawStatus),
      recipientName: String(raw.NomComplet ?? (requestData ? `${requestData.firstName} ${requestData.lastName}` : '')),
      phone: String(raw.Mobile_1 ?? requestData?.phone ?? ''),
      address: String(raw.Adresse ?? requestData?.address ?? ''),
      toWilayaId: Number(raw.Wilaya ?? requestData?.toWilayaId ?? 0) || 0,
      toCommune: String(raw.Commune ?? requestData?.toCommune ?? ''),
      price: Number(raw.Total ?? requestData?.price ?? 0),
      rawStatus,
      notes: raw.NoteFournisseur ?? null,
      createdAt: this.parseDate(raw.Date_Creation ?? raw.date),
      updatedAt: this.parseDate(raw.Date_last_status),
      raw,
    });
  }
}
