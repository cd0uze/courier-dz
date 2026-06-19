import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl } from '../enums/Provider.js';
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
   * Get effective delivery rates for all wilaya territories.
   * The fromWilayaId/toWilayaId parameters are accepted for consistency but ignored
   * — the endpoint always returns the full rate table for the supplier account.
   */
  async getRates(fromWilayaId = null, toWilayaId = null) {
    const response = await this.get('api/v1/delivery-pricing/rates');
    const rates = response.rates ?? [];

    if (!Array.isArray(rates) || rates.length === 0) return [];

    const result = [];

    for (const rate of rates) {
      if (!rate || typeof rate !== 'object') continue;

      // Only include wilaya-level entries — commune-level can't map to an integer wilaya code
      const level = String(rate.toTerritoryLevel ?? '').toLowerCase();
      if (level !== 'wilaya') continue;

      const wilayaCode = Number(rate.toTerritoryCode ?? 0);
      if (wilayaCode === 0) continue;

      if (toWilayaId != null && wilayaCode !== toWilayaId) continue;

      let homePrice = 0;
      let stopDeskPrice = 0;

      for (const dp of rate.deliveryPrices ?? []) {
        const type = String(dp.deliveryType ?? '').toLowerCase();
        const price = Number(dp.price ?? 0);
        if (type === 'home') homePrice = price;
        else if (type === 'pickup-point') stopDeskPrice = price;
      }

      result.push(new RateData({
        provider: PROVIDERS.ZREXPRESS_NEW,
        toWilayaId: wilayaCode,
        toWilayaName: String(rate.toTerritoryName ?? ''),
        homeDeliveryPrice: homePrice,
        stopDeskPrice,
        deliveryType: DELIVERY_TYPE.HOME,
        fromWilayaId,
      }));
    }

    return result;
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
    const [cityTerritoryId, districtTerritoryId, cleanNote] = this._parseTerritoryIds(
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

    const payload = {
      customer: {
        customerId: this._randomUuid(),
        name: `${data.firstName} ${data.lastName}`.trim(),
        phone: {
          number1: data.phone,
          number2: data.phoneAlt ?? null,
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

    if (data.deliveryType === DELIVERY_TYPE.STOP_DESK && data.stopDeskId != null) {
      payload.hubId = String(data.stopDeskId);
    }

    if (data.weight != null) {
      payload.weight = { weight: data.weight };
    }

    if (data.length != null || data.width != null || data.height != null) {
      payload.orderedProducts[0].length = data.length;
      payload.orderedProducts[0].width = data.width;
      payload.orderedProducts[0].height = data.height;
    }

    const response = await this.post('api/v1/parcels', payload);
    const parcelId = response.id ?? null;

    if (!parcelId) {
      throw new CourierError('ZR Express NEW did not return a parcel ID after creation.');
    }

    // Two-step: fetch the full parcel resource after creation
    return this.getOrder(parcelId);
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
    const remaining = [];

    for (const segment of String(notes ?? '').split('|')) {
      const s = segment.trim();
      if (s.startsWith('zr_city:')) {
        cityId = s.slice('zr_city:'.length).trim() || null;
      } else if (s.startsWith('zr_district:')) {
        districtId = s.slice('zr_district:'.length).trim() || null;
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
    ];
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
