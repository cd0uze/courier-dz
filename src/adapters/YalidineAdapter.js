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
// The 34 official `last_status` values (Yalidine API docs) + legacy variants
// kept for older payloads. Exact-string lookup — Yalidine emits these verbatim.
const STATUS_MAP = {
  // ── Pre-pickup ────────────────────────────────────────────────────────────
  'Pas encore expédié': TRACKING_STATUS.PENDING,
  'A vérifier': TRACKING_STATUS.PENDING,
  'Pas encore ramassé': TRACKING_STATUS.PENDING,
  'En passation': TRACKING_STATUS.PICKED_UP,
  'Ramassé': TRACKING_STATUS.PICKED_UP,
  // ── Line-haul ─────────────────────────────────────────────────────────────
  'Bloqué': TRACKING_STATUS.EXCEPTION,
  'Débloqué': TRACKING_STATUS.IN_TRANSIT,
  'Transfert': TRACKING_STATUS.IN_TRANSIT,
  'Expédié': TRACKING_STATUS.IN_TRANSIT,
  'Centre': TRACKING_STATUS.IN_TRANSIT,
  'En localisation': TRACKING_STATUS.IN_TRANSIT,
  'Vers Wilaya': TRACKING_STATUS.IN_TRANSIT,
  'En transit': TRACKING_STATUS.IN_TRANSIT,
  'Reçu à Wilaya': TRACKING_STATUS.IN_TRANSIT,
  // ── Last mile ─────────────────────────────────────────────────────────────
  'Prêt pour livreur': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'Sorti en livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'En alerte': TRACKING_STATUS.FAILED_DELIVERY,
  'Echèc livraison': TRACKING_STATUS.FAILED_DELIVERY,
  'Echange échoué': TRACKING_STATUS.FAILED_DELIVERY,
  // ── Returns ───────────────────────────────────────────────────────────────
  'Retour vers centre': TRACKING_STATUS.RETURNING,
  'Retourné au centre': TRACKING_STATUS.RETURNING,
  'Retour transfert': TRACKING_STATUS.RETURNING,
  'Retour groupé': TRACKING_STATUS.RETURNING,
  'Retour à retirer': TRACKING_STATUS.RETURNING,
  'Retour vers vendeur': TRACKING_STATUS.RETURNING,
  'Retourné au vendeur': TRACKING_STATUS.RETURNED,
  // ── Legacy / shared entries ───────────────────────────────────────────────
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
 *
 * The Yalidine API uses wilaya names (strings) not IDs for
 * from_wilaya_name and to_wilaya_name in the order payload.
 */
export class YalidineAdapter extends AbstractAdapter {
  /** Map wilaya ID → French name (Yalidine expects French names) */
  static WILAYA_NAMES = {
    1: 'Adrar', 2: 'Chlef', 3: 'Laghouat', 4: 'Oum El Bouaghi',
    5: 'Batna', 6: 'Béjaïa', 7: 'Biskra', 8: 'Béchar',
    9: 'Blida', 10: 'Bouira', 11: 'Tamanrasset', 12: 'Tébessa',
    13: 'Tlemcen', 14: 'Tiaret', 15: 'Tizi Ouzou', 16: 'Alger',
    17: 'Djelfa', 18: 'Jijel', 19: 'Sétif', 20: 'Saïda',
    21: 'Skikda', 22: 'Sidi Bel Abbès', 23: 'Annaba', 24: 'Guelma',
    25: 'Constantine', 26: 'Médéa', 27: 'Mostaganem', 28: "M'Sila",
    29: 'Mascara', 30: 'Ouargla', 31: 'Oran', 32: 'El Bayadh',
    33: 'Illizi', 34: 'Bordj Bou Arreridj', 35: 'Boumerdès', 36: 'El Tarf',
    37: 'Tindouf', 38: 'Tissemsilt', 39: 'El Oued', 40: 'Khenchela',
    41: 'Souk Ahras', 42: 'Tipaza', 43: 'Mila', 44: 'Aïn Defla',
    45: 'Naâma', 46: 'Aïn Témouchent', 47: 'Ghardaïa', 48: 'Relizane',
    49: 'Timimoun', 50: 'Bordj Badji Mokhtar', 51: 'Ouled Djellal',
    52: 'Béni Abbès', 53: 'In Salah', 54: 'In Guezzam',
    55: 'Touggourt', 56: 'Djanet', 57: "El M'Ghair", 58: 'El Menia',
  };

  static wilayaName(id) {
    return YalidineAdapter.WILAYA_NAMES[Number(id)] ?? null;
  }

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
      rateLimits: getProviderRateLimits(provider),
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

  async getRates(fromWilayaId = null, toWilayaId = null) {
    if (fromWilayaId == null) {
      throw new CourierError(`${this.providerEnum} requires a fromWilayaId to retrieve rates.`);
    }

    if (toWilayaId == null) {
      return this._getAllRatesForOrigin(fromWilayaId);
    }

    const data = await this.get('v1/fees', {
      from_wilaya_id: fromWilayaId,
      to_wilaya_id: toWilayaId,
    });

    const perCommune = data?.per_commune ?? {};
    const communeEntries = Object.values(perCommune);
    if (!Array.isArray(communeEntries) || communeEntries.length === 0) return [];

    const communes = communeEntries.map(c => ({
      id: c.commune_id,
      name: c.commune_name,
      nameAr: null,
      home: Number(c.express_home ?? c.economic_home ?? 0),
      desk: Number(c.express_desk ?? c.economic_desk ?? 0),
    }));

    const homes = communes.map(c => c.home).filter(v => v > 0);
    const desks = communes.map(c => c.desk).filter(v => v > 0);
    const minHome = homes.length > 0 ? Math.min(...homes) : 0;
    const minDesk = desks.length > 0 ? Math.min(...desks) : 0;

    return [new RateData({
      provider: this.providerEnum,
      toWilayaId,
      toWilayaName: String(data.to_wilaya_name ?? ''),
      homeDeliveryPrice: minHome,
      stopDeskPrice: minDesk,
      returnPrice: data.retour_fee != null ? Number(data.retour_fee) : null,
      oversizeFee: data.oversize_fee != null ? Number(data.oversize_fee) : null,
      deliveryType: DELIVERY_TYPE.HOME,
      fromWilayaId,
      hasCommunePricing: true,
      communes,
    })];
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

  /**
   * Build the Yalidine parcel payload for a single order.
   *
   * Yalidine's POST /v1/parcels expects an ARRAY of parcels and identifies
   * destinations by NAME (to_wilaya_name / to_commune_name / from_wilaya_name),
   * not by numeric ID. The `order_id` is the key under which the result is
   * returned, so it must be unique within a request.
   */
  _buildCreatePayload(data) {
    const toWilayaName = YalidineAdapter.wilayaName(data.toWilayaId) ?? data.toWilayaName ?? null;
    const fromWilayaName = data.fromWilayaId != null
      ? YalidineAdapter.wilayaName(data.fromWilayaId)
      : (data.fromWilayaName ?? null);

    if (!toWilayaName) {
      throw new CourierError(
        `${this.providerEnum} requires a destination wilaya name (toWilayaId ${data.toWilayaId} unresolved).`,
      );
    }

    // Yalidine accepts several phone numbers in contact_phone, comma-separated.
    const contactPhone = data.phoneAlt != null && data.phoneAlt !== ''
      ? `${data.phone},${data.phoneAlt}`
      : String(data.phone);

    const payload = {
      order_id: data.orderId,
      from_wilaya_name: fromWilayaName,
      firstname: data.firstName,
      familyname: data.lastName,
      contact_phone: contactPhone,
      address: data.address,
      to_wilaya_name: toWilayaName,
      to_commune_name: data.toCommune,
      product_list: data.productDescription,
      price: Math.round(data.price),
      do_insurance: data.doInsurance ?? false,
      freeshipping: Boolean(data.freeShipping),
      is_stopdesk: data.deliveryType === DELIVERY_TYPE.STOP_DESK,
      has_exchange: Boolean(data.hasExchange),
    };

    if (data.declaredValue != null) payload.declared_value = Math.round(data.declaredValue);
    if (data.stopDeskId != null) payload.stopdesk_id = data.stopDeskId;
    if (data.weight != null) payload.weight = data.weight;
    if (data.length != null) payload.length = data.length;
    if (data.width != null) payload.width = data.width;
    if (data.height != null) payload.height = data.height;
    if (data.hasExchange && data.exchangeProduct != null) {
      payload.product_to_collect = data.exchangeProduct;
    }

    return payload;
  }

  /**
   * POST one or more parcels and return per-order results in input order.
   * @param {Array} dataArray
   * @returns {Promise<Array<{orderId:string, success:boolean, tracking:string|null, label:string|null, message:string, order:OrderData|null}>>}
   */
  async _createParcels(dataArray) {
    const payloads = dataArray.map((d) => this._buildCreatePayload(d));
    const response = await this.post('v1/parcels', payloads);

    return dataArray.map((data) => {
      const entry = response?.[data.orderId] ?? null;
      const success = entry?.success === true && entry?.tracking != null;
      return {
        orderId: data.orderId,
        success,
        tracking: entry?.tracking ?? null,
        label: entry?.label ?? null,
        message: entry?.message ?? '',
        order: success
          ? this._hydrateOrder({
            order_id: data.orderId,
            tracking: entry.tracking,
            label: entry.label ?? null,
            firstname: data.firstName,
            familyname: data.lastName,
            contact_phone: data.phone,
            address: data.address,
            to_wilaya_id: Number(data.toWilayaId) || 0,
            to_commune_name: data.toCommune,
            price: Math.round(data.price),
            last_status: 'En préparation',
          })
          : null,
      };
    });
  }

  async createOrder(data) {
    const [result] = await this._createParcels([data]);
    if (!result.success) {
      throw new CourierError(
        `${this.providerEnum} rejected order [${data.orderId}]: ${result.message || 'unknown error'}`,
      );
    }
    return result.order;
  }

  /**
   * Create multiple parcels in a single request (Yalidine native bulk).
   * The doc does not specify a maximum batch size, so none is enforced here —
   * the template handles rate-limit batching upstream (Phase 5).
   * @param {Array} dataArray
   * @returns {Promise<Array>} per-order results
   */
  async bulkCreateOrders(dataArray) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return [];
    return this._createParcels(dataArray);
  }

  async getOrder(trackingNumber) {
    const response = await this.get(`v1/parcels/${trackingNumber}`);

    if (!response || Object.keys(response).length === 0) {
      throw new OrderNotFoundError(trackingNumber);
    }

    const parcel = response.data?.[0] ?? response.data ?? response;

    if (!parcel || Object.keys(parcel).length === 0) {
      throw new OrderNotFoundError(trackingNumber);
    }

    return this._hydrateOrder(parcel);
  }

  /**
   * Yalidine labels are URLs (the `label` field of the parcel object / creation
   * response) — there is no dedicated /label endpoint. Fetch the parcel and use it.
   */
  async getLabel(trackingNumber) {
    const order = await this.getOrder(trackingNumber);
    const url = order.raw?.label ?? null;

    if (!url) {
      throw new CourierError(
        `${this.providerEnum} returned no label URL for [${trackingNumber}].`,
      );
    }

    return LabelData.fromUrl(this.providerEnum, trackingNumber, url, LABEL_TYPE.HTML_URL);
  }

  /**
   * Delete one or more parcels (only possible while status is "en préparation").
   * @param {string|string[]} trackings
   * @returns {Promise<Array<{tracking:string, deleted:boolean}>>}
   */
  async bulkDeleteOrders(trackings) {
    const list = Array.isArray(trackings) ? trackings : [trackings];
    if (list.length === 0) return [];

    const response = await this._request('DELETE', 'v1/parcels/', {
      params: { tracking: list.join(',') },
    });

    // Response may be an array, or an object keyed by tracking.
    if (Array.isArray(response)) {
      return response.map((r) => ({ tracking: String(r.tracking ?? ''), deleted: Boolean(r.deleted) }));
    }
    return Object.entries(response ?? {}).map(([tracking, r]) => ({
      tracking,
      deleted: Boolean(r?.deleted ?? r),
    }));
  }

  async cancelOrder(trackingNumber) {
    const [res] = await this.bulkDeleteOrders([trackingNumber]);
    return Boolean(res?.deleted);
  }

  // ─── Reference data (wilayas / communes / centers) ────────────────────────

  /** Retrieve all deliverable wilayas. */
  async getWilayas() {
    return this._getAllPages('v1/wilayas/');
  }

  /**
   * Retrieve communes, optionally filtered by wilaya.
   * Each commune exposes `has_stop_desk` (0/1) and `is_deliverable`.
   * @param {number|null} [wilayaId]
   */
  async getCommunes(wilayaId = null) {
    const params = {};
    if (wilayaId != null) params.wilaya_id = wilayaId;
    return this._getAllPages('v1/communes/', params);
  }

  /**
   * Retrieve stop-desk centers (the `center_id` is the `stopdesk_id` used at creation).
   * @param {number|null} [wilayaId]
   */
  async getCenters(wilayaId = null) {
    const params = {};
    if (wilayaId != null) params.wilaya_id = wilayaId;
    return this._getAllPages('v1/centers/', params);
  }

  /**
   * Follow Yalidine pagination (page_size up to 1000) and return all `data` rows.
   * @param {string} path
   * @param {object} [params]
   * @returns {Promise<Array>}
   */
  async _getAllPages(path, params = {}) {
    const out = [];
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await this.get(path, { ...params, page, page_size: 1000 });
      const rows = res?.data ?? [];
      if (Array.isArray(rows)) out.push(...rows);
      if (!res?.has_more) break;
      page += 1;
    }
    return out;
  }

  async _getAllRatesForOrigin(fromWilayaId) {
    const rates = [];
    for (let toWilaya = 1; toWilaya <= 58; toWilaya++) {
      try {
        const row = await this.get('v1/fees', {
          from_wilaya_id: fromWilayaId,
          to_wilaya_id: toWilaya,
        });
        const perCommune = Object.values(row?.per_commune ?? {});
        if (Array.isArray(perCommune) && perCommune.length > 0) {
          const communes = perCommune.map(c => ({
            id: c.commune_id,
            name: c.commune_name,
            nameAr: null,
            home: Number(c.express_home ?? c.economic_home ?? 0),
            desk: Number(c.express_desk ?? c.economic_desk ?? 0),
          }));
          const homes = communes.map(c => c.home).filter(v => v > 0);
          const desks = communes.map(c => c.desk).filter(v => v > 0);
          const minHome = homes.length > 0 ? Math.min(...homes) : 0;
          const minDesk = desks.length > 0 ? Math.min(...desks) : 0;

          rates.push(new RateData({
            provider: this.providerEnum,
            toWilayaId: toWilaya,
            toWilayaName: String(row.to_wilaya_name ?? ''),
            homeDeliveryPrice: minHome,
            stopDeskPrice: minDesk,
            returnPrice: row.retour_fee != null ? Number(row.retour_fee) : null,
            oversizeFee: row.oversize_fee != null ? Number(row.oversize_fee) : null,
            deliveryType: DELIVERY_TYPE.HOME,
            fromWilayaId,
            hasCommunePricing: true,
            communes,
          }));
        }
      } catch (err) {
        continue;
      }
    }
    return rates;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _hydrateOrder(raw) {
    const rawStatus = String(raw.last_status ?? raw.status ?? '');

    const orderId = raw.order_id ?? raw.tracking ?? raw.id ?? '';
    const tracking = raw.tracking ?? raw.order_id ?? raw.id ?? '';

    return new OrderData({
      orderId: String(orderId),
      trackingNumber: String(tracking),
      provider: this.providerEnum,
      status: this.normalizeStatus(rawStatus),
      recipientName: `${raw.firstname ?? ''} ${raw.familyname ?? ''}`.trim(),
      phone: String(raw.contact_phone ?? ''),
      address: String(raw.address ?? ''),
      toWilayaId: Number(raw.to_wilaya_id ?? 0),
      toCommune: String(raw.to_commune_name ?? ''),
      price: Number(raw.price ?? 0),
      shippingFee: raw.delivery_fee != null ? Number(raw.delivery_fee) : null,
      rawStatus,
      notes: raw.note ?? null,
      createdAt: this.parseDate(raw.date_creation ?? raw.date),
      updatedAt: this.parseDate(raw.date_last_status ?? raw.last_update),
      raw,
    });
  }
}
