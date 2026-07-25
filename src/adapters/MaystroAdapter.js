import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl, getProviderRateLimits } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { DELIVERY_TYPE } from '../enums/DeliveryType.js';
import { OrderData } from '../data/OrderData.js';
import { LabelData } from '../data/LabelData.js';
import { RateData } from '../data/RateData.js';
import { CourierError } from '../exceptions/CourierError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

/**
 * Maystro numeric status codes → canonical TRACKING_STATUS.
 * Source: Vargo MaystroPackagesStatus enum (confirmed against the Maystro
 * platform's internal codes). Maystro returns these integers in the
 * `status` field of order payloads and webhooks.
 * @type {Record<number, string>}
 */
const NUMERIC_STATUS_MAP = {
  4: TRACKING_STATUS.PENDING,            // Created
  5: TRACKING_STATUS.PENDING,            // Pick up requested
  6: TRACKING_STATUS.PENDING,            // In process
  8: TRACKING_STATUS.PICKED_UP,          // Waiting transit
  9: TRACKING_STATUS.IN_TRANSIT,         // In transit to be shipped
  10: TRACKING_STATUS.RETURNING,         // In transit to be returned
  11: TRACKING_STATUS.PENDING,           // Pending
  12: TRACKING_STATUS.EXCEPTION,         // Out of stock
  15: TRACKING_STATUS.PICKED_UP,         // Ready to ship
  22: TRACKING_STATUS.OUT_FOR_DELIVERY,  // Assigned (to delivery agent)
  31: TRACKING_STATUS.OUT_FOR_DELIVERY,  // Shipped
  32: TRACKING_STATUS.FAILED_DELIVERY,   // Alerted
  41: TRACKING_STATUS.DELIVERED,         // Delivered
  42: TRACKING_STATUS.FAILED_DELIVERY,   // Postponed
  50: TRACKING_STATUS.CANCELLED,         // Aborted
  51: TRACKING_STATUS.RETURNING,         // Ready to return
  52: TRACKING_STATUS.RETURNED,          // Taken by store
  53: TRACKING_STATUS.EXCEPTION,         // Not received
};

/** French labels for Maystro numeric statuses (useful for UIs / logs). */
export const MAYSTRO_STATUS_LABELS = Object.freeze({
  4: 'Créé', 5: 'Ramassage demandé', 6: 'En traitement', 8: 'En attente de transit',
  9: 'En transit pour expédition', 10: 'En transit pour retour', 11: 'En attente',
  12: 'Rupture de stock', 15: 'Prêt à expédier', 22: 'Assigné', 31: 'Expédié',
  32: 'Alerté', 41: 'Livré', 42: 'Reporté', 50: 'Annulé', 51: 'Prêt à retourner',
  52: 'Récupéré par le magasin', 53: 'Non reçu',
});

/** @type {Record<string, string>} */
const STATUS_MAP = {
  initial: TRACKING_STATUS.PENDING,
  pending: TRACKING_STATUS.PENDING,
  waiting_for_pickup: TRACKING_STATUS.PENDING,
  picked_up: TRACKING_STATUS.PICKED_UP,
  ready_to_ship: TRACKING_STATUS.PICKED_UP,
  in_hub: TRACKING_STATUS.IN_TRANSIT,
  in_transit: TRACKING_STATUS.IN_TRANSIT,
  transferred: TRACKING_STATUS.IN_TRANSIT,
  out_for_delivery: TRACKING_STATUS.OUT_FOR_DELIVERY,
  delivery_in_progress: TRACKING_STATUS.OUT_FOR_DELIVERY,
  delivered: TRACKING_STATUS.DELIVERED,
  delivery_failed: TRACKING_STATUS.FAILED_DELIVERY,
  failed_delivery: TRACKING_STATUS.FAILED_DELIVERY,
  refused: TRACKING_STATUS.FAILED_DELIVERY,
  client_absent: TRACKING_STATUS.FAILED_DELIVERY,
  return_in_progress: TRACKING_STATUS.RETURNING,
  returning: TRACKING_STATUS.RETURNING,
  returned: TRACKING_STATUS.RETURNED,
  return_received: TRACKING_STATUS.RETURNED,
  cancelled: TRACKING_STATUS.CANCELLED,
  stop_desk: TRACKING_STATUS.READY_FOR_PICKUP,
  ready_for_pickup: TRACKING_STATUS.READY_FOR_PICKUP,
  lost: TRACKING_STATUS.EXCEPTION,
  damaged: TRACKING_STATUS.EXCEPTION,
  problem: TRACKING_STATUS.EXCEPTION,
};

/**
 * Adapter for the Maystro Delivery API.
 *
 * Auth: Token <token> (Django REST Framework token, NOT Bearer).
 * Base: https://backend.maystro-delivery.com/api/
 *
 * Delivery type mapping (Maystro-specific):
 *   0 = home delivery  (our DELIVERY_TYPE.HOME)
 *   1 = stop desk      (our DELIVERY_TYPE.STOP_DESK)
 */
export class MaystroAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/TokenCredentials.js').TokenCredentials} params.credentials
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(PROVIDERS.MAYSTRO),
      defaultHeaders: {
        // Maystro uses Django REST Framework Token auth — NOT Bearer
        Authorization: `Token ${credentials.token}`,
      },
      httpClient,
      rateLimits: getProviderRateLimits(PROVIDERS.MAYSTRO),
    });
    this.providerEnum = PROVIDERS.MAYSTRO;
    this.credentials = credentials;
  }

  normalizeStatus(rawStatus) {
    // Maystro's canonical status is a NUMERIC code (4…53) — mapped first via
    // the table imported from the Vargo provider census. String slugs from
    // older payloads remain supported as a fallback; anything unmapped
    // surfaces as UNKNOWN with the rawStatus preserved on OrderData.
    const code = Number(rawStatus);
    if (Number.isInteger(code) && code in NUMERIC_STATUS_MAP) {
      return NUMERIC_STATUS_MAP[code];
    }
    return STATUS_MAP[String(rawStatus ?? '').toLowerCase()] ?? TRACKING_STATUS.UNKNOWN;
  }

  /**
   * Maystro's create endpoint identifies the destination by a numeric commune
   * id, not a name. Resolve/validate it here so we never POST `NaN`.
   * @param {*} raw - data.toCommune
   * @returns {number}
   */
  _requireCommuneId(raw) {
    const communeId = Number(raw);
    if (!Number.isInteger(communeId) || communeId <= 0) {
      throw new CourierError(
        `Maystro requires a numeric commune id, received "${raw}". Resolve the ` +
        `commune name to its Maystro id via getCommunes() before dispatch.`,
      );
    }
    return communeId;
  }

  async testCredentials() {
    try {
      // Documented reference endpoint is `shared/wilayas/` (not `base/wilayas/`).
      await this.get('shared/wilayas/', { country: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List wilayas. `GET /api/shared/wilayas/` returns an array of `[id, name]`
   * pairs (documented). `country=1` → Algeria, `language` → ar|en|fr.
   *
   * @param {object} [opts]
   * @param {number} [opts.country] - 1 = Algeria, 2 = Tunisia
   * @param {string} [opts.language] - 'ar' | 'en' | 'fr'
   * @returns {Promise<Array<{id:number, name:string}>>}
   */
  async getWilayas({ country = 1, language = 'fr' } = {}) {
    const raw = await this.get('shared/wilayas/', { country, language });
    const rows = Array.isArray(raw) ? raw : (raw.data ?? raw.results ?? []);
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        // Documented shape is the tuple [id, name]; tolerate an object shape too.
        if (Array.isArray(row)) return { id: Number(row[0]), name: String(row[1] ?? '') };
        if (row && typeof row === 'object') {
          return { id: Number(row.id ?? row.code ?? 0), name: String(row.name ?? row.nom ?? '') };
        }
        return null;
      })
      .filter(Boolean);
  }

  /**
   * List communes, optionally filtered to a wilaya.
   * `GET /api/shared/communes/?wilaya={id}`.
   *
   * ⚠️ Maystro's docs do NOT publish this endpoint's response schema and no
   * Maystro test key was available to confirm it live, so the field mapping is
   * defensive: we read `id`/`name` if present and fall back to the
   * `nom`/`code_postal`/`has_stop_desk` shape seen elsewhere. The raw row is
   * preserved under `raw` so callers can recover any field we did not name.
   *
   * @param {number|string|null} [wilayaId]
   * @returns {Promise<Array<{id:(number|null), name:string, wilayaId:number, zipCode:(string|null), hasStopDesk:(boolean|null), raw:object}>>}
   */
  async getCommunes(wilayaId = null) {
    const params = {};
    if (wilayaId != null) params.wilaya = Number(wilayaId);
    const raw = await this.get('shared/communes/', params);
    const rows = Array.isArray(raw) ? raw : (raw.data ?? raw.results ?? []);
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((c) => c && typeof c === 'object')
      .map((c) => ({
        id: c.id != null ? Number(c.id) : null,
        name: String(c.name ?? c.nom ?? ''),
        wilayaId: Number(c.wilaya_id ?? c.wilaya ?? wilayaId ?? 0),
        zipCode: c.code_postal != null ? String(c.code_postal) : null,
        hasStopDesk: c.has_stop_desk != null ? Boolean(c.has_stop_desk) : null,
        raw: c,
      }));
  }

  /**
   * Get the delivery fee for a commune (Maystro prices per commune).
   * `GET /api/stores/delivery_price/?commune={id}` → `{ delivery_price }`.
   *
   * @param {number|string} communeId
   * @param {object} [opts]
   * @param {boolean} [opts.express]
   * @param {number} [opts.deliveryType] - 1 = home, 2 = stop-desk
   * @returns {Promise<number|null>} fee in DZD, or null if no tariff exists
   */
  async getDeliveryPrice(communeId, { express = false, deliveryType = null } = {}) {
    const params = { commune: Number(communeId) };
    if (express) params.express = true;
    if (deliveryType != null) {
      params.delivery_type = deliveryType === DELIVERY_TYPE.STOP_DESK ? 2 : 1;
    }
    try {
      const res = await this.get('stores/delivery_price/', params);
      return res?.delivery_price != null ? Number(res.delivery_price) : null;
    } catch {
      // 404 = "no pricing for the provided information" → treat as unavailable.
      return null;
    }
  }

  getCreateOrderValidationRules() {
    return {
      order_id: { required: true, type: 'string', maxLength: 255 },
      first_name: { required: true, type: 'string', maxLength: 100 },
      last_name: { required: true, type: 'string', maxLength: 100 },
      phone: { required: true, type: 'string' },
      address: { required: false, type: 'string', maxLength: 255 },
      to_wilaya_id: { required: true, type: 'integer', min: 1, max: 58 },
      to_commune: { required: true, type: 'string_or_integer' },
      product_description: { required: true, type: 'string' },
      price: { required: true, type: 'integer' },
      delivery_type: { required: true, type: 'integer', enum: [1, 2] },
      /**
       * OPTIONAL. The create endpoint auto-registers a catalogue product from the
       * line's `logistical_description` when no id is given (verified live), so a
       * pre-registered product is NOT required. To reuse an existing catalogue
       * product instead, pass its `id` (UUID) via notes:
       *   "maystro_product:{uuid}|optional note"
       * Request express delivery with:
       *   "maystro_express:1|optional note"
       */
      notes: { required: false, type: 'string', maxLength: 255 },
    };
  }

  async createOrder(data) {
    // Maystro `delivery_type`: 1 = home, 2 = stop desk (per current docs).
    const maystroDeliveryType = data.deliveryType === DELIVERY_TYPE.STOP_DESK ? 2 : 1;

    const { productId, express, note } = this._parseMaystroNotes(data.notes);

    // Maystro auto-creates a catalogue product from `logistical_description` when
    // `product_id` is omitted (verified live). Only send `product_id` when the
    // caller explicitly references an existing catalogue product via notes.
    const product = {
      quantity: data.quantity != null && data.quantity > 0 ? data.quantity : 1,
      logistical_description: data.productDescription || 'Produit',
    };
    if (productId) product.product_id = productId;

    const payload = {
      source: 4, // required constant per Maystro docs
      wilaya: data.toWilayaId,
      commune: this._requireCommuneId(data.toCommune),
      customer_phone: data.phone,
      customer_name: `${data.firstName} ${data.lastName}`.trim(),
      // Total door COD (product + delivery). Maystro derives its own delivery fee
      // and displays the split; the customer pays this full amount on delivery.
      product_price: Math.round(data.price),
      delivery_type: maystroDeliveryType,
      express, // required field on the current create endpoint
      products: [product],
      external_order_id: data.orderId,
    };

    if (note != null) payload.note_to_driver = note;
    if (data.address != null) payload.destination_text = data.address;
    if (data.stopDeskId != null) payload.stop_desk_id = data.stopDeskId;

    const response = await this.post('stores/orders/', payload);
    return this._hydrateOrder(response);
  }

  /**
   * Per-wilaya shipping rates. Maystro exposes pricing only per commune
   * (`GET stores/delivery_price/?commune={id}`), but prices are uniform across
   * the communes of a wilaya (verified live: every commune of a given wilaya
   * returns the same home/desk fee). So we sample ONE commune per wilaya instead
   * of pricing all ~1500 communes — ~3 calls/wilaya, paced by the throttle.
   *
   * @returns {Promise<Array<RateData>>}
   */
  async getRates() {
    const wilayas = await this.getWilayas();
    const rates = [];
    for (const w of wilayas) {
      let communes;
      try { communes = await this.getCommunes(w.id); } catch { continue; }
      const sample = (communes ?? []).find((c) => c.id != null);
      if (!sample) continue;

      let home = null;
      let desk = null;
      try { home = await this.getDeliveryPrice(sample.id); } catch { /* leave null */ }
      try {
        desk = await this.getDeliveryPrice(sample.id, { deliveryType: DELIVERY_TYPE.STOP_DESK });
      } catch { /* leave null */ }
      if (home == null && desk == null) continue;

      rates.push(new RateData({
        provider: PROVIDERS.MAYSTRO,
        toWilayaId: w.id,
        toWilayaName: w.name,
        homeDeliveryPrice: home ?? 0,
        stopDeskPrice: desk ?? 0,
        deliveryType: DELIVERY_TYPE.HOME,
      }));
    }
    return rates;
  }

  /**
   * Create many orders at once via Maystro's dedicated bulk import host.
   *
   * `POST https://import-export-orders-as6qwsolmq-ew.a.run.app/api/delivery/orders/`
   * accepts an array of order objects and returns one result per order
   * ({ id, external_id, tracking, delivery_price, success, errors }).
   *
   * ⚠️ Unlike createOrder(), the bulk host does NOT auto-create products: each
   * line must reference an EXISTING catalogue product by its numeric `display_id`
   * (verified live — a UUID or a bare description is rejected with code 50). Pass
   * it via notes: "maystro_product:{display_id}". Lines without one are still sent
   * so Maystro reports their error rather than us dropping them silently.
   *
   * The response echoes results positionally (its `external_id` field comes back
   * null even when external_order_id was sent), so callers must map by index.
   *
   * The doc does NOT specify a maximum batch size, so none is enforced here
   * (see audit "règle d'or"). The absolute URL bypasses the adapter's base URL.
   *
   * @param {Array<import('../data/CreateOrderData.js').CreateOrderData>} dataArray
   * @returns {Promise<Array<object>>} per-order results as returned by Maystro
   */
  async bulkCreateOrders(dataArray) {
    const list = Array.isArray(dataArray) ? dataArray : [dataArray];

    const orders = list.map((data) => {
      const { productId, express, note } = this._parseMaystroNotes(data.notes);
      const order = {
        external_order_id: data.orderId,
        customer_name: `${data.firstName} ${data.lastName}`.trim(),
        customer_phone: data.phone,
        destination_text: data.address ?? '',
        express,
        product_price: Math.round(data.price),
        delivery_type: data.deliveryType === DELIVERY_TYPE.STOP_DESK ? 2 : 1,
        commune: this._requireCommuneId(data.toCommune),
      };
      if (note != null) order.note_to_driver = note;
      // Bulk host field is `details[].product` = catalogue product display_id.
      if (productId) {
        order.details = [{ product: productId, quantity: data.quantity ?? 1 }];
      }
      return order;
    });

    const response = await this.post(
      'https://import-export-orders-as6qwsolmq-ew.a.run.app/api/delivery/orders/',
      orders,
    );

    if (Array.isArray(response)) return response;
    return response?.results ?? response?.data ?? [];
  }

  async getOrder(trackingNumber) {
    const response = await this.get(`stores/orders/${trackingNumber}/`);

    if (!response || Object.keys(response).length === 0) {
      throw new OrderNotFoundError(trackingNumber);
    }

    return this._hydrateOrder(response);
  }

  async getLabel(trackingNumber) {
    // `trackingNumber` is Maystro's order UUID (raw.id — see _hydrateOrder), so we
    // use the v2 bordereau endpoint, which is keyed by UUID. The v1 endpoint is
    // keyed by the numeric `display_id` and silently returns an ~880-byte blank
    // PDF when fed a UUID (verified live), so it must not be used here.
    const rawPdf = await this.requestRaw('POST', 'delivery/starter/v2/starter_bordureau/', {
      data: {
        orders_ids: [trackingNumber],
      },
    });

    if (!rawPdf || rawPdf.length === 0) {
      throw new CourierError(`Maystro returned an empty label for [${trackingNumber}].`);
    }

    return LabelData.fromBase64(
      PROVIDERS.MAYSTRO,
      trackingNumber,
      rawPdf.toString('base64'),
    );
  }

  /**
   * Cancel (abort) an order — Maystro cancels by PATCHing the order status to
   * 50 (Aborted) with abort_reason 21. Official endpoint (GitBook docs):
   * `PATCH shared/status/{orderId}/`. The Vargo integration used
   * `stores/orders/{id}/status/`, kept as a fallback for older deployments.
   *
   * @param {string} trackingNumber - Maystro order id (UUID or display id)
   * @returns {Promise<boolean>}
   */
  async cancelOrder(trackingNumber) {
    const id = encodeURIComponent(trackingNumber);
    const payload = { status: 50, abort_reason: 21 };
    try {
      await this.patch(`shared/status/${id}/`, payload);
    } catch (err) {
      // 404 → older deployments expose the cancel under stores/orders/…
      if (err?.statusCode !== 404) throw err;
      await this.patch(`stores/orders/${id}/status/`, payload);
    }
    return true;
  }

  /**
   * Update an order in place (`PATCH stores/orders/{id}/`). Accepts a partial
   * payload of Maystro fields: destination_text, customer_phone, customer_name,
   * wilaya, commune, note_to_driver, product_price, products.
   *
   * @param {string} trackingNumber - Maystro order id
   * @param {object} fields - Partial Maystro-shaped fields to update
   * @returns {Promise<object>} raw Maystro response
   */
  async updateOrder(trackingNumber, fields) {
    return this.patch(`stores/orders/${encodeURIComponent(trackingNumber)}/`, fields);
  }

  /**
   * Tracking history events for an order. Official endpoint (GitBook docs):
   * `GET stores/history_order/{order_id}` → [{ status, created_at, comment }].
   * Older paths seen in the wild are kept as fallbacks.
   *
   * @param {string} trackingNumber
   * @returns {Promise<Array<object>>}
   */
  async getTrackingHistory(trackingNumber) {
    const id = encodeURIComponent(trackingNumber);
    let response = null;
    for (const path of [
      `stores/history_order/${id}`,        // official (docs v. GitBook)
      `stores/orders/history_order/${id}`, // vargo variant
      `orders/history_order/${id}`,        // legacy variant
    ]) {
      try {
        response = await this.get(path);
        break;
      } catch (err) {
        if (err?.statusCode !== 404) throw err;
      }
    }
    const items = response?.data ?? response?.results ?? response;
    return Array.isArray(items) ? items : [];
  }

  // ─── Webhooks (endpoints from the Vargo integration) ─────────────────────

  /**
   * Register a webhook endpoint. Maystro pushes order-status events to it.
   * `POST stores/hooks/costume/` — { endpoint, trigger_type_id? }.
   * Trigger type ids come from listWebhookTypes(); omit to receive all events.
   *
   * @param {string} url - Public HTTPS endpoint of your app
   * @param {string|null} [triggerTypeId] - Optional trigger type UUID
   * @returns {Promise<object>} raw Maystro response (includes the webhook id)
   */
  async createWebhook(url, triggerTypeId = null) {
    const payload = { endpoint: url };
    if (triggerTypeId != null) payload.trigger_type_id = triggerTypeId;
    return this.post('stores/hooks/costume/', payload);
  }

  /** List registered webhook endpoints (`GET stores/hooks/costume/`). */
  async listWebhooks() {
    const response = await this.get('stores/hooks/costume/');
    const items = response?.data ?? response?.results ?? response;
    return Array.isArray(items) ? items : [items].filter(Boolean);
  }

  /** Delete a webhook endpoint (`DELETE stores/hooks/costume/{id}/`). */
  async deleteWebhook(webhookId) {
    await this.delete(`stores/hooks/costume/${encodeURIComponent(webhookId)}/`);
    return true;
  }

  /** List available webhook trigger types (`GET stores/hooks/types/`). */
  async listWebhookTypes() {
    const response = await this.get('stores/hooks/types/');
    const items = response?.data ?? response?.results ?? response;
    return Array.isArray(items) ? items : [items].filter(Boolean);
  }

  /** Fire a test webhook to the registered endpoint (`POST stores/hooks/test/request/`). */
  async sendTestWebhook() {
    return this.post('stores/hooks/test/request/');
  }

  /**
   * Create a product in the Maystro store catalogue.
   * This is a Maystro-specific operation — not part of the standard interface.
   *
   * @param {string} storeId
   * @param {string} logisticalDescription
   * @param {string|null} [productId]
   * @returns {Promise<object>}
   */
  async createProduct(storeId, logisticalDescription, productId = null) {
    const payload = {
      store_id: storeId,
      logistical_description: logisticalDescription,
    };

    if (productId != null && productId !== '') {
      payload.product_id = productId;
    }

    return this.post('stores/product/', payload);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Extract Maystro-specific hints from the notes field.
   * Supported segments (pipe-separated, order-independent):
   *   "maystro_product:{id}" → catalogue product id (UUID or display_id)
   *   "maystro_express:1"    → request express delivery
   * Anything else is treated as the human note_to_driver.
   *
   * @param {string|null} notes
   * @returns {{productId: string|null, express: boolean, note: string|null}}
   */
  _parseMaystroNotes(notes) {
    let productId = null;
    let express = false;
    const remaining = [];

    for (const segment of String(notes ?? '').split('|')) {
      const s = segment.trim();
      if (s.startsWith('maystro_product:')) {
        productId = s.slice('maystro_product:'.length).trim() || null;
      } else if (s.startsWith('maystro_express:')) {
        const v = s.slice('maystro_express:'.length).trim().toLowerCase();
        express = v === '1' || v === 'true' || v === 'yes';
      } else if (s !== '') {
        remaining.push(s);
      }
    }

    return {
      productId,
      express,
      note: remaining.length > 0 ? remaining.join(' | ') : null,
    };
  }

  _hydrateOrder(raw) {
    const rawStatus = String(raw.status ?? '');
    return new OrderData({
      orderId: String(raw.external_order_id ?? raw.id ?? ''),
      trackingNumber: String(raw.tracking ?? String(raw.id ?? '')),
      provider: PROVIDERS.MAYSTRO,
      status: this.normalizeStatus(rawStatus),
      recipientName: String(raw.customer_name ?? ''),
      phone: String(raw.customer_phone ?? ''),
      address: String(raw.destination_text ?? raw.address ?? ''),
      toWilayaId: Number(raw.wilaya ?? 0),
      toCommune: String(raw.commune ?? ''),
      price: Number(raw.product_price ?? 0),
      shippingFee: raw.delivery_fee != null ? Number(raw.delivery_fee) : null,
      rawStatus,
      notes: raw.note_to_driver ?? null,
      createdAt: this.parseDate(raw.created_at),
      updatedAt: this.parseDate(raw.updated_at),
      raw,
    });
  }
}
