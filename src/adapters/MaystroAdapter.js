import { AbstractAdapter } from './AbstractAdapter.js';
import { PROVIDERS, getBaseUrl } from '../enums/Provider.js';
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
    });
    this.providerEnum = PROVIDERS.MAYSTRO;
    this.credentials = credentials;
  }

  normalizeStatus(rawStatus) {
    return STATUS_MAP[rawStatus.toLowerCase()] ?? TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      await this.get('base/wilayas/', { country: 1 });
      return true;
    } catch {
      return false;
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
      to_commune: { required: true, type: 'integer', min: 1 },
      product_description: { required: true, type: 'string' },
      price: { required: true, type: 'integer' },
      delivery_type: { required: true, type: 'integer', enum: [1, 2] },
      notes: { required: false, type: 'string', maxLength: 255 },
    };
  }

  async createOrder(data) {
    // Maystro delivery_type: 0 = home, 1 = stop desk (inverse of our enum values)
    const maystroDeliveryType = data.deliveryType === DELIVERY_TYPE.STOP_DESK ? 1 : 0;

    const payload = {
      wilaya: data.toWilayaId,
      commune: data.toCommune,
      customer_phone: data.phone,
      customer_name: `${data.firstName} ${data.lastName}`,
      product_price: Math.round(data.price),
      delivery_type: maystroDeliveryType,
      source: 4, // required constant per Maystro docs
      products: [{ name: data.productDescription, quantity: 1 }],
      external_order_id: data.orderId,
    };

    if (data.notes != null) payload.note_to_driver = data.notes;
    if (data.address != null) payload.destination_text = data.address;
    if (data.stopDeskId != null) payload.stop_desk_id = data.stopDeskId;

    const response = await this.post('stores/orders/', payload);
    return this._hydrateOrder(response);
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
