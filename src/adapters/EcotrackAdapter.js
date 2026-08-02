import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl, getProviderRateLimits, toBool01 } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { DELIVERY_TYPE } from '../enums/DeliveryType.js';
import { OrderData } from '../data/OrderData.js';
import { RateData } from '../data/RateData.js';
import { LabelData } from '../data/LabelData.js';
import { CourierError } from '../exceptions/CourierError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

/** @type {Record<string, string>} */
const STATUS_MAP = {
  // ── Activity statuses (from /get/tracking/info) ─────────────────────────
  order_information_received_by_carrier: TRACKING_STATUS.PENDING,
  picked: TRACKING_STATUS.PICKED_UP,
  accepted_by_carrier: TRACKING_STATUS.IN_TRANSIT,
  dispatched_to_driver: TRACKING_STATUS.OUT_FOR_DELIVERY,
  attempt_delivery: TRACKING_STATUS.OUT_FOR_DELIVERY,
  return_asked: TRACKING_STATUS.RETURNING,
  return_in_transit: TRACKING_STATUS.RETURNING,
  Return_received: TRACKING_STATUS.RETURNED,
  livred: TRACKING_STATUS.DELIVERED,
  encaissed: TRACKING_STATUS.DELIVERED,
  payed: TRACKING_STATUS.DELIVERED,

  // ── Order statuses (from /get/orders) ───────────────────────────────────
  prete_a_expedier: TRACKING_STATUS.PENDING,
  en_ramassage: TRACKING_STATUS.PICKED_UP,
  en_preparation_stock: TRACKING_STATUS.PENDING,
  vers_hub: TRACKING_STATUS.IN_TRANSIT,
  en_hub: TRACKING_STATUS.IN_TRANSIT,
  vers_wilaya: TRACKING_STATUS.IN_TRANSIT,
  en_preparation: TRACKING_STATUS.PENDING,
  en_livraison: TRACKING_STATUS.OUT_FOR_DELIVERY,
  suspendu: TRACKING_STATUS.PENDING,
  livre_non_encaisse: TRACKING_STATUS.DELIVERED,
  encaisse_non_paye: TRACKING_STATUS.DELIVERED,
  paiements_prets: TRACKING_STATUS.DELIVERED,
  paye_et_archive: TRACKING_STATUS.DELIVERED,
  retour_chez_livreur: TRACKING_STATUS.RETURNING,
  retour_transit_entrepot: TRACKING_STATUS.RETURNING,
  retour_en_traitement: TRACKING_STATUS.RETURNING,
  retour_recu: TRACKING_STATUS.RETURNED,
  retour_archive: TRACKING_STATUS.RETURNED,
  annule: TRACKING_STATUS.CANCELLED,
  all: TRACKING_STATUS.UNKNOWN,

  // ── Global FR statuses (from /get/trackings/info), normalized ───────────
  pret_a_expedier: TRACKING_STATUS.PENDING,
  pret_a_preparer: TRACKING_STATUS.PENDING,
  stock_en_preparation: TRACKING_STATUS.PENDING,
  suspendus: TRACKING_STATUS.PENDING,
  retours_chez_livreur: TRACKING_STATUS.RETURNING,
  retours_en_traitement: TRACKING_STATUS.RETURNING,
  retours_prets: TRACKING_STATUS.RETURNING,
  retours_recu: TRACKING_STATUS.RETURNED,
  retours_a_dispatcher_vers_stock: TRACKING_STATUS.RETURNED,
  retours_en_transit_stock: TRACKING_STATUS.RETURNED,
  retours_en_stock: TRACKING_STATUS.RETURNED,
  retours_archive: TRACKING_STATUS.RETURNED,
  livre_encaisse_non_paye: TRACKING_STATUS.DELIVERED,
  paiement_pret: TRACKING_STATUS.DELIVERED,
  paiement_archive: TRACKING_STATUS.DELIVERED,

  // ── Legacy / generic fallbacks (accent-free variants for normalized input) ─
  created: TRACKING_STATUS.PENDING,
  pending: TRACKING_STATUS.PENDING,
  'en attente': TRACKING_STATUS.PENDING,
  en_attente: TRACKING_STATUS.PENDING,
  ready: TRACKING_STATUS.PENDING,
  picked_up: TRACKING_STATUS.PICKED_UP,
  collected: TRACKING_STATUS.PICKED_UP,
  'ramassé': TRACKING_STATUS.PICKED_UP,
  ramasse: TRACKING_STATUS.PICKED_UP,
  in_hub: TRACKING_STATUS.IN_TRANSIT,
  in_transit: TRACKING_STATUS.IN_TRANSIT,
  'en transit': TRACKING_STATUS.IN_TRANSIT,
  en_transit: TRACKING_STATUS.IN_TRANSIT,
  transferred: TRACKING_STATUS.IN_TRANSIT,
  out_for_delivery: TRACKING_STATUS.OUT_FOR_DELIVERY,
  'en cours de livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  en_cours_de_livraison: TRACKING_STATUS.OUT_FOR_DELIVERY,
  delivered: TRACKING_STATUS.DELIVERED,
  'livré': TRACKING_STATUS.DELIVERED,
  livre: TRACKING_STATUS.DELIVERED,
  delivery_failed: TRACKING_STATUS.FAILED_DELIVERY,
  failed: TRACKING_STATUS.FAILED_DELIVERY,
  'tentative échouée': TRACKING_STATUS.FAILED_DELIVERY,
  tentative_echouee: TRACKING_STATUS.FAILED_DELIVERY,
  absent: TRACKING_STATUS.FAILED_DELIVERY,
  refused: TRACKING_STATUS.FAILED_DELIVERY,
  return_initiated: TRACKING_STATUS.RETURNING,
  returning: TRACKING_STATUS.RETURNING,
  'en retour': TRACKING_STATUS.RETURNING,
  en_retour: TRACKING_STATUS.RETURNING,
  returned: TRACKING_STATUS.RETURNED,
  'retourné': TRACKING_STATUS.RETURNED,
  retourne: TRACKING_STATUS.RETURNED,
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
 * Auth: Bearer token (also passed as api_token query param where needed).
 * Rate limit: 50 req/min → 1200ms minimum gap between requests.
 */
export class EcotrackAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/TokenCredentials.js').TokenCredentials} params.credentials
   * @param {string} [params.provider] - Provider ID (defaults to PROVIDERS.ECOTRACK)
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, provider = PROVIDERS.ECOTRACK, httpClient = null, baseUrl = null }) {
    super({
      baseUrl: baseUrl ?? getBaseUrl(provider),
      defaultHeaders: {
        Authorization: `Bearer ${credentials.token}`,
      },
      httpClient,
      rateLimits: getProviderRateLimits(provider),
    });
    this.providerEnum = provider;
    this.credentials = credentials;
    this.http.defaults.params = { api_token: credentials.token };
  }

  normalizeStatus(rawStatus) {
    if (!rawStatus) return TRACKING_STATUS.UNKNOWN;
    const key = rawStatus
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_');
    return STATUS_MAP[key] ?? TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      const data = await this.get('api/v1/validate/token');
      return data?.success === true;
    } catch {
      return false;
    }
  }

  async getRates(fromWilayaId = null, toWilayaId = null) {
    const data = await this.get('api/v1/get/fees');

    const livraison = data?.livraison ?? data?.data?.livraison ?? [];
    if (!Array.isArray(livraison)) return [];

    const rates = livraison.map((item) => new RateData({
      provider: this.providerEnum,
      toWilayaId: Number(item.wilaya_id ?? 0),
      toWilayaName: String(item.wilaya_name ?? ''),
      homeDeliveryPrice: Number(item.tarif ?? 0),
      stopDeskPrice: Number(item.tarif_stopdesk ?? item.tarif ?? 0),
      deliveryType: DELIVERY_TYPE.HOME,
      fromWilayaId,
    }));

    if (toWilayaId != null) {
      return rates.filter((r) => r.toWilayaId === Number(toWilayaId));
    }

    return rates;
  }

  getCreateOrderValidationRules() {
    return {
      order_id: { required: false, type: 'string' },
      first_name: { required: true, type: 'string' },
      last_name: { required: true, type: 'string' },
      phone: { required: true, type: 'string' },
      address: { required: true, type: 'string' },
      to_wilaya_id: { required: true, type: 'integer', min: 1, max: 58 },
      to_commune: { required: true, type: 'string' },
      product_description: { required: false, type: 'string' },
      price: { required: true, type: 'number', min: 0 },
      delivery_type: { required: false, type: 'integer', enum: [1, 2] },
      weight: { required: false, type: 'number' },
    };
  }

  /**
   * Build the Ecotrack order field set shared by single + bulk creation.
   * @param {import('../data/CreateOrderData.js').CreateOrderData} data
   * @returns {Record<string, string|number>}
   */
  _buildOrderFields(data) {
    const fields = {
      nom_client: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
      telephone: String(data.phone ?? ''),
      adresse: String(data.address ?? ''),
      commune: String(data.toCommune ?? ''),
      code_wilaya: String(data.toWilayaId ?? ''),
      montant: String(data.price ?? '0'),
      type: '1',
    };

    if (data.orderId) fields.reference = String(data.orderId);
    if (data.phoneAlt) fields.telephone_2 = String(data.phoneAlt);
    if (data.notes) fields.remarque = String(data.notes);
    if (data.weight) fields.weight = String(data.weight);
    if (data.productDescription) fields.produit = String(data.productDescription);
    if (data.quantity != null && data.quantity > 0) fields.quantite = String(data.quantity);
    if (data.hasExchange && data.exchangeProduct) {
      fields.produit_a_recuperer = String(data.exchangeProduct);
      fields.type = '2';
    }
    fields.stop_desk = data.deliveryType === DELIVERY_TYPE.STOP_DESK ? '1' : '0';
    // Ecotrack supports a native fragile flag on order creation.
    if (data.fragile) fields.fragile = '1';

    return fields;
  }

  async createOrder(data) {
    const params = this._buildOrderFields(data);

    const response = await this._request('POST', 'api/v1/create/order', { params });

    if (response?.success === true && response?.tracking) {
      return this._hydrateOrder({
        tracking: response.tracking,
        reference: data.orderId ?? null,
        status: 'prete_a_expedier',
        client: params.nom_client,
        telephone: params.telephone,
        adresse: params.adresse,
        commune: params.commune,
        code_wilaya: params.code_wilaya,
        montant: params.montant,
        type_id: params.type === '2' ? 2 : 1,
        produits: params.produit ?? '',
        created_at: new Date().toISOString(),
      });
    }

    throw new CourierError(
      `${this.providerEnum} createOrder returned: ${JSON.stringify(response)}`,
    );
  }

  async getOrder(trackingNumber) {
    const response = await this.get('api/v1/get/orders', { tracking: String(trackingNumber) });

    const orders = response?.data ?? [];
    const order = Array.isArray(orders) ? orders.find(
      (o) => String(o.tracking) === String(trackingNumber)
    ) : null;

    if (!order) {
      throw new OrderNotFoundError(trackingNumber);
    }

    return this._hydrateOrder(order);
  }

  async getLabel(trackingNumber) {
    const buffer = await this.requestRaw('GET', `api/v1/get/order/label`, {
      params: { tracking: String(trackingNumber) },
    });

    if (buffer && buffer.length > 0) {
      return LabelData.fromBase64(this.providerEnum, trackingNumber, buffer.toString('base64'));
    }

    throw new CourierError(
      `${this.providerEnum} returned an empty label for [${trackingNumber}].`,
    );
  }

  /**
   * Create up to 100 orders in one native bulk call.
   * `POST /api/v1/create/orders` with body `{ orders: { "0": {...}, "1": {...} } }`.
   * Response: `{ results: { <reference>: { success, tracking } | { <field>: [errors] } } }`.
   * The doc caps a batch at 100, so we chunk and aggregate.
   *
   * @param {Array<import('../data/CreateOrderData.js').CreateOrderData>} dataArray
   * @returns {Promise<{totalRequested:number, successCount:number, failureCount:number, results:Array<{reference:string|null, success:boolean, tracking:string|null, errors:object|null}>}>}
   */
  async bulkCreateOrders(dataArray) {
    const list = Array.isArray(dataArray) ? dataArray : [dataArray];
    const MAX_PER_REQUEST = 100;

    const aggregate = {
      totalRequested: list.length,
      successCount: 0,
      failureCount: 0,
      results: [],
    };

    for (let offset = 0; offset < list.length; offset += MAX_PER_REQUEST) {
      const chunk = list.slice(offset, offset + MAX_PER_REQUEST);

      const orders = {};
      chunk.forEach((data, i) => {
        orders[String(i)] = this._buildOrderFields(data);
      });

      const response = await this.post('api/v1/create/orders', { orders });
      const results = response?.results ?? {};

      for (const [reference, value] of Object.entries(results)) {
        if (value && value.success === true && value.tracking) {
          aggregate.successCount += 1;
          aggregate.results.push({
            reference,
            success: true,
            tracking: String(value.tracking),
            errors: null,
          });
        } else {
          aggregate.failureCount += 1;
          aggregate.results.push({
            reference,
            success: false,
            tracking: null,
            errors: value ?? null,
          });
        }
      }
    }

    return aggregate;
  }

  /**
   * Delete (cancel) an order — only possible before it is validated/shipped.
   * `DELETE /api/v1/delete/order?tracking={tracking}`.
   * @param {string} trackingNumber
   * @returns {Promise<boolean>}
   */
  async cancelOrder(trackingNumber) {
    const response = await this._request('DELETE', 'api/v1/delete/order', {
      params: { tracking: String(trackingNumber) },
    });

    if (response?.success === true) return true;

    throw new CourierError(
      `${this.providerEnum} could not delete [${trackingNumber}]: ` +
      `${response?.message ?? JSON.stringify(response)}`,
      response?.error ?? 0,
    );
  }

  /**
   * Ship (validate) an order. After this the order can no longer be edited or
   * deleted. `POST /api/v1/valid/order?tracking={tracking}&ask_collection={0|1}`.
   *
   * @param {string} trackingNumber
   * @param {object} [opts]
   * @param {boolean} [opts.askCollection] - request a pickup (default false)
   * @returns {Promise<boolean>}
   */
  async shipOrder(trackingNumber, { askCollection = false } = {}) {
    const response = await this._request('POST', 'api/v1/valid/order', {
      params: {
        tracking: String(trackingNumber),
        ask_collection: askCollection ? 1 : 0,
      },
    });

    if (response?.success === true) return true;

    throw new CourierError(
      `${this.providerEnum} could not ship [${trackingNumber}]: ` +
      `${response?.message ?? JSON.stringify(response)}`,
      response?.error ?? 0,
    );
  }

  /**
   * List deliverable wilayas.
   * `GET /api/v1/get/wilayas` → `[{ wilaya_id, wilaya_name }]`.
   * @returns {Promise<Array<{id:number, name:string}>>}
   */
  /**
   * Bulk status lookup — the official cron-friendly endpoint.
   * `GET /api/v1/get/orders/status?trackings=a,b&status=all` (max 100/req).
   * Returns a map keyed by tracking: { status, order_id, activity, ... }.
   *
   * @param {string[]} trackingNumbers
   * @param {string[]} [statuses] - filter (official slugs); default 'all'
   * @returns {Promise<Record<string, object>>}
   */
  async getOrdersStatus(trackingNumbers, statuses = ['all']) {
    const list = (Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers]).filter(Boolean);
    const out = {};
    for (let offset = 0; offset < list.length; offset += 100) {
      const chunk = list.slice(offset, offset + 100);
      const response = await this.get('api/v1/get/orders/status', {
        trackings: chunk.join(','),
        status: (statuses ?? ['all']).join(','),
      });
      Object.assign(out, response?.data ?? {});
    }
    return out;
  }

  /**
   * Tracking history for ONE parcel (`GET /api/v1/get/tracking/info`).
   * @param {string} trackingNumber
   * @returns {Promise<object>} { recipientName, shippedBy, activity: [...] }
   */
  async getTrackingHistory(trackingNumber) {
    return this.get('api/v1/get/tracking/info', { tracking: String(trackingNumber) });
  }

  /**
   * Tracking history for SEVERAL parcels
   * (`GET /api/v1/get/trackings/info?trackings[]=…`, max 100/req).
   * @param {string[]} trackingNumbers
   * @returns {Promise<object>} map keyed by tracking
   */
  async getTrackingHistories(trackingNumbers) {
    const list = (Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers]).filter(Boolean);
    const out = {};
    for (let offset = 0; offset < list.length; offset += 100) {
      const chunk = list.slice(offset, offset + 100);
      const response = await this.get('api/v1/get/trackings/info', { 'trackings[]': chunk });
      Object.assign(out, response?.data ?? response ?? {});
    }
    return out;
  }

  /**
   * Confirm the physical reception of returned parcels
   * (`POST /api/v1/valid/returns { trackings }` → { returned: 'success'|'fail' }).
   * @param {string[]} trackingNumbers
   * @returns {Promise<boolean>} true when at least the batch was accepted
   */
  async validateReturns(trackingNumbers) {
    const trackings = (Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers]).filter(Boolean);
    const response = await this.post('api/v1/valid/returns', { trackings });
    return response?.returned === 'success';
  }

  /**
   * Ask the carrier to return a parcel that is out for delivery
   * (`POST /api/v1/ask/for/order/return?tracking=`). The carrier MAY ignore it.
   * @param {string} trackingNumber
   * @returns {Promise<boolean>}
   */
  async askReturn(trackingNumber) {
    const response = await this._request('POST', 'api/v1/ask/for/order/return', {
      params: { tracking: String(trackingNumber) },
    });
    if (response?.success === false) {
      throw new CourierError(
        `Ecotrack askReturn refused for [${trackingNumber}]: ${response?.message ?? 'unknown'}`,
      );
    }
    return true;
  }

  /**
   * Update an order before it is shipped
   * (`POST /api/v1/update/order?tracking=` + Ecotrack fields: client, tel,
   * adresse, commune, wilaya, montant, remarque, product, type, stop_desk,
   * fragile, gps_link…). Fails with error 10001 once the order is validated.
   * @param {string} trackingNumber
   * @param {object} fields
   */
  async updateOrder(trackingNumber, fields = {}) {
    const response = await this._request('POST', 'api/v1/update/order', {
      params: { tracking: String(trackingNumber), ...fields },
    });
    if (response?.success === false) {
      throw new CourierError(
        `Ecotrack updateOrder failed for [${trackingNumber}]: ${response?.message ?? 'unknown'}`,
        Number(response?.error ?? 0),
      );
    }
    return response;
  }

  /**
   * Append a note to a shipped parcel (`POST /api/v1/add/maj?tracking=&content=`).
   * @param {string} trackingNumber
   * @param {string} content - max 255 chars
   */
  async addNote(trackingNumber, content) {
    return this._request('POST', 'api/v1/add/maj', {
      params: { tracking: String(trackingNumber), content: String(content).slice(0, 255) },
    });
  }

  /** Notes/updates applied to a parcel (`GET /api/v1/get/maj?tracking=`). */
  async getNotes(trackingNumber) {
    const response = await this.get('api/v1/get/maj', { tracking: String(trackingNumber) });
    return Array.isArray(response) ? response : (response?.data ?? []);
  }

  async getWilayas() {
    const response = await this.get('api/v1/get/wilayas');
    const rows = Array.isArray(response) ? response : (response?.data ?? []);
    if (!Array.isArray(rows)) return [];
    return rows.map((w) => ({
      id: Number(w.wilaya_id ?? 0),
      name: String(w.wilaya_name ?? ''),
    }));
  }

  /**
   * List deliverable communes, optionally filtered to a wilaya.
   * `GET /api/v1/get/communes?wilaya_id={id}`. The response is an object keyed
   * by numeric index: `{ "0": { nom, wilaya_id, code_postal, has_stop_desk } }`.
   *
   * @param {number|string|null} [wilayaId]
   * @returns {Promise<Array<{name:string, wilayaId:number, zipCode:string|null, hasStopDesk:boolean}>>}
   */
  async getCommunes(wilayaId = null) {
    const params = {};
    if (wilayaId != null) params.wilaya_id = Number(wilayaId);

    const response = await this.get('api/v1/get/communes', params);
    // Object keyed by index, or an array depending on the deployment.
    const rows = Array.isArray(response) ? response : Object.values(response ?? {});

    return rows
      .filter((c) => c && typeof c === 'object')
      .map((c) => ({
        name: String(c.nom ?? c.name ?? ''),
        wilayaId: Number(c.wilaya_id ?? wilayaId ?? 0),
        zipCode: c.code_postal != null ? String(c.code_postal) : null,
        hasStopDesk: toBool01(c.has_stop_desk),
      }));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _hydrateOrder(raw) {
    const rawStatus = String(raw.status ?? '');
    const fullName = String(raw.client ?? raw.nom_client ?? raw.recipientName ?? '');
    return new OrderData({
      orderId: String(raw.reference ?? raw.order_id ?? ''),
      trackingNumber: String(raw.tracking ?? raw.barcode ?? raw.id ?? ''),
      provider: this.providerEnum,
      status: this.normalizeStatus(rawStatus),
      recipientName: fullName,
      phone: String(raw.phone ?? raw.telephone ?? ''),
      address: String(raw.adresse ?? raw.address ?? ''),
      toWilayaId: Number(raw.wilaya_id ?? raw.code_wilaya ?? raw.destLocationCity ?? 0),
      toCommune: String(raw.commune ?? raw.to_commune ?? ''),
      price: Number(raw.montant ?? raw.cod ?? raw.price ?? 0),
      shippingFee: raw.tarif_prestation != null ? Number(raw.tarif_prestation) : null,
      rawStatus,
      notes: raw.remarque ?? raw.note ?? raw.notes ?? null,
      createdAt: this.parseDate(raw.created_at),
      updatedAt: this.parseDate(raw.updated_at ?? raw.updatedAt),
      raw,
    });
  }
}
