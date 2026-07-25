import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl, getProviderRateLimits } from '../enums/Provider.js';
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
  // ── Pending ───────────────────────────────────────────────────────────────
  commande_recue: TRACKING_STATUS.PENDING,
  orderreceived: TRACKING_STATUS.PENDING,
  en_traitement: TRACKING_STATUS.PENDING,
  inprocessing: TRACKING_STATUS.PENDING,
  appel_confirmation: TRACKING_STATUS.PENDING,
  confirmationcall: TRACKING_STATUS.PENDING,
  commande_confirmee: TRACKING_STATUS.PENDING,
  orderconfirmed: TRACKING_STATUS.PENDING,
  en_preparation: TRACKING_STATUS.PENDING,
  inpreparation: TRACKING_STATUS.PENDING,
  // ── Picked up ─────────────────────────────────────────────────────────────
  pret_a_expedier: TRACKING_STATUS.PICKED_UP,
  readytodispatch: TRACKING_STATUS.PICKED_UP,
  // ── In transit ────────────────────────────────────────────────────────────
  confirme_au_bureau: TRACKING_STATUS.IN_TRANSIT,
  confirmedatbranch: TRACKING_STATUS.IN_TRANSIT,
  dispatch: TRACKING_STATUS.IN_TRANSIT,
  dispatched: TRACKING_STATUS.IN_TRANSIT,
  vers_wilaya: TRACKING_STATUS.IN_TRANSIT,
  interwilayatransit: TRACKING_STATUS.IN_TRANSIT,
  en_livraison: TRACKING_STATUS.IN_TRANSIT,
  indelivery: TRACKING_STATUS.IN_TRANSIT,
  // ── Out for delivery ──────────────────────────────────────────────────────
  sortie_en_livraison: TRACKING_STATUS.OUT_FOR_DELIVERY,
  outfordelivery: TRACKING_STATUS.OUT_FOR_DELIVERY,
  // ── Delivered ─────────────────────────────────────────────────────────────
  livre: TRACKING_STATUS.DELIVERED,
  delivered: TRACKING_STATUS.DELIVERED,
  encaisse: TRACKING_STATUS.DELIVERED,
  collected: TRACKING_STATUS.DELIVERED,
  recouvert: TRACKING_STATUS.DELIVERED,
  // ── Failed delivery ───────────────────────────────────────────────────────
  echec_livraison: TRACKING_STATUS.FAILED_DELIVERY,
  faileddelivery: TRACKING_STATUS.FAILED_DELIVERY,
  delivery_failed: TRACKING_STATUS.FAILED_DELIVERY,
  commande_annulee: TRACKING_STATUS.FAILED_DELIVERY,
  orderrefused: TRACKING_STATUS.FAILED_DELIVERY,
  // ── Returning ─────────────────────────────────────────────────────────────
  retour: TRACKING_STATUS.RETURNING,
  returning: TRACKING_STATUS.RETURNING,
  en_retour: TRACKING_STATUS.RETURNING,
  inreturn: TRACKING_STATUS.RETURNING,
  // ── Returned ──────────────────────────────────────────────────────────────
  retourne: TRACKING_STATUS.RETURNED,
  returned: TRACKING_STATUS.RETURNED,
  retour_confirme: TRACKING_STATUS.RETURNED,
  returnconfirmed: TRACKING_STATUS.RETURNED,
  reinjecte_stock: TRACKING_STATUS.RETURNED,
  // ── Cancelled ─────────────────────────────────────────────────────────────
  annule: TRACKING_STATUS.CANCELLED,
  cancelled: TRACKING_STATUS.CANCELLED,
  // ── Ready for pickup ──────────────────────────────────────────────────────
  disponible_bureau: TRACKING_STATUS.READY_FOR_PICKUP,
  readyforpickup: TRACKING_STATUS.READY_FOR_PICKUP,
  en_attente_client: TRACKING_STATUS.READY_FOR_PICKUP,
  waitingclient: TRACKING_STATUS.READY_FOR_PICKUP,
  // ── Exception ─────────────────────────────────────────────────────────────
  en_attente_echange: TRACKING_STATUS.EXCEPTION,
  remboursement: TRACKING_STATUS.EXCEPTION,
};

/**
 * Adapter for the ZR Express NEW platform (api.zrexpress.app, v1).
 *
 * This is a fully redesigned API — shares nothing with the legacy Procolis adapter.
 *
 * Auth: X-Tenant: {tenantId}  +  X-Api-Key: {apiKey}  (two separate headers)
 *
 * createOrder() two-step flow:
 *   POST /api/v1/parcels returns only {"id": "uuid"}.
 *   The adapter immediately calls GET /api/v1/parcels/{id} to return full OrderData.
 *
 * Territory UUIDs for createOrder():
 *   Pass city/district UUIDs in the notes field:
 *     "zr_district:{uuid}|Optional note"
 *     "zr_city:{uuid}|zr_district:{uuid}|Optional note"
 *
 * getLabel():
 *   Returns HTML_URL (Azure Blob SAS URL — expires after a short time).
 */
export class ZrExpressNewAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/ZrExpressNewCredentials.js').ZrExpressNewCredentials} params.credentials
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(PROVIDERS.ZREXPRESS_NEW),
      defaultHeaders: {
        'X-Tenant': credentials.tenantId,
        'X-Api-Key': credentials.apiKey,
      },
      httpClient,
      rateLimits: getProviderRateLimits(PROVIDERS.ZREXPRESS_NEW),
    });
    this.providerEnum = PROVIDERS.ZREXPRESS_NEW;
    this.credentials = credentials;
  }

  normalizeStatus(rawStatus) {
    const key = rawStatus.toLowerCase().trim();
    if (STATUS_MAP[key]) return STATUS_MAP[key];
    // Try without underscores to handle PascalCase API responses
    const keyNoUnderscore = key.replace(/_/g, '');
    return STATUS_MAP[keyNoUnderscore] ?? TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      await this.post('api/v1/workflows/search', { pageNumber: 1, pageSize: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get effective delivery rates for ALL destination territories.
   *
   * ZR Express NEW prices PER COMMUNE (and per wilaya). The endpoint returns a
   * mix of commune-level and wilaya-level entries, each with a delivery price
   * for `home`, `pickup-point` and `return`. We keep every level faithfully and
   * expose the territory UUID + level so the template (Phase 2/3) can store
   * commune-level rows and resolve their parent wilaya via getTerritories().
   *
   * `toWilayaId` filters by territory `code` when provided (matches commune or
   * wilaya entries having that code); `fromWilayaId` is irrelevant to this API.
   */
  async getRates(fromWilayaId = null, toWilayaId = null) {
    const response = await this.get('api/v1/delivery-pricing/rates');
    const rates = response.rates ?? [];

    if (!Array.isArray(rates) || rates.length === 0) return [];

    const result = [];

    for (const rate of rates) {
      if (!rate || typeof rate !== 'object') continue;

      const level = String(rate.toTerritoryLevel ?? '').toLowerCase();
      const code = Number(rate.toTerritoryCode ?? 0);

      if (toWilayaId != null && code !== Number(toWilayaId)) continue;

      let homePrice = 0;
      let stopDeskPrice = 0;
      let returnPrice = null;

      for (const dp of rate.deliveryPrices ?? []) {
        const type = String(dp.deliveryType ?? '').toLowerCase();
        const price = Number(dp.price ?? 0);
        if (type === 'home') homePrice = price;
        else if (type === 'pickup-point') stopDeskPrice = price;
        else if (type === 'return') returnPrice = price;
      }

      result.push(new RateData({
        provider: PROVIDERS.ZREXPRESS_NEW,
        toWilayaId: code,
        toWilayaName: String(rate.toTerritoryName ?? ''),
        toWilayaNameAr: rate.toTerritoryNameArabic ?? null,
        homeDeliveryPrice: homePrice,
        stopDeskPrice,
        returnPrice,
        deliveryType: DELIVERY_TYPE.HOME,
        fromWilayaId,
        hasCommunePricing: true,
        territoryId: rate.toTerritoryId ?? null,
        territoryLevel: level || null,
      }));
    }

    return result;
  }

  /**
   * Retrieve territories (wilayas and/or communes), paginated.
   * Each item carries: id (UUID), code (int), name, nameArabic, level,
   * parentId (UUID, commune→wilaya), and delivery capability flags.
   *
   * @param {object} [opts]
   * @param {string|null} [opts.level] - 'wilaya' or 'commune' to filter
   * @param {string|null} [opts.parentId] - parent wilaya UUID (to list its communes)
   * @param {number} [opts.pageSize]
   * @returns {Promise<Array<{id:string, code:number, name:string, nameArabic:string|null, level:string, parentId:string|null, hasHomeDelivery:boolean, hasPickupPoint:boolean}>>}
   */
  async getTerritories({ level = null, parentId = null, pageSize = 1000 } = {}) {
    const filters = [];
    if (level) filters.push({ field: 'level', operator: 'eq', value: level });
    if (parentId) filters.push({ field: 'parentId', operator: 'eq', value: parentId });

    const body = { pageNumber: 1, pageSize, orderBy: ['code asc'] };
    if (filters.length > 0) body.advancedFilter = { logic: 'and', filters };

    const out = [];
    let pageNumber = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await this.post('api/v1/territories/search', { ...body, pageNumber });
      const items = res?.items ?? [];
      for (const t of items) {
        out.push({
          id: t.id,
          code: Number(t.code ?? 0),
          name: String(t.name ?? ''),
          nameArabic: t.nameArabic ?? null,
          level: String(t.level ?? ''),
          parentId: t.parentId ?? null,
          hasHomeDelivery: Boolean(this.dig(t, 'delivery', 'hasHomeDelivery')),
          hasPickupPoint: Boolean(this.dig(t, 'delivery', 'hasPickupPoint')),
        });
      }
      if (!res?.hasNext) break;
      pageNumber += 1;
    }
    return out;
  }

  /**
   * List hubs, optionally only pickup points (stop-desks). Paginated.
   * `POST /api/v1/hubs/search`. Each hub carries: id (UUID — the `hubId` used on
   * createOrder), name, type, isPickupPoint, address (with city/district +
   * territory UUIDs + coordinates), phone, openingHours.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.pickupOnly=true] - keep only pickup-point hubs
   * @param {number} [opts.pageSize]
   * @returns {Promise<Array<{id:string, name:string, isPickupPoint:boolean, cityName:string, communeName:string, cityTerritoryId:string|null, districtTerritoryId:string|null, address:string, phones:string[], map:string|null, openingHours:string|null}>>}
   */
  async getOffices({ pickupOnly = true, pageSize = 1000 } = {}) {
    const out = [];
    let pageNumber = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await this.post('api/v1/hubs/search', { pageNumber, pageSize, includeServices: false });
      for (const h of res?.items ?? []) {
        if (pickupOnly && !h.isPickupPoint) continue;
        const addr = h.address ?? {};
        const coords = addr.coordinates ?? {};
        out.push({
          id: h.id,
          name: String(h.name ?? ''),
          isPickupPoint: Boolean(h.isPickupPoint),
          cityName: String(addr.city ?? ''),
          communeName: String(addr.district ?? ''),
          cityTerritoryId: addr.cityTerritoryId ?? null,
          districtTerritoryId: addr.districtTerritoryId ?? null,
          address: String(addr.street ?? ''),
          phones: [h.phone?.number1, h.phone?.number2, h.phone?.number3].filter(Boolean).map(String),
          map: (coords.lat != null && coords.lng != null) ? `${coords.lat},${coords.lng}` : null,
          openingHours: h.openingHours ? String(h.openingHours) : null,
        });
      }
      if (!res?.hasNext) break;
      pageNumber += 1;
    }
    return out;
  }

  getCreateOrderValidationRules() {
    return {
      order_id: { required: true, type: 'string', maxLength: 100 },
      first_name: { required: true, type: 'string', maxLength: 100 },
      last_name: { required: true, type: 'string', maxLength: 100 },
      phone: { required: true, type: 'string' },
      address: { required: false, type: 'string', maxLength: 500 },
      to_wilaya_id: { required: false, type: 'integer', min: 1, max: 58 },
      to_commune: { required: false, type: 'string' },
      product_description: { required: true, type: 'string', minLength: 2, maxLength: 250 },
      price: { required: true, type: 'number', min: 0, max: 150000 },
      delivery_type: { required: true, type: 'integer', enum: [1, 2] },
      phone_alt: { required: false, type: 'string' },
      weight: { required: false, type: 'number', min: 0 },
      /**
       * Provide territory UUIDs in notes:
       *   "zr_district:{uuid}|optional note"
       *   "zr_city:{uuid}|zr_district:{uuid}|optional note"
       */
      notes: { required: false, type: 'string' },
    };
  }

  /**
   * Create a new parcel.
   *
   * The city UUID is resolved from notes via "zr_city:{uuid}".
   * The district (commune) UUID must be provided as "zr_district:{uuid}".
   */
  async createOrder(data) {
    const payload = this._buildParcelPayload(data);
    await this._applyReadyToDispatchState(payload);

    const response = await this.post('api/v1/parcels', payload);
    const parcelId = response.id ?? null;

    if (!parcelId) {
      throw new CourierError('ZR Express NEW did not return a parcel ID after creation.');
    }

    // Two-step: fetch the full parcel resource after creation
    return this.getOrder(parcelId);
  }

  /**
   * Without an explicit `stateId`, ZR creates the parcel in `OrderReceived`,
   * a state the hub never picks up — the parcel silently goes nowhere
   * (documented trap: "Il devra ensuite etre mis a jour en ReadyToDispatch
   * pour que le hub l'accepte"). We resolve the `ReadyToDispatch` state id
   * once via `workflows/search`, cache it, and stamp it on every parcel.
   * If the lookup fails the parcel is still created (default state) so a
   * transient workflows error never blocks dispatch.
   */
  async _applyReadyToDispatchState(payload) {
    if (payload.stateId) return; // explicit override wins
    if (this._readyStateId === undefined) {
      try {
        const res = await this.post('api/v1/workflows/search', { pageNumber: 1, pageSize: 100 });
        const items = res?.items ?? res?.data ?? [];
        const states = items.flatMap((w) => w?.states ?? w?.workflowStates ?? [w]);
        const ready = states.find((st) => {
          const name = String(st?.name ?? '').toLowerCase().replace(/[\s_-]/g, '');
          return name === 'readytodispatch';
        });
        this._readyStateId = ready?.id ?? null;
      } catch {
        this._readyStateId = null;
      }
    }
    if (this._readyStateId) payload.stateId = this._readyStateId;
  }

  /**
   * Build the SingleParcelCreationRequest payload for one order.
   *
   * Requires city + district territory UUIDs (ZR Express NEW keys delivery
   * addresses by opaque territory UUIDs, never by wilaya code). They are read
   * from CreateOrderData.notes via "zr_city:{uuid}|zr_district:{uuid}|...".
   *
   * @param {import('../data/CreateOrderData.js').CreateOrderData} data
   * @returns {object} SingleParcelCreationRequest
   */
  _buildParcelPayload(data) {
    const [cityTerritoryId, districtTerritoryId, , hubId] = this._parseTerritoryIds(
      data.notes,
      data.toWilayaId,
    );

    if (!districtTerritoryId) {
      throw new CourierError(
        'ZR Express NEW requires a district territory UUID. ' +
        'Pass it via notes: "zr_district:{uuid}|..."',
      );
    }

    if (!cityTerritoryId) {
      throw new CourierError(
        'ZR Express NEW requires a city territory UUID. ' +
        'Pass it via notes: "zr_city:{uuid}|zr_district:{uuid}|..."',
      );
    }

    // ZR requires the merchant's SOURCE hub id on every parcel. It is passed via
    // notes ("zr_hub:{uuid}") or, for a pickup-point delivery, falls back to the
    // chosen destination hub in stopDeskId.
    const sourceHubId = hubId
      ?? (data.deliveryType === DELIVERY_TYPE.STOP_DESK ? data.stopDeskId : null);

    if (!sourceHubId) {
      throw new CourierError(
        'ZR Express NEW requires a hub id. Configure the ZR source hub for the ' +
        'store and pass it via notes: "zr_hub:{uuid}|...".',
      );
    }

    const payload = {
      hubId: String(sourceHubId),
      customer: {
        customerId: this._randomUuid(),
        name: `${data.firstName} ${data.lastName}`.trim(),
        phone: {
          number1: this._intlPhone(data.phone),
          number2: this._intlPhone(data.phoneAlt),
        },
      },
      deliveryAddress: {
        cityTerritoryId,
        districtTerritoryId,
        street: data.address || null,
      },
      orderedProducts: [
        {
          productName: data.productDescription,
          unitPrice: data.price,
          quantity: 1,
          stockType: 'none',
        },
      ],
      deliveryType: data.deliveryType === DELIVERY_TYPE.STOP_DESK ? 'pickup-point' : 'home',
      description: data.productDescription,
      amount: data.price,
      externalId: data.orderId,
    };

    if (data.weight != null) {
      payload.weight = { weight: data.weight };
    }

    if (data.length != null || data.width != null || data.height != null) {
      payload.orderedProducts[0].length = data.length;
      payload.orderedProducts[0].width = data.width;
      payload.orderedProducts[0].height = data.height;
    }

    return payload;
  }

  /**
   * Create multiple parcels in a single native bulk call.
   *
   * ZR Express NEW caps a bulk request at 100 parcels (documented), so we chunk
   * the input and aggregate the per-item successes/failures across chunks.
   *
   * @param {Array<import('../data/CreateOrderData.js').CreateOrderData>} dataArray
   * @returns {Promise<{totalRequested:number, successCount:number, failureCount:number, successes:Array, failures:Array}>}
   */
  async bulkCreateOrders(dataArray) {
    const list = Array.isArray(dataArray) ? dataArray : [dataArray];
    const MAX_PER_REQUEST = 100;

    const aggregate = {
      totalRequested: list.length,
      successCount: 0,
      failureCount: 0,
      successes: [],
      failures: [],
    };

    for (let offset = 0; offset < list.length; offset += MAX_PER_REQUEST) {
      const chunk = list.slice(offset, offset + MAX_PER_REQUEST);
      const parcels = chunk.map((data) => this._buildParcelPayload(data));
      for (const parcel of parcels) await this._applyReadyToDispatchState(parcel);

      const res = await this.post('api/v1/parcels/bulk', { parcels });

      // Re-base the per-item index onto the original array position.
      for (const s of res?.successes ?? []) {
        aggregate.successes.push({ ...s, index: offset + Number(s.index ?? 0) });
        aggregate.successCount += 1;
      }
      for (const f of res?.failures ?? []) {
        aggregate.failures.push({ ...f, index: offset + Number(f.index ?? 0) });
        aggregate.failureCount += 1;
      }
    }

    return aggregate;
  }

  async getOrder(trackingNumber) {
    try {
      const response = await this.get(`api/v1/parcels/${trackingNumber}`);

      if (!response || Object.keys(response).length === 0 || response.title) {
        throw new OrderNotFoundError(trackingNumber);
      }

      return this._hydrateOrder(response);
    } catch (err) {
      if (err instanceof OrderNotFoundError) throw err;
      throw new OrderNotFoundError(trackingNumber, err);
    }
  }

  /**
   * Cancel a parcel.
   * If trackingNumber is not a UUID, resolves the internal UUID via getOrder() first.
   */
  async cancelOrder(trackingNumber) {
    const parcelId = this._isUuid(trackingNumber)
      ? trackingNumber
      : await this._resolveParcelId(trackingNumber);

    const response = await this.delete(`api/v1/parcels/${parcelId}`);
    return response.id != null || Object.keys(response).length === 0;
  }

  /**
   * Delete multiple parcels by their internal UUIDs (native bulk).
   * Capped at 200 per request (documented); chunked otherwise.
   *
   * @param {string[]} parcelIds
   * @returns {Promise<{totalRequested:number, deletedCount:number, results:Array}>}
   */
  async bulkDeleteByIds(parcelIds) {
    const ids = (Array.isArray(parcelIds) ? parcelIds : [parcelIds]).map(String);
    return this._bulkDeleteChunked('api/v1/parcels/bulk', 'parcelIds', ids, 200);
  }

  /**
   * Delete multiple parcels by their tracking numbers (native bulk).
   * Capped at 200 per request (documented); chunked otherwise.
   *
   * @param {string[]} trackingNumbers
   * @returns {Promise<{totalRequested:number, deletedCount:number, results:Array}>}
   */
  async bulkDeleteByTracking(trackingNumbers) {
    const list = (Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers]).map(String);
    return this._bulkDeleteChunked(
      'api/v1/parcels/bulk/by-tracking-number',
      'trackingNumbers',
      list,
      200,
    );
  }

  /**
   * Move a parcel to a new workflow state ("ship"/dispatch it manually).
   *
   * @param {string} trackingOrId - tracking number or internal UUID
   * @param {number} newStateId - target workflow state ID
   * @param {object} [opts]
   * @param {string|null} [opts.comment] - optional note recorded with the transition
   * @param {string|null} [opts.deliveryPersonId]
   * @param {string|null} [opts.arrivalHubId]
   * @returns {Promise<boolean>} true when the transition was accepted
   */
  async shipOrder(trackingOrId, newStateId, opts = {}) {
    const parcelId = this._isUuid(String(trackingOrId))
      ? String(trackingOrId)
      : await this._resolveParcelId(trackingOrId);

    const body = { parcelId, newStateId };
    if (opts.comment != null) body.comment = opts.comment;
    if (opts.deliveryPersonId != null) body.deliveryPersonId = opts.deliveryPersonId;
    if (opts.arrivalHubId != null) body.arrivalHubId = opts.arrivalHubId;

    const response = await this.patch(`api/v1/parcels/${parcelId}/state`, body);
    return response == null || response.id != null || Object.keys(response).length === 0;
  }

  /**
   * Get a shipping label HTML URL (Azure Blob SAS — download promptly, it expires).
   */
  async getLabel(trackingNumber) {
    const response = await this.post(
      'api/v1/parcels/labels/individual',
      { trackingNumbers: [trackingNumber] },
      { Authorization: `Bearer ${this.credentials.apiKey}` },
    );

    const labelFiles = response.parcelLabelFiles ?? [];
    const failed = response.failedTrackingNumbers ?? [];

    if (failed.includes(trackingNumber)) {
      throw new CourierError(
        `ZR Express NEW could not generate a label for [${trackingNumber}].`,
      );
    }

    if (labelFiles.length === 0) {
      throw new CourierError(
        `ZR Express NEW returned no label for [${trackingNumber}].`,
      );
    }

    const fileUrl = String(labelFiles[0].fileUrl ?? '');

    if (!fileUrl) {
      throw new CourierError(
        `ZR Express NEW returned an empty label URL for [${trackingNumber}].`,
      );
    }

    return new LabelData({
      provider: PROVIDERS.ZREXPRESS_NEW,
      trackingNumber,
      type: LABEL_TYPE.HTML_URL,
      url: fileUrl,
    });
  }

  // ─── Webhooks (supplier endpoints, paths from the Vargo integration) ──────

  /**
   * Register a webhook endpoint — ZR Express pushes shipment events to it.
   * `POST api/v1/webhooks/endpoints` — { url, events? }.
   *
   * @param {string} url - Public HTTPS endpoint of your app
   * @param {string[]|null} [events] - Optional event filter (e.g. ['shipment.delivered'])
   * @returns {Promise<object>} raw ZR response (includes the endpoint id)
   */
  async createWebhook(url, events = null) {
    const payload = { url };
    if (Array.isArray(events) && events.length > 0) payload.events = events;
    return this.post('api/v1/webhooks/endpoints', payload);
  }

  /** List registered webhook endpoints. */
  async listWebhooks() {
    const response = await this.get('api/v1/webhooks/endpoints');
    const items = response?.data ?? response?.items ?? response;
    return Array.isArray(items) ? items : [items].filter(Boolean);
  }

  /** Get one webhook endpoint by id. */
  async getWebhook(endpointId) {
    return this.get(`api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`);
  }

  /** Update a webhook endpoint (e.g. change its URL or events). */
  async updateWebhook(endpointId, fields) {
    return this.put(`api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`, fields);
  }

  /** Delete a webhook endpoint. */
  async deleteWebhook(endpointId) {
    await this.delete(`api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`);
    return true;
  }

  /** Signing secret for a webhook endpoint — verify incoming payloads with it. */
  async getWebhookSecret(endpointId) {
    return this.get(`api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}/secret`);
  }

  /** Custom headers configured on a webhook endpoint. */
  async getWebhookHeaders(endpointId) {
    return this.get(`api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}/headers`);
  }

  /**
   * Search for a territory UUID by name and level (ZR Express NEW–specific).
   *
   * @param {string} name - Territory name to search
   * @param {string} [level] - 'wilaya' or 'commune'
   * @param {string|null} [parentId] - UUID of the parent territory
   * @returns {Promise<string|null>} UUID of the territory if found
   */
  async searchTerritory(name, level = 'wilaya', parentId = null) {
    const filters = [
      { field: 'name', operator: 'eq', value: name },
      { field: 'level', operator: 'eq', value: level },
    ];

    if (parentId) {
      filters.push({ field: 'parentId', operator: 'eq', value: parentId });
    }

    const payload = {
      advancedFilter: { logic: 'and', filters },
      pageNumber: 1,
      pageSize: 1,
    };

    try {
      const response = await this.post('api/v1/territories/search', payload);
      return response?.items?.[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Parse territory UUIDs from the notes field.
   *
   * Supported formats:
   *   "zr_district:{uuid}|optional note"
   *   "zr_city:{uuid}|zr_district:{uuid}|optional note"
   *
   * @param {string|null} notes
   * @param {number|string|null} toWilayaId
   * @returns {[string|null, string|null, string|null]} [cityId, districtId, cleanNote]
   */
  _parseTerritoryIds(notes, toWilayaId = null) {
    let cityId = null;
    let districtId = null;
    let hubId = null;
    const remaining = [];

    for (const segment of String(notes ?? '').split('|')) {
      const s = segment.trim();
      if (s.startsWith('zr_city:')) {
        cityId = s.slice('zr_city:'.length).trim() || null;
      } else if (s.startsWith('zr_district:')) {
        districtId = s.slice('zr_district:'.length).trim() || null;
      } else if (s.startsWith('zr_hub:')) {
        hubId = s.slice('zr_hub:'.length).trim() || null;
      } else if (s !== '') {
        remaining.push(s);
      }
    }

    // Auto-resolve: if toWilayaId is already a UUID string, use it as cityId
    if (cityId == null && toWilayaId != null && this._isUuid(String(toWilayaId))) {
      cityId = String(toWilayaId);
      if (districtId == null) districtId = cityId;
    }

    return [
      cityId || null,
      districtId || null,
      remaining.length > 0 ? remaining.join(' | ') : null,
      hubId || null,
    ];
  }

  /**
   * Normalize an Algerian phone number to the international E.164 form ZR
   * requires (e.g. "0550112233" → "+213550112233"). Returns null for empties.
   * @param {string|null} phone
   * @returns {string|null}
   */
  _intlPhone(phone) {
    if (phone == null || phone === '') return null;
    let digits = String(phone).replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    digits = digits.replace(/\D/g, '');
    if (digits.startsWith('00213')) return `+${digits.slice(2)}`;
    if (digits.startsWith('213')) return `+${digits}`;
    if (digits.startsWith('0')) return `+213${digits.slice(1)}`;
    if (digits.length === 9) return `+213${digits}`; // local without leading 0
    return `+${digits}`;
  }

  /**
   * Generic chunked bulk-delete helper.
   * Sends DELETE {path} with body { [bodyKey]: chunk } in chunks of `max`,
   * aggregating the per-item results the API returns.
   *
   * @param {string} path
   * @param {string} bodyKey - 'parcelIds' or 'trackingNumbers'
   * @param {string[]} values
   * @param {number} max - max items per request
   * @returns {Promise<{totalRequested:number, deletedCount:number, results:Array}>}
   */
  async _bulkDeleteChunked(path, bodyKey, values, max) {
    const aggregate = { totalRequested: values.length, deletedCount: 0, results: [] };

    for (let offset = 0; offset < values.length; offset += max) {
      const chunk = values.slice(offset, offset + max);
      const res = await this.delete(path, {}, { [bodyKey]: chunk });

      // Different deployments return slightly different shapes; normalise both.
      const items = res?.results ?? res?.deleted ?? [];
      if (Array.isArray(items) && items.length > 0) {
        for (const r of items) {
          aggregate.results.push(r);
          if (r?.success !== false) aggregate.deletedCount += 1;
        }
      } else {
        // No per-item payload → assume the whole chunk succeeded (2xx).
        aggregate.deletedCount += chunk.length;
        for (const v of chunk) aggregate.results.push({ id: v, success: true });
      }
    }

    return aggregate;
  }

  async _resolveParcelId(trackingNumber) {
    const order = await this.getOrder(trackingNumber);
    const id = order.raw?.id ?? null;
    if (!id) throw new OrderNotFoundError(trackingNumber);
    return String(id);
  }

  _isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  _randomUuid() {
    // Use crypto.randomUUID() if available (Node 15.6+), otherwise polyfill
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Simple polyfill
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  _hydrateOrder(raw) {
    const stateName = String(this.dig(raw, 'state', 'name') ?? '');
    const status = this.normalizeStatus(stateName);

    const wilayaCode = Number(this.dig(raw, 'deliveryAddress', 'cityTerritoryCode') ?? 0);
    const commune = String(this.dig(raw, 'deliveryAddress', 'district') ?? '');
    const city = String(this.dig(raw, 'deliveryAddress', 'city') ?? '');
    const customerName = String(this.dig(raw, 'customer', 'name') ?? '');
    const phone = String(this.dig(raw, 'customer', 'phone', 'number1') ?? '');
    const situationName = this.dig(raw, 'situation', 'name');

    return new OrderData({
      orderId: String(raw.externalId ?? ''),
      trackingNumber: String(raw.trackingNumber ?? String(raw.id ?? '')),
      provider: PROVIDERS.ZREXPRESS_NEW,
      status,
      recipientName: customerName,
      phone,
      address: String(this.dig(raw, 'deliveryAddress', 'street') ?? ''),
      toWilayaId: wilayaCode,
      toCommune: commune || city,
      price: Number(raw.amount ?? 0),
      shippingFee: raw.deliveryPrice != null ? Number(raw.deliveryPrice) : null,
      rawStatus: stateName,
      notes: situationName ? String(situationName) : null,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.lastStateUpdateAt),
      raw,
    });
  }
}
