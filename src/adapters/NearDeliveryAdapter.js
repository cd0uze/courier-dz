import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl, getProviderRateLimits } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { OrderData } from '../data/OrderData.js';
import { LabelData } from '../data/LabelData.js';
import { CourierError } from '../exceptions/CourierError.js';
import { OrderNotFoundError } from '../exceptions/OrderNotFoundError.js';

/**
 * Near Delivery numeric statuses → canonical TRACKING_STATUS.
 * Source: Vargo NearDeliveryParcelStatus enum.
 * @type {Record<number, string>}
 */
const STATUS_MAP = {
  0: TRACKING_STATUS.PENDING,            // Pending
  1: TRACKING_STATUS.PENDING,            // Waiting for pickup
  2: TRACKING_STATUS.PICKED_UP,          // Picked up
  3: TRACKING_STATUS.IN_TRANSIT,         // Arrived at warehouse
  5: TRACKING_STATUS.IN_TRANSIT,         // In transit
  6: TRACKING_STATUS.READY_FOR_PICKUP,   // Arrived at last center (buralist relay)
  7: TRACKING_STATUS.DELIVERED,          // Delivered
  10: TRACKING_STATUS.RETURNING,         // Return initialized
  11: TRACKING_STATUS.RETURNING,         // Return in transit
  12: TRACKING_STATUS.RETURNING,         // Return arrived at warehouse
  13: TRACKING_STATUS.RETURNING,         // Returned to last center
  14: TRACKING_STATUS.RETURNED,          // Return confirmed
  15: TRACKING_STATUS.RETURNING,         // Return in region
  16: TRACKING_STATUS.PICKED_UP,         // Pickup from sender
};

/**
 * Adapter for the Near Delivery API (https://api.neardelivery.app/api/v1).
 *
 * Near Delivery works through a network of "buralists" (tobacco-shop relay
 * points): every parcel must reference a destination `buralist_id`, resolved
 * via getOffices(). Pass it through `stopDeskId` on CreateOrderData.
 *
 * Auth: two headers — `ApiKey` + `ApiSecret`.
 */
export class NearDeliveryAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {{key: string, secret: string}} params.credentials
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(PROVIDERS.NEAR_DELIVERY),
      defaultHeaders: {
        ApiKey: credentials.key,
        ApiSecret: credentials.secret,
      },
      httpClient,
      rateLimits: getProviderRateLimits(PROVIDERS.NEAR_DELIVERY),
    });
    this.providerEnum = PROVIDERS.NEAR_DELIVERY;
    this.credentials = credentials;
  }

  normalizeStatus(rawStatus) {
    const code = Number(rawStatus);
    if (Number.isInteger(code) && code in STATUS_MAP) return STATUS_MAP[code];
    return TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      await this.get('sender/centers');
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
      address: { required: false, type: 'string' },
      to_wilaya_id: { required: true, type: 'string_or_integer' },
      to_commune: { required: true, type: 'string' },
      product_description: { required: true, type: 'string' },
      price: { required: true, type: 'number', min: 0 },
      /** Destination buralist (relay point) id — resolve via getOffices(). */
      stop_desk_id: { required: true, type: 'integer' },
      notes: { required: false, type: 'string' },
    };
  }

  _buildParcel(data) {
    if (data.stopDeskId == null) {
      throw new CourierError(
        'Near Delivery requires a destination buralist id. Resolve it via ' +
        'getOffices() and pass it as stopDeskId on CreateOrderData.',
      );
    }
    const parcel = {
      recipient_name: `${data.firstName} ${data.lastName}`.trim(),
      recipient_phone: data.phone,
      recipient_wilaya: String(data.toWilayaId),
      recipient_commune: data.toCommune,
      // COD when price > 0, otherwise pre-paid
      payment_preference: data.price > 0 ? 1 : 0,
      pickup_location_type: 1,
      buralist_id: Number(data.stopDeskId),
      size: 'S',
      items: [
        {
          name: data.productDescription || 'Parcel content',
          quantity: data.quantity != null && data.quantity > 0 ? data.quantity : 1,
          unit_price: Number(data.price ?? 0),
        },
      ],
    };
    if (data.address != null) parcel.recipient_address = data.address;
    if (data.orderId) parcel.reference = data.orderId;
    return parcel;
  }

  async createOrder(data) {
    const response = await this.post('sender/parcels', { parcels: [this._buildParcel(data)] });
    const parcel = this._extractParcels(response)[0];
    const tracking = String(parcel?.tracking_number ?? '');
    if (!tracking) {
      throw new CourierError(
        `Near Delivery createOrder returned no tracking number: ${JSON.stringify(response)}`,
      );
    }
    return this._hydrateOrder(parcel, data);
  }

  /** Native bulk create — Near Delivery accepts an array of parcels in one call. */
  async bulkCreateOrders(dataArray) {
    const list = Array.isArray(dataArray) ? dataArray : [dataArray];
    const response = await this.post('sender/parcels', {
      parcels: list.map((d) => this._buildParcel(d)),
    });
    return this._extractParcels(response).map((p, i) => ({
      orderId: list[i]?.orderId ?? p?.reference ?? null,
      success: Boolean(p?.tracking_number),
      tracking: p?.tracking_number ?? null,
      raw: p,
    }));
  }

  async getOrder(trackingNumber) {
    const parcel = await this._fetchByTracking(trackingNumber);
    if (!parcel) throw new OrderNotFoundError(trackingNumber);
    return this._hydrateOrder(parcel);
  }

  /** Status history events (sender view). */
  async getTrackingHistory(trackingNumber) {
    // vargo's `parcels/{t}/status-history/sender` 404s in production — the
    // parcel resource itself (statuses embedded) is the reliable source.
    const response = await this.get(`sender/parcels/${encodeURIComponent(trackingNumber)}`);
    const parcel = response?.data ?? response?.parcel ?? response;
    const history = parcel?.status_history ?? parcel?.statuses ?? parcel?.history;
    if (Array.isArray(history)) return history;
    return parcel && typeof parcel === 'object' ? [parcel] : [];
  }

  async cancelOrder(trackingNumber) {
    const parcel = await this._fetchByTracking(trackingNumber);
    const id = parcel?.id ?? parcel?.parcel_id;
    if (!id) throw new OrderNotFoundError(trackingNumber);
    await this.delete(`sender/parcels/${id}`);
    return true;
  }

  async updateOrder(trackingNumber, fields) {
    const parcel = await this._fetchByTracking(trackingNumber);
    const id = parcel?.id ?? parcel?.parcel_id;
    if (!id) throw new OrderNotFoundError(trackingNumber);
    return this.patch(`sender/parcels/${id}`, fields);
  }

  async getLabel(trackingNumber) {
    const rawPdf = await this.requestRaw(
      'GET',
      `sender/parcels/${encodeURIComponent(trackingNumber)}/bordereau`,
    );
    if (!rawPdf || rawPdf.length === 0) {
      throw new CourierError(`Near Delivery returned an empty label for [${trackingNumber}].`);
    }
    return LabelData.fromBase64(PROVIDERS.NEAR_DELIVERY, trackingNumber, rawPdf.toString('base64'));
  }

  /** Buralist relay points — each `id` is the buralist_id used on create. */
  /** Deliverable wilayas (`GET sender/wilayas` — live-verified path). */
  async getWilayas() {
    const response = await this.get('sender/wilayas');
    const items = response?.data ?? response?.items ?? response;
    if (!Array.isArray(items)) return [];
    return items.map((w) => ({
      id: Number(w.id ?? w.code ?? 0),
      name: String(w.name ?? w.nom ?? ''),
      raw: w,
    }));
  }

  async getOffices() {
    const response = await this.get('sender/buralists');
    const items = response?.data ?? response?.items ?? response;
    if (!Array.isArray(items)) return [];
    return items.map((b) => ({
      id: b.id != null ? Number(b.id) : null,
      name: String(b.name ?? ''),
      address: b.address != null ? String(b.address) : null,
      wilaya: b.wilaya != null ? String(b.wilaya) : null,
      commune: b.commune != null ? String(b.commune) : null,
      raw: b,
    }));
  }

  /** Sender centers (drop-off points). */
  async getCenters() {
    const response = await this.get('sender/centers');
    const items = response?.data ?? response?.items ?? response;
    return Array.isArray(items) ? items : [];
  }

  /** Delivery fee grid (GET sender/delivery-fees). */
  async getRates(fromWilayaId = null, toWilayaId = null) {
    const params = {};
    if (toWilayaId != null) params.wilaya = toWilayaId;
    const response = await this.get('sender/delivery-fees', params);
    const items = response?.data ?? response?.items ?? response;
    return Array.isArray(items) ? items : [];
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  async _fetchByTracking(trackingNumber) {
    const response = await this.get(`sender/parcels/${encodeURIComponent(trackingNumber)}`);
    const body = response?.data ?? response?.parcel ?? response;
    if (Array.isArray(body)) return body[0] ?? null;
    return body && typeof body === 'object' && Object.keys(body).length > 0 ? body : null;
  }

  _extractParcels(response) {
    const body = response?.data ?? response?.parcels ?? response;
    if (Array.isArray(body)) return body;
    if (body && typeof body === 'object') return [body];
    return [];
  }

  _hydrateOrder(raw, requestData = null) {
    const rawStatus = String(raw.status ?? raw.status_id ?? '');
    return new OrderData({
      orderId: String(raw.reference ?? requestData?.orderId ?? ''),
      trackingNumber: String(raw.tracking_number ?? ''),
      provider: PROVIDERS.NEAR_DELIVERY,
      status: this.normalizeStatus(rawStatus),
      recipientName: String(raw.recipient_name ?? (requestData ? `${requestData.firstName} ${requestData.lastName}` : '')),
      phone: String(raw.recipient_phone ?? requestData?.phone ?? ''),
      address: String(raw.recipient_address ?? requestData?.address ?? ''),
      toWilayaId: Number(raw.recipient_wilaya ?? requestData?.toWilayaId ?? 0) || 0,
      toCommune: String(raw.recipient_commune ?? requestData?.toCommune ?? ''),
      price: Number(raw.cod_amount ?? raw.amount ?? requestData?.price ?? 0),
      shippingFee: raw.delivery_fee != null ? Number(raw.delivery_fee) : null,
      rawStatus,
      notes: null,
      createdAt: this.parseDate(raw.created_at),
      updatedAt: this.parseDate(raw.updated_at),
      raw,
    });
  }
}
