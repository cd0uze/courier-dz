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
 * Status mapping for Noest tracking activity `event_key` values.
 *
 * ⚠️ Noest's `get/trackings/info` returns no explicit status field; status is
 * inferred from the latest `activity[].event_key`. The full event taxonomy is
 * NOT published by Noest, so this map covers the keys observed/known and
 * everything else falls through to UNKNOWN (per the audit "règle d'or": we do
 * not fabricate a meaning for undocumented values).
 *
 * @type {Record<string, string>}
 */
// Official NOEST event keys (public API doc v2.3 «Liste des événements»).
// ⚠️ NOEST mixes payment/finance events into the tracking feed — those map to
// null below and MUST NOT be treated as parcel movement (documented trap).
const FINANCE_EVENT_KEYS = new Set([
  'verssement_admin_cust',
  'verssement_admin_cust_canceled',
  'verssement_hub_cust_canceled',
  'validation_reception_cash_by_partener',
  'edit_price',
  'extra_fee',
]);

const STATUS_MAP = {
  // ── Official event keys ────────────────────────────────────────────────────
  customer_validation: TRACKING_STATUS.PENDING,
  validation_collect_colis: TRACKING_STATUS.PICKED_UP,
  validation_reception_admin: TRACKING_STATUS.IN_TRANSIT,
  validation_reception: TRACKING_STATUS.IN_TRANSIT,
  fdr_activated: TRACKING_STATUS.OUT_FOR_DELIVERY,
  sent_to_redispatch: TRACKING_STATUS.IN_TRANSIT,
  nouvel_tentative_asked_by_customer: TRACKING_STATUS.OUT_FOR_DELIVERY,
  mise_a_jour: TRACKING_STATUS.FAILED_DELIVERY, // « Tentative de livraison »
  colis_suspendu: TRACKING_STATUS.FAILED_DELIVERY,
  livre: TRACKING_STATUS.DELIVERED,
  livred: TRACKING_STATUS.DELIVERED,
  return_asked_by_customer: TRACKING_STATUS.RETURNING,
  return_asked_by_hub: TRACKING_STATUS.RETURNING,
  retour_dispatched_to_partenaires: TRACKING_STATUS.RETURNING,
  return_dispatched_to_partenaire: TRACKING_STATUS.RETURNING,
  colis_retour_transmit_to_partner: TRACKING_STATUS.RETURNING,
  return_dispatched_to_warehouse: TRACKING_STATUS.RETURNING,
  annulation_dispatch_retour: TRACKING_STATUS.IN_TRANSIT,
  cancel_return_dispatched_to_partenaire: TRACKING_STATUS.IN_TRANSIT,
  livraison_echoue_recu: TRACKING_STATUS.RETURNED,
  return_validated_by_partener: TRACKING_STATUS.RETURNED,
  return_redispatched_to_livraison: TRACKING_STATUS.OUT_FOR_DELIVERY,
  colis_pickup_transmit_to_partner: TRACKING_STATUS.IN_TRANSIT,
  pickedup: TRACKING_STATUS.PICKED_UP,
  valid_return_pickup: TRACKING_STATUS.PICKED_UP,
  pickup_picked_recu: TRACKING_STATUS.DELIVERED,
  echange_valide: TRACKING_STATUS.DELIVERED,
  echange_valid_by_hub: TRACKING_STATUS.DELIVERED,
  ask_to_delete_by_admin: TRACKING_STATUS.CANCELLED,
  ask_to_delete_by_hub: TRACKING_STATUS.CANCELLED,
  edited_informations: TRACKING_STATUS.UNKNOWN,
  edit_wilaya: TRACKING_STATUS.UNKNOWN,

  // ── Legacy / generic slugs ─────────────────────────────────────────────────
  upload: TRACKING_STATUS.PENDING,
  pending: TRACKING_STATUS.PENDING,
  preparation: TRACKING_STATUS.PENDING,
  accepted: TRACKING_STATUS.IN_TRANSIT,
  picked_up: TRACKING_STATUS.PICKED_UP,
  pickup: TRACKING_STATUS.PICKED_UP,
  dispatch: TRACKING_STATUS.IN_TRANSIT,
  dispatched: TRACKING_STATUS.IN_TRANSIT,
  transit: TRACKING_STATUS.IN_TRANSIT,
  in_transit: TRACKING_STATUS.IN_TRANSIT,
  out_for_delivery: TRACKING_STATUS.OUT_FOR_DELIVERY,
  delivered: TRACKING_STATUS.DELIVERED,
  recovered: TRACKING_STATUS.DELIVERED,
  return: TRACKING_STATUS.RETURNING,
  returning: TRACKING_STATUS.RETURNING,
  returned: TRACKING_STATUS.RETURNED,
  canceled: TRACKING_STATUS.CANCELLED,
  cancelled: TRACKING_STATUS.CANCELLED,
};

/**
 * Adapter for Noest Express (app.noest-dz.com, /api/public).
 *
 * Auth: `Authorization: Bearer {token}` on every request. Write/action calls
 * (create, bulk create, ship, bulk ship, delete) additionally require the
 * account `user_guid` in the JSON body — confirmed live: GET reference
 * endpoints accept the Bearer token alone, while create/delete return HTTP 422
 * ("Le champ user guid est obligatoire.") when `user_guid` is omitted.
 *
 * Endpoints (all live-verified during the audit):
 *   POST api/public/create/order         → single create
 *   POST api/public/create/orders        → bulk create (poids REQUIRED per item)
 *   POST api/public/valid/order          → ship one parcel
 *   POST api/public/valid/orders         → bulk ship
 *   POST api/public/delete/order         → delete (only before shipping)
 *   POST api/public/get/trackings/info   → order details by tracking(s)
 *   GET  api/public/get/order/label      → 302 → pre-signed S3 PDF (expires ~300s)
 *   GET  api/public/get/wilayas          → [{ code, nom, is_active }]
 *   GET  api/public/get/communes/{id}    → [{ nom, wilaya_id, code_postal, is_active }]
 *   GET  api/public/fees                 → { tarifs: { delivery, return } } per wilaya
 *   GET  api/public/desks                → stop-desk directory keyed by desk code
 *
 * `type_id`: 1 = livraison, 2 = échange, 3 = pickup.
 * `stop_desk`: 0 = home, 1 = stop-desk (then `station_code` selects the desk).
 */
export class NoestAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/NoestCredentials.js').NoestCredentials} params.credentials
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(PROVIDERS.NOEST),
      defaultHeaders: {
        Authorization: `Bearer ${credentials.token}`,
      },
      httpClient,
      rateLimits: getProviderRateLimits(PROVIDERS.NOEST),
    });
    this.providerEnum = PROVIDERS.NOEST;
    this.credentials = credentials;
  }

  normalizeStatus(rawStatus) {
    if (!rawStatus) return TRACKING_STATUS.UNKNOWN;
    const key = String(rawStatus).toLowerCase().trim().replace(/\s+/g, '_');
    // Finance events (payouts, price edits) travel in the same feed but are
    // NOT parcel movement — never let them overwrite a delivery status.
    if (FINANCE_EVENT_KEYS.has(key)) return TRACKING_STATUS.UNKNOWN;
    return STATUS_MAP[key] ?? TRACKING_STATUS.UNKNOWN;
  }

  /**
   * True when a raw NOEST event key is a payment/finance event (payout,
   * price edit, extra fee) rather than parcel movement. Callers rendering a
   * tracking timeline can keep them; status engines must skip them.
   * @param {string} rawStatus
   */
  isFinanceEvent(rawStatus) {
    const key = String(rawStatus ?? '').toLowerCase().trim().replace(/\s+/g, '_');
    return FINANCE_EVENT_KEYS.has(key);
  }

  async testCredentials() {
    try {
      const data = await this.get('api/public/get/wilayas');
      return Array.isArray(data) ? data.length > 0 : Boolean(data);
    } catch {
      return false;
    }
  }

  // ─── Rates ──────────────────────────────────────────────────────────────────

  /**
   * Get the account's per-wilaya delivery tariffs.
   * `GET api/public/fees` → `{ tarifs: { delivery: { "16": {tarif, tarif_stopdesk} },
   *                                       return:   { "16": {tarif} } } }`.
   * Noest prices PER WILAYA (no per-commune grid). `delivery` is the shipping
   * fee (home = `tarif`, stop-desk = `tarif_stopdesk`); `return` is the return fee.
   */
  async getRates(fromWilayaId = null, toWilayaId = null) {
    const response = await this.get('api/public/fees');
    const tarifs = response?.tarifs ?? {};
    const delivery = tarifs.delivery ?? {};
    const returns = tarifs.return ?? {};

    const result = [];

    for (const [wid, row] of Object.entries(delivery)) {
      if (!row || typeof row !== 'object') continue;
      const wilayaId = Number(row.wilaya_id ?? wid);
      if (toWilayaId != null && wilayaId !== Number(toWilayaId)) continue;

      const ret = returns[wid] ?? returns[String(wilayaId)] ?? null;

      result.push(new RateData({
        provider: PROVIDERS.NOEST,
        toWilayaId: wilayaId,
        toWilayaName: '',
        homeDeliveryPrice: Number(row.tarif ?? 0),
        stopDeskPrice: Number(row.tarif_stopdesk ?? 0),
        returnPrice: ret ? Number(ret.tarif ?? 0) : null,
        deliveryType: DELIVERY_TYPE.HOME,
        fromWilayaId,
      }));
    }

    return result;
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  getCreateOrderValidationRules() {
    return {
      order_id: { required: true, type: 'string', maxLength: 255 },
      first_name: { required: true, type: 'string' },
      last_name: { required: true, type: 'string' },
      phone: { required: true, type: 'string' },
      address: { required: true, type: 'string' },
      to_wilaya_id: { required: true, type: 'integer', min: 1, max: 58 },
      to_commune: { required: true, type: 'string' },
      product_description: { required: true, type: 'string' },
      price: { required: true, type: 'number', min: 0 },
      delivery_type: { required: false, type: 'integer', enum: [1, 2] },
      // station_code (stop-desk) is read from stopDeskId when delivery_type = STOP_DESK.
      notes: { required: false, type: 'string' },
      weight: { required: false, type: 'number', min: 0 },
    };
  }

  /**
   * Build the Noest order body (shared by single + bulk create).
   * @param {import('../data/CreateOrderData.js').CreateOrderData} data
   * @param {object} [opts]
   * @param {boolean} [opts.requireWeight] - bulk create requires `poids`
   * @returns {object}
   */
  _buildOrderBody(data, { requireWeight = false } = {}) {
    const isStopDesk = data.deliveryType === DELIVERY_TYPE.STOP_DESK;

    const body = {
      reference: String(data.orderId ?? ''),
      client: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
      phone: String(data.phone ?? ''),
      adresse: String(data.address ?? ''),
      wilaya_id: Number(data.toWilayaId),
      commune: String(data.toCommune ?? ''),
      montant: Number(data.price ?? 0),
      produit: String(data.productDescription ?? ''),
      type_id: data.hasExchange ? 2 : 1,
      stop_desk: isStopDesk ? 1 : 0,
    };

    if (data.phoneAlt != null) body.phone_2 = String(data.phoneAlt);
    const noestNotes = this.notesWithFragile(data);
    if (noestNotes != null) body.remarque = String(noestNotes);
    if (data.hasExchange && data.exchangeProduct != null) {
      body.produit_a_recuperer = String(data.exchangeProduct);
    }
    if (isStopDesk && data.stopDeskId != null) {
      body.station_code = String(data.stopDeskId);
    }

    // Single create accepts orders without weight, but bulk create REQUIRES
    // `poids` (verified live). Default to 1 when unspecified for bulk only.
    if (data.weight != null) {
      body.poids = Number(data.weight);
    } else if (requireWeight) {
      body.poids = 1;
    }

    return body;
  }

  async createOrder(data) {
    const payload = { user_guid: this.credentials.guid, ...this._buildOrderBody(data) };

    const response = await this.post('api/public/create/order', payload);

    if (response?.success === true && response?.tracking) {
      // NOEST trap: a created order sits in a DRAFT state logistics never sees
      // until it is validated — no pickup, no error, the parcel just stalls.
      // We validate as part of creation so a returned tracking is pickup-ready.
      // Set adapter.autoValidate = false to keep drafts (edit before shipping).
      if (this.autoValidate !== false) {
        try {
          await this.shipOrder(response.tracking);
        } catch (err) {
          throw new CourierError(
            `NOEST created parcel [${response.tracking}] but validation failed — ` +
            `the parcel is a DRAFT and will NOT be picked up until validated ` +
            `(shipOrder). Cause: ${err.message}`,
            err?.statusCode ?? 0,
            err,
          );
        }
      }
      return this._hydrateFromCreate(response, data);
    }

    throw new CourierError(
      `${this.providerEnum} createOrder failed: ${JSON.stringify(response)}`,
    );
  }

  /**
   * Bulk-create up to 100 orders. `POST api/public/create/orders` with
   * `{ user_guid, orders: [...] }`. Every item must carry `poids` (live-verified).
   * Response: `{ success, passed: [{success, tracking, reference, ...}], failed: [{reference, <field>:[errors]}] }`.
   *
   * @param {Array<import('../data/CreateOrderData.js').CreateOrderData>} dataArray
   * @returns {Promise<{totalRequested:number, successCount:number, failureCount:number, passed:Array, failed:Array}>}
   */
  async bulkCreateOrders(dataArray) {
    const list = Array.isArray(dataArray) ? dataArray : [dataArray];
    const MAX_PER_REQUEST = 100;

    const aggregate = {
      totalRequested: list.length,
      successCount: 0,
      failureCount: 0,
      passed: [],
      failed: [],
    };

    for (let offset = 0; offset < list.length; offset += MAX_PER_REQUEST) {
      const chunk = list.slice(offset, offset + MAX_PER_REQUEST);
      const orders = chunk.map((data) => this._buildOrderBody(data, { requireWeight: true }));

      const res = await this.post('api/public/create/orders', {
        user_guid: this.credentials.guid,
        orders,
      });

      for (const p of res?.passed ?? []) {
        aggregate.passed.push(p);
        aggregate.successCount += 1;
      }
      for (const f of res?.failed ?? []) {
        aggregate.failed.push(f);
        aggregate.failureCount += 1;
      }

      // Same NOEST trap as createOrder: bulk-created parcels are drafts until
      // validated. Validate the successful trackings of this chunk in one call.
      if (this.autoValidate !== false) {
        const trackings = (res?.passed ?? [])
          .map((p) => p?.tracking)
          .filter(Boolean);
        if (trackings.length > 0) {
          const validation = await this.bulkShipOrders(trackings);
          aggregate.validation = aggregate.validation ?? { passed: {}, failed: {} };
          Object.assign(aggregate.validation.passed, validation?.passed ?? {});
          Object.assign(aggregate.validation.failed, validation?.failed ?? {});
        }
      }
    }

    return aggregate;
  }

  // ─── Read ───────────────────────────────────────────────────────────────────

  async getOrder(trackingNumber) {
    const response = await this.post('api/public/get/trackings/info', {
      user_guid: this.credentials.guid,
      trackings: [String(trackingNumber)],
    });

    const entry = response?.[trackingNumber] ?? null;
    if (!entry || !entry.OrderInfo) {
      throw new OrderNotFoundError(trackingNumber);
    }

    return this._hydrateOrder(trackingNumber, entry);
  }

  /**
   * Get info for many trackings at once.
   * @param {string[]} trackingNumbers
   * @returns {Promise<OrderData[]>}
   */
  async getOrders(trackingNumbers) {
    const list = (Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers]).map(String);
    const response = await this.post('api/public/get/trackings/info', {
      user_guid: this.credentials.guid,
      trackings: list,
    });

    const out = [];
    for (const tracking of list) {
      const entry = response?.[tracking];
      if (entry && entry.OrderInfo) out.push(this._hydrateOrder(tracking, entry));
    }
    return out;
  }

  /**
   * Get a parcel label. `GET api/public/get/order/label?tracking={t}` issues a
   * 302 redirect to a pre-signed S3 PDF (URL expires ~300s); we follow it and
   * return the PDF bytes as base64.
   */
  async getLabel(trackingNumber) {
    const buffer = await this.requestRaw('GET', 'api/public/get/order/label', {
      params: { tracking: String(trackingNumber) },
    });

    if (buffer && buffer.length > 0) {
      return LabelData.fromBase64(PROVIDERS.NOEST, trackingNumber, buffer.toString('base64'));
    }

    throw new CourierError(
      `${this.providerEnum} returned an empty label for [${trackingNumber}].`,
    );
  }

  // ─── Ship / delete ────────────────────────────────────────────────────────

  /**
   * Ship (validate) one parcel. `POST api/public/valid/order { user_guid, tracking }`.
   * After validation the parcel can no longer be deleted.
   * @param {string} trackingNumber
   * @returns {Promise<boolean>}
   */
  async shipOrder(trackingNumber) {
    const response = await this.post('api/public/valid/order', {
      user_guid: this.credentials.guid,
      tracking: String(trackingNumber),
    });

    if (response?.success === true) return true;

    throw new CourierError(
      `${this.providerEnum} could not ship [${trackingNumber}]: ${JSON.stringify(response)}`,
    );
  }

  /**
   * Bulk-ship parcels. `POST api/public/valid/orders { user_guid, trackings:[] }`.
   * Response: `{ success, passed: [...], failed: { <tracking>: { <field>:[errors] } } }`.
   *
   * @param {string[]} trackingNumbers
   * @returns {Promise<{success:boolean, passed:Array, failed:object}>}
   */
  async bulkShipOrders(trackingNumbers) {
    const list = (Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers]).map(String);
    const response = await this.post('api/public/valid/orders', {
      user_guid: this.credentials.guid,
      trackings: list,
    });
    return {
      success: Boolean(response?.success),
      passed: response?.passed ?? [],
      failed: response?.failed ?? {},
    };
  }

  /**
   * Delete (cancel) a parcel — only possible before it is shipped/validated.
   * `POST api/public/delete/order { user_guid, tracking }`.
   * @param {string} trackingNumber
   * @returns {Promise<boolean>}
   */
  async cancelOrder(trackingNumber) {
    const response = await this.post('api/public/delete/order', {
      user_guid: this.credentials.guid,
      tracking: String(trackingNumber),
    });

    if (response?.success === true) return true;

    throw new CourierError(
      `${this.providerEnum} could not delete [${trackingNumber}]: ${JSON.stringify(response)}`,
    );
  }

  // ─── Reference data ──────────────────────────────────────────────────────────

  /**
   * List wilayas. `GET api/public/get/wilayas` → `[{ code, nom, is_active }]`.
   * @returns {Promise<Array<{id:number, name:string, isActive:boolean}>>}
   */
  async getWilayas() {
    const rows = await this.get('api/public/get/wilayas');
    if (!Array.isArray(rows)) return [];
    return rows.map((w) => ({
      id: Number(w.code ?? 0),
      name: String(w.nom ?? ''),
      isActive: Boolean(w.is_active),
    }));
  }

  /**
   * List a wilaya's communes. `GET api/public/get/communes/{wilayaId}` →
   * `[{ nom, wilaya_id, code_postal, is_active }]`.
   * @param {number|string} wilayaId
   * @returns {Promise<Array<{name:string, wilayaId:number, zipCode:string|null, isActive:boolean}>>}
   */
  async getCommunes(wilayaId) {
    if (wilayaId == null) {
      throw new CourierError('Noest getCommunes requires a wilayaId.');
    }
    const rows = await this.get(`api/public/get/communes/${Number(wilayaId)}`);
    if (!Array.isArray(rows)) return [];
    return rows.map((c) => ({
      name: String(c.nom ?? ''),
      wilayaId: Number(c.wilaya_id ?? wilayaId),
      zipCode: c.code_postal != null ? String(c.code_postal) : null,
      isActive: Boolean(c.is_active),
    }));
  }

  /**
   * List stop-desk offices. `GET api/public/desks` returns an object keyed by
   * desk code; each value carries `code` (the `station_code` to use on create),
   * `commune`, `name`, `address`, `map`, `phones`, `email`, `horaires`.
   *
   * @returns {Promise<Array<{stationCode:string, communeName:string, name:string, address:string, map:string|null, phones:string[], email:string|null, horaires:string|null}>>}
   */
  async getOffices() {
    const data = await this.get('api/public/desks');
    if (!data || typeof data !== 'object') return [];
    return Object.values(data)
      .filter((o) => o && typeof o === 'object')
      .map((o) => ({
        stationCode: String(o.code ?? ''),
        communeName: String(o.commune ?? ''),
        name: String(o.name ?? ''),
        address: String(o.address ?? ''),
        map: o.map ? String(o.map) : null,
        phones: o.phones && typeof o.phones === 'object'
          ? Object.values(o.phones).map(String).filter((p) => p !== '')
          : [],
        email: o.email ? String(o.email) : null,
        horaires: o.horaires ? String(o.horaires) : null,
      }));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Hydrate from the create response (no full order is returned on create).
   * @param {object} response - { success, tracking, reference, regional_hub_name, wilaya_rank }
   * @param {import('../data/CreateOrderData.js').CreateOrderData} data
   */
  _hydrateFromCreate(response, data) {
    return new OrderData({
      orderId: String(response.reference ?? data.orderId ?? ''),
      trackingNumber: String(response.tracking),
      provider: PROVIDERS.NOEST,
      status: TRACKING_STATUS.PENDING,
      recipientName: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
      phone: String(data.phone ?? ''),
      address: String(data.address ?? ''),
      toWilayaId: Number(data.toWilayaId ?? 0),
      toCommune: String(data.toCommune ?? ''),
      price: Number(data.price ?? 0),
      rawStatus: 'upload',
      notes: response.regional_hub_name
        ? `Hub: ${response.regional_hub_name} (${response.wilaya_rank ?? ''})`.trim()
        : null,
      createdAt: new Date(),
      raw: response,
    });
  }

  /**
   * Hydrate from a get/trackings/info entry: { OrderInfo:{...}, recipientName,
   * shippedBy, originCity, destLocationCity, activity:[{event_key,...}] }.
   */
  _hydrateOrder(trackingNumber, entry) {
    const info = entry.OrderInfo ?? {};
    const activity = Array.isArray(entry.activity) ? entry.activity : [];
    const lastEvent = activity.length > 0 ? activity[activity.length - 1] : null;
    const rawStatus = String(lastEvent?.event_key ?? '');

    return new OrderData({
      orderId: String(info.reference ?? ''),
      trackingNumber: String(info.tracking ?? trackingNumber),
      provider: PROVIDERS.NOEST,
      status: this.normalizeStatus(rawStatus),
      recipientName: String(entry.recipientName ?? info.client ?? ''),
      phone: String(info.phone ?? ''),
      address: String(info.adresse ?? ''),
      toWilayaId: Number(info.wilaya_id ?? entry.destLocationCity ?? 0),
      toCommune: String(info.commune ?? ''),
      price: Number(info.montant ?? 0),
      rawStatus,
      notes: info.remarque ? String(info.remarque) : null,
      createdAt: this.parseDate(info.created_at),
      raw: entry,
    });
  }
}
