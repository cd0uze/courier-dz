import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl, getProviderRateLimits } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { DELIVERY_TYPE } from '../enums/DeliveryType.js';
import { OrderData } from '../data/OrderData.js';
import { LabelData } from '../data/LabelData.js';
import { CourierError } from '../exceptions/CourierError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

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
    // Maystro exposes status differently across endpoints (documented string
    // slugs on the ones we have). Coerce defensively so a numeric/undefined
    // status never throws; anything unmapped surfaces as UNKNOWN with the
    // rawStatus preserved on OrderData. We do NOT invent a numeric-code table
    // — the docs available to us don't publish one (audit "règle d'or").
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
       * Maystro requires every line to reference a product already registered in
       * the store catalogue (`product_id`). Pass it through notes:
       *   "maystro_product:{id}|optional note"
       * and (optionally) request express delivery:
       *   "maystro_express:1|maystro_product:{id}|optional note"
       */
      notes: { required: false, type: 'string', maxLength: 255 },
    };
  }

  async createOrder(data) {
    // Maystro `delivery_type`: 1 = home, 2 = stop desk (per current docs).
    const maystroDeliveryType = data.deliveryType === DELIVERY_TYPE.STOP_DESK ? 2 : 1;

    const { productId, express, note } = this._parseMaystroNotes(data.notes);

    if (!productId) {
      throw new CourierError(
        'Maystro requires a registered product_id. Pass it via notes: ' +
        '"maystro_product:{id}|optional note". The product must already exist ' +
        'in the Maystro store catalogue (create it via createProduct()).',
      );
    }

    const payload = {
      source: 4, // required constant per Maystro docs
      wilaya: data.toWilayaId,
      commune: this._requireCommuneId(data.toCommune),
      customer_phone: data.phone,
      customer_name: `${data.firstName} ${data.lastName}`.trim(),
      product_price: Math.round(data.price),
      delivery_type: maystroDeliveryType,
      express, // required field on the current create endpoint
      products: [
        {
          product_id: productId,
          quantity: data.quantity != null && data.quantity > 0 ? data.quantity : 1,
          logistical_description: data.productDescription,
        },
      ],
      external_order_id: data.orderId,
    };

    if (note != null) payload.note_to_driver = note;
    if (data.address != null) payload.destination_text = data.address;
    if (data.stopDeskId != null) payload.stop_desk_id = data.stopDeskId;

    const response = await this.post('stores/orders/', payload);
    return this._hydrateOrder(response);
  }

  /**
   * Create many orders at once via Maystro's dedicated bulk import host.
   *
   * `POST https://import-export-orders-as6qwsolmq-ew.a.run.app/api/delivery/orders/`
   * accepts an array of order objects and returns one result per order
   * ({ id, external_id, tracking, delivery_price, success, errors }).
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
      if (productId) order.products = [{ product_id: productId, quantity: data.quantity ?? 1 }];
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
    // Maystro returns raw PDF bytes from a POST endpoint
    const rawPdf = await this.requestRaw('POST', 'delivery/starter/starter_bordureau/', {
      data: {
        all_created: true,
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
