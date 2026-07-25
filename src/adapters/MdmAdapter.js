import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl, getProviderRateLimits } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { DELIVERY_TYPE } from '../enums/DeliveryType.js';
import { OrderData } from '../data/OrderData.js';
import { CourierError } from '../exceptions/CourierError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

/**
 * MDM Express statuses → canonical TRACKING_STATUS.
 * Source: Vargo MdmPackageStatus enum.
 * @type {Record<string, string>}
 */
const STATUS_MAP = {
  pending: TRACKING_STATUS.PENDING,
  confirmed: TRACKING_STATUS.PICKED_UP,
  shipped: TRACKING_STATUS.IN_TRANSIT,
  delivered: TRACKING_STATUS.DELIVERED,
  cancelled: TRACKING_STATUS.CANCELLED,
  returned: TRACKING_STATUS.RETURNED,
  expired: TRACKING_STATUS.EXCEPTION,
  archived: TRACKING_STATUS.EXCEPTION,
};

/**
 * Adapter for the MDM Express API (https://api.mdm.express, /api/v2).
 *
 * MDM natively supports both `freeShipping` and `fragile` flags on order
 * creation — CreateOrderData.freeShipping / .fragile are forwarded as-is.
 *
 * Auth: `x-api-key` header.
 *
 * MDM identifies the destination by a provider-side `cityId`: pass the MDM
 * city/commune id in `toCommune` (resolve names beforehand on your side).
 */
export class MdmAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/TokenCredentials.js').TokenCredentials} params.credentials
   * @param {string|null} [params.storeId] - Optional MDM store id used on create/bulk
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, storeId = null, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(PROVIDERS.MDM),
      defaultHeaders: { 'x-api-key': credentials.token },
      httpClient,
      rateLimits: getProviderRateLimits(PROVIDERS.MDM),
    });
    this.providerEnum = PROVIDERS.MDM;
    this.credentials = credentials;
    this.storeId = storeId;
  }

  normalizeStatus(rawStatus) {
    return STATUS_MAP[String(rawStatus ?? '').toLowerCase().trim()] ?? TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      await this.post('api/v2/orders/search', { page: 1, pageSize: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * MDM's country id for Algeria (`GET api/geo/countries?search=Algeria`),
   * cached on the instance. Falls back to the documented 'DZA'.
   */
  async _countryId() {
    if (this._dzCountryId) return this._dzCountryId;
    try {
      const res = await this.get('api/geo/countries', { search: 'Algeria' });
      const list = res?.list ?? res;
      const dz = Array.isArray(list) ? list.find((c) => c?.iso2 === 'DZ') : null;
      this._dzCountryId = dz?.id ?? 'DZA';
    } catch {
      this._dzCountryId = 'DZA';
    }
    return this._dzCountryId;
  }

  /**
   * Deliverable wilayas (`GET api/geo/countries/{id}/deliverable-states`).
   * MDM state ids look like 'DZA16' — the numeric wilaya code is derived.
   * @returns {Promise<Array<{id:number, name:string, nameAr:string, nativeId:string, raw:object}>>}
   */
  async getWilayas() {
    const countryId = await this._countryId();
    const res = await this.get(`api/geo/countries/${encodeURIComponent(countryId)}/deliverable-states`);
    const list = res?.list ?? res;
    if (!Array.isArray(list)) return [];
    return list.map((st) => ({
      id: Number(String(st.id ?? '').replace(/\D/g, '')) || 0,
      name: String(st.name ?? ''),
      nameAr: String(st.nameAr ?? st.name ?? ''),
      nativeId: String(st.id ?? ''),
      raw: st,
    }));
  }

  /**
   * Communes/cities (`GET api/geo/cities?countryId[]=…&stateId[]=DZA{nn}`).
   * The returned `id` is the value to pass as `toCommune` (order cityId).
   * @param {number|string|null} [wilayaId] - numeric wilaya code or MDM state id
   * @returns {Promise<Array<{id:string, name:string, nameAr:string, wilayaId:number, zipCode:string, raw:object}>>}
   */
  async getCommunes(wilayaId = null) {
    const countryId = await this._countryId();
    const params = { 'countryId[]': countryId, perPage: 1000 };
    if (wilayaId != null) {
      const stateId = /^\d+$/.test(String(wilayaId))
        ? `DZA${String(wilayaId).padStart(2, '0')}`
        : String(wilayaId);
      params['stateId[]'] = stateId;
    }
    const res = await this.get('api/geo/cities', params);
    const list = res?.list ?? res;
    if (!Array.isArray(list)) return [];
    return list.map((c) => ({
      id: String(c.id ?? ''),
      name: String(c.name ?? ''),
      nameAr: String(c.nameAr ?? c.name ?? ''),
      wilayaId: Number(c.stateCode ?? String(c.stateId ?? '').replace(/\D/g, '')) || 0,
      zipCode: String(c.zipCode ?? ''),
      raw: c,
    }));
  }

  /**
   * Stop-desk offices (`GET api/v2/shipping/companies/offices`), optionally
   * filtered to a wilaya (numeric code → MDM state id 'DZA{nn}').
   * @param {number|string|null} [wilayaId]
   * @returns {Promise<Array<{id:string, name:string, address:(string|null), wilayaId:number, cityId:(string|null), raw:object}>>}
   */
  async getOffices(wilayaId = null) {
    const countryId = await this._countryId();
    const params = { countryId };
    if (wilayaId != null) {
      params.stateId = /^\d+$/.test(String(wilayaId))
        ? `DZA${String(wilayaId).padStart(2, '0')}`
        : String(wilayaId);
    }
    const res = await this.get('api/v2/shipping/companies/offices', params);
    const list = res?.list ?? res;
    if (!Array.isArray(list)) return [];
    return list.map((o) => ({
      id: String(o.id ?? ''),
      name: String(o.name ?? ''),
      address: o.address != null ? String(o.address) : null,
      wilayaId: Number(String(o.stateId ?? '').replace(/\D/g, '')) || 0,
      cityId: o.cityId != null ? String(o.cityId) : null,
      raw: o,
    }));
  }

  getCreateOrderValidationRules() {
    return {
      order_id: { required: false, type: 'string', maxLength: 255 },
      first_name: { required: true, type: 'string', maxLength: 100 },
      last_name: { required: true, type: 'string', maxLength: 100 },
      phone: { required: true, type: 'string' },
      address: { required: true, type: 'string' },
      /** MDM city/commune id (provider-side identifier). */
      to_commune: { required: true, type: 'string' },
      product_description: { required: true, type: 'string' },
      price: { required: true, type: 'number', min: 0 },
      delivery_type: { required: true, type: 'integer', enum: [1, 2] },
      free_shipping: { required: false, type: 'boolean' },
      fragile: { required: false, type: 'boolean' },
      weight: { required: false, type: 'number' },
      notes: { required: false, type: 'string' },
    };
  }

  _buildOrder(data) {
    const isStopDesk = data.deliveryType === DELIVERY_TYPE.STOP_DESK;
    const order = {
      totalPrice: Number(data.price ?? 0),
      client: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        phone2: data.phoneAlt ?? null,
      },
      destination: {
        cityId: String(data.toCommune),
        streetAddress: data.address ?? '',
      },
      products: [
        {
          name: data.productDescription || 'Produit',
          quantity: data.quantity != null && data.quantity > 0 ? data.quantity : 1,
          price: Number(data.price ?? 0),
        },
      ],
      freeShipping: Boolean(data.freeShipping),
      fragile: Boolean(data.fragile),
      isStopDesk,
    };
    if (this.storeId) order.storeId = this.storeId;
    if (isStopDesk && data.stopDeskId != null) order.stopDeskId = data.stopDeskId;
    if (data.notes) order.notes = data.notes;
    if (data.weight != null) order.weight = Number(data.weight);
    if (data.height != null) order.height = Number(data.height);
    if (data.width != null) order.width = Number(data.width);
    if (data.length != null) order.length = Number(data.length);
    return order;
  }

  async createOrder(data) {
    const response = await this.post('api/v2/orders', this._buildOrder(data));
    const body = response?.data ?? response;
    const tracking = String(body?.trackingId ?? body?.tracking ?? body?.id ?? '');
    if (!tracking) {
      throw new CourierError(
        `MDM createOrder returned no tracking id: ${JSON.stringify(response)}`,
      );
    }
    return this._hydrateOrder({ ...body, trackingId: tracking }, data);
  }

  /** Native bulk create: POST api/v2/orders/bulk. */
  async bulkCreateOrders(dataArray) {
    const list = Array.isArray(dataArray) ? dataArray : [dataArray];
    const payload = {
      orders: list.map((d) => this._buildOrder(d)),
    };
    if (this.storeId) payload.storeId = this.storeId;
    const response = await this.post('api/v2/orders/bulk', payload);
    const results = response?.data ?? response?.orders ?? response;
    return Array.isArray(results) ? results : [results];
  }

  async getOrder(trackingNumber) {
    const response = await this.get(`api/v2/orders/${encodeURIComponent(trackingNumber)}`);
    const body = response?.data ?? response;
    if (!body || Object.keys(body).length === 0) throw new OrderNotFoundError(trackingNumber);
    return this._hydrateOrder(body);
  }

  /** Status history events (GET api/v2/orders/{tracking}/status-history). */
  async getTrackingHistory(trackingNumber) {
    const response = await this.get(`api/v2/orders/${encodeURIComponent(trackingNumber)}/status-history`);
    const items = response?.data ?? response;
    return Array.isArray(items) ? items : [];
  }

  /** Search orders (POST api/v2/orders/search). */
  async searchOrders(filters = {}) {
    const response = await this.post('api/v2/orders/search', filters);
    const items = response?.data ?? response?.items ?? response;
    return (Array.isArray(items) ? items : []).map((o) => this._hydrateOrder(o));
  }

  /** Order counters by status (GET api/v2/orders/statistics/statuses). */
  async getStatusStatistics(filters = {}) {
    return this.get('api/v2/orders/statistics/statuses', filters);
  }

  /**
   * Generate parcel slips (labels): POST api/prints/parcel-slips → { fileId },
   * then the file itself is downloadable via getLabelFile(fileId).
   */
  async generateLabels(trackingNumbers, options = {}) {
    const list = Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers];
    return this.post('api/prints/parcel-slips', { trackingIds: list, ...options });
  }

  /** Download a generated print file as raw bytes (GET api/prints/files/{fileId}). */
  async getLabelFile(fileId) {
    return this.requestRaw('GET', `api/prints/files/${encodeURIComponent(fileId)}`);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _hydrateOrder(raw, requestData = null) {
    const rawStatus = String(raw.status ?? '');
    const client = raw.client ?? {};
    const destination = raw.destination ?? {};
    return new OrderData({
      orderId: String(raw.externalId ?? raw.reference ?? requestData?.orderId ?? ''),
      trackingNumber: String(raw.trackingId ?? raw.tracking ?? raw.id ?? ''),
      provider: PROVIDERS.MDM,
      status: this.normalizeStatus(rawStatus),
      recipientName: `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim()
        || (requestData ? `${requestData.firstName} ${requestData.lastName}` : ''),
      phone: String(client.phone ?? requestData?.phone ?? ''),
      address: String(destination.streetAddress ?? requestData?.address ?? ''),
      toWilayaId: Number(requestData?.toWilayaId ?? 0) || 0,
      toCommune: String(destination.cityId ?? requestData?.toCommune ?? ''),
      price: Number(raw.totalPrice ?? requestData?.price ?? 0),
      shippingFee: raw.deliveryPrice != null ? Number(raw.deliveryPrice) : null,
      rawStatus,
      notes: raw.notes ?? null,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt),
      raw,
    });
  }
}
