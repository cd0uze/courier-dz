import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl, getProviderRateLimits } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { DELIVERY_TYPE } from '../enums/DeliveryType.js';
import { OrderData } from '../data/OrderData.js';
import { RateData } from '../data/RateData.js';
import { LabelData } from '../data/LabelData.js';
import { CourierError } from '../exceptions/CourierError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

/**
 * Elogistia raw statuses (French) → canonical TRACKING_STATUS.
 * Source: Vargo ElogistiaPackagesStatus enum (14 documented statuses).
 * @type {Record<string, string>}
 */
const STATUS_MAP = {
  'ramassée': TRACKING_STATUS.PICKED_UP,
  'réceptionnée': TRACKING_STATUS.PICKED_UP,
  'à expédiée': TRACKING_STATUS.PENDING,
  'en transit': TRACKING_STATUS.IN_TRANSIT,
  'en hub': TRACKING_STATUS.IN_TRANSIT,
  'en cours livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'livré': TRACKING_STATUS.DELIVERED,
  'livrée & réglée': TRACKING_STATUS.DELIVERED,
  'suspendue': TRACKING_STATUS.FAILED_DELIVERY,
  'annulée': TRACKING_STATUS.CANCELLED,
  'retour en transit': TRACKING_STATUS.RETURNING,
  'retour remis': TRACKING_STATUS.RETURNED,
  'perdue': TRACKING_STATUS.EXCEPTION,
  'partiel remis': TRACKING_STATUS.EXCEPTION,
};

/**
 * Adapter for the Elogistia API (https://api.elogistia.com).
 *
 * Auth (per the official Postman collection): the API key travels as a QUERY
 * parameter on every request — named `apiKey` on parcel operations
 * (insertCommande, getTracking, getManyTracking, printBordereau_*,
 * deleteOrder, createComment, updateCommande) and `key` on catalogue reads
 * (getOrders, getWilayas, getMunicipalities, getShippingCost, getAgences).
 * There is no auth header. Paths end with a trailing slash.
 *
 * Endpoints (official Postman collection «Documentation Elogistia API»):
 *   - insertCommande/ (POST, fields in the query string) → createOrder
 *   - getOrders/?tracking=…          → listOrders / getOrder
 *   - getTracking/ / getManyTracking/ → tracking history (single / bulk)
 *   - deleteOrder/?tracking=…        → cancelOrder
 *   - printBordereau_10x15|15x20|10x10 (+ _multiple_10x15) → getLabel
 *   - createComment/ / updateCommande/
 *   - getWilayas/ / getMunicipalities/ / getAgences/ / getShippingCost/
 */
export class ElogistiaAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/TokenCredentials.js').TokenCredentials} params.credentials
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(PROVIDERS.ELOGISTIA),
      httpClient,
      rateLimits: getProviderRateLimits(PROVIDERS.ELOGISTIA),
    });
    this.providerEnum = PROVIDERS.ELOGISTIA;
    this.credentials = credentials;
  }

  /**
   * Elogistia authenticates via a query parameter whose NAME depends on the
   * endpoint family: `apiKey` for parcel operations, `key` for catalogue reads.
   * @param {'apiKey'|'key'} name
   * @param {object} [params]
   */
  _auth(name, params = {}) {
    return { [name]: this.credentials.token, ...params };
  }

  normalizeStatus(rawStatus) {
    return STATUS_MAP[String(rawStatus ?? '').toLowerCase().trim()] ?? TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      await this.get('getWilayas/', this._auth('key'));
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
      to_wilaya_id: { required: true, type: 'string_or_integer' },
      to_commune: { required: true, type: 'string' },
      product_description: { required: true, type: 'string' },
      price: { required: true, type: 'number', min: 0 },
      delivery_type: { required: true, type: 'integer', enum: [1, 2] },
      weight: { required: false, type: 'number' },
      notes: { required: false, type: 'string' },
    };
  }

  /**
   * The official create example sends `wilaya=16` — the NUMERIC code. When a
   * wilaya name slips in instead, resolve it back to its code via getWilayas().
   */
  async _resolveWilayaCode(toWilayaId) {
    const code = Number(toWilayaId);
    if (Number.isInteger(code) && code >= 1 && code <= 58) return code;
    const name = String(toWilayaId ?? '').trim().toLowerCase();
    const wilayas = await this.getWilayas();
    const match = wilayas.find((w) => w.name.trim().toLowerCase() === name);
    if (!match) {
      throw new CourierError(`Elogistia: unknown wilaya "${toWilayaId}".`);
    }
    return Number(match.id);
  }

  async createOrder(data) {
    // Official collection: POST insertCommande/ with every field in the QUERY
    // string. `product`/`price` are pipe-separated parallel lists; we ship one
    // line carrying the full COD amount.
    const params = this._auth('apiKey', {
      name: data.lastName,
      firstname: data.firstName,
      phone: data.phone,
      address: data.address,
      commune: data.toCommune,
      wilaya: await this._resolveWilayaCode(data.toWilayaId),
      // modeDeLivraison: 1 = standard delivery, 4 = exchange
      modeDeLivraison: data.hasExchange ? 4 : 1,
      price: data.price,
      // stop_desk: 1 = home, 2 = stop desk (same values as our DELIVERY_TYPE)
      stop_desk: data.deliveryType === DELIVERY_TYPE.STOP_DESK ? 2 : 1,
      product: data.productDescription,
      IdCommande: data.orderId,
    });
    const note = this.notesWithFragile(data);
    if (note != null) params.remarque = note;
    if (data.weight != null) params.poids = data.weight;
    if (data.hasExchange && data.exchangeProduct != null) params.exchangeName = data.exchangeProduct;

    const response = await this._request('POST', 'insertCommande/', { params });
    const body = this._body(response);
    const tracking = String(body?.tracking ?? body?.Tracking ?? response?.tracking ?? '');
    if (!tracking) {
      throw new CourierError(
        `Elogistia createOrder returned no tracking number: ${JSON.stringify(response)}`,
      );
    }
    return this._hydrateOrder({ ...body, tracking }, data);
  }

  async getOrder(trackingNumber) {
    const response = await this.get('getOrders/', this._auth('key', { tracking: trackingNumber }));
    const rows = this._bodyItems(response);
    // The API answers list-style: match the exact tracking, never the first row.
    const row = rows.find((r) => String(r.tracking ?? r.Tracking ?? '') === String(trackingNumber)) ?? rows[0];
    if (!row) throw new OrderNotFoundError(trackingNumber);
    return this._hydrateOrder(row);
  }

  /** Tracking history events for a parcel (GET getTracking/). */
  async getTrackingHistory(trackingNumber) {
    const response = await this.get('getTracking/', this._auth('apiKey', { tracking: trackingNumber }));
    return this._bodyItems(response);
  }

  /**
   * Bulk tracking for several parcels in one call
   * (GET getManyTracking/?tracking=a,b,c).
   * @param {string[]} trackingNumbers
   * @returns {Promise<Array<object>>}
   */
  async getTrackingHistories(trackingNumbers) {
    const list = (Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers]).filter(Boolean);
    if (list.length === 0) return [];
    const response = await this.get(
      'getManyTracking/',
      this._auth('apiKey', { tracking: list.join(',') }),
    );
    return this._bodyItems(response);
  }

  async cancelOrder(trackingNumber) {
    await this.get('deleteOrder/', this._auth('apiKey', { tracking: trackingNumber }));
    return true;
  }

  /**
   * Update an order (GET updateCommande/ — the API mutates via GET). Accepts
   * Elogistia query fields, e.g. { validationLogistique: 55 }.
   * @param {string} trackingNumber
   * @param {object} fields
   */
  async updateOrder(trackingNumber, fields = {}) {
    return this.get(
      'updateCommande/',
      this._auth('apiKey', { tracking: trackingNumber, ...fields }),
    );
  }

  /** Attach a comment to a parcel (POST createComment/?comment=…). */
  async createComment(trackingNumber, comment) {
    return this._request('POST', 'createComment/', {
      params: this._auth('apiKey', { tracking: trackingNumber, comment }),
    });
  }

  /**
   * Label as raw PDF bytes → base64 (Elogistia has no public label URL).
   * @param {string|string[]} trackingNumber - several trackings = one merged 10x15 file
   * @param {'10x15'|'15x20'|'10x10'} [format]
   */
  async getLabel(trackingNumber, format = '10x15') {
    const many = Array.isArray(trackingNumber) && trackingNumber.length > 1;
    const path = many
      ? 'printBordereau_multiple_10x15/'
      : format === '15x20' ? 'printBordereau_15x20/'
        : format === '10x10' ? 'printBordereau_10x10/'
          : 'printBordereau_10x15/';
    const tracking = Array.isArray(trackingNumber) ? trackingNumber.join(',') : trackingNumber;
    const rawPdf = await this.requestRaw('GET', path, {
      params: this._auth('apiKey', { tracking }),
    });
    if (!rawPdf || rawPdf.length === 0) {
      throw new CourierError(`Elogistia returned an empty label for [${tracking}].`);
    }
    return LabelData.fromBase64(PROVIDERS.ELOGISTIA, tracking, rawPdf.toString('base64'));
  }

  async getWilayas() {
    const response = await this.get('getWilayas/', this._auth('key'));
    return this._bodyItems(response).map((w) => ({
      id: Number(w.id ?? w.code ?? 0),
      name: String(w.name ?? w.nom ?? w.wilaya ?? ''),
      raw: w,
    }));
  }

  async getCommunes(wilayaId = null) {
    const params = this._auth('key');
    if (wilayaId != null) params.wilaya = Number(wilayaId);
    const response = await this.get('getMunicipalities/', params);
    return this._bodyItems(response).map((c) => ({
      id: c.id != null ? Number(c.id) : null,
      name: String(c.name ?? c.nom ?? c.commune ?? ''),
      wilayaId: Number(c.wilaya_id ?? c.wilaya ?? wilayaId ?? 0),
      raw: c,
    }));
  }

  /** Stop-desk agencies (GET getAgences/). */
  async getOffices(wilayaId = null) {
    const params = this._auth('key');
    if (wilayaId != null) params.wilaya_id = Number(wilayaId);
    const response = await this.get('getAgences/', params);
    return this._bodyItems(response).map((o) => ({
      id: o.id != null ? Number(o.id) : null,
      name: String(o.name ?? o.nom ?? ''),
      address: o.address != null ? String(o.address) : null,
      wilayaId: Number(o.wilaya_id ?? o.wilaya ?? wilayaId ?? 0),
      raw: o,
    }));
  }

  async getRates(fromWilayaId = null, toWilayaId = null) {
    const response = await this.get('getShippingCost/', this._auth('key'));
    let rows = this._bodyItems(response).map((item) => new RateData({
      provider: this.providerEnum,
      toWilayaId: Number(item.wilaya_id ?? item.id ?? 0),
      toWilayaName: String(item.wilaya ?? item.name ?? ''),
      homeDeliveryPrice: Number(item.domicile ?? item.home ?? item.tarif ?? 0),
      stopDeskPrice: Number(item.stop_desk ?? item.stopdesk ?? item.bureau ?? 0),
      deliveryType: DELIVERY_TYPE.HOME,
      fromWilayaId,
    }));
    if (toWilayaId != null) rows = rows.filter((r) => r.toWilayaId === Number(toWilayaId));
    return rows;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Elogistia wraps responses in { body: … } (object or array). */
  _body(response) {
    const body = response?.body ?? response?.data ?? response;
    return Array.isArray(body) ? body[0] ?? {} : (body ?? {});
  }

  _bodyItems(response) {
    const body = response?.body ?? response?.data ?? response;
    if (Array.isArray(body)) return body.filter((r) => r && typeof r === 'object');
    if (body && typeof body === 'object') return [body];
    return [];
  }

  _hydrateOrder(raw, requestData = null) {
    const rawStatus = String(raw.status ?? raw.statut ?? raw.etat ?? '');
    return new OrderData({
      orderId: String(raw.IdCommande ?? raw.id_commande ?? requestData?.orderId ?? ''),
      trackingNumber: String(raw.tracking ?? raw.Tracking ?? ''),
      provider: PROVIDERS.ELOGISTIA,
      status: this.normalizeStatus(rawStatus),
      recipientName: String(
        raw.client ?? [raw.firstname, raw.name].filter(Boolean).join(' ')
          ?? (requestData ? `${requestData.firstName} ${requestData.lastName}` : ''),
      ),
      phone: String(raw.phone ?? requestData?.phone ?? ''),
      address: String(raw.address ?? requestData?.address ?? ''),
      toWilayaId: Number(raw.wilaya_id ?? requestData?.toWilayaId ?? 0),
      toCommune: String(raw.commune ?? requestData?.toCommune ?? ''),
      price: Number(raw.price ?? raw.montant ?? requestData?.price ?? 0),
      shippingFee: raw.fraisDeLivraison != null ? Number(raw.fraisDeLivraison) : null,
      rawStatus,
      notes: raw.remarque ?? null,
      createdAt: this.parseDate(raw.created_at ?? raw.date),
      updatedAt: this.parseDate(raw.updated_at),
      raw,
    });
  }
}
