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

// ─── Status mapping by integer ID (authoritative) ─────────────────────────────
/** @type {Record<number, string>} */
const STATUS_ID_MAP = {
  1: TRACKING_STATUS.PENDING,          // EN PREPARATION
  2: TRACKING_STATUS.PENDING,          // PRÊT À EXPÉDIER
  3: TRACKING_STATUS.PICKED_UP,        // EXPEDIE
  4: TRACKING_STATUS.IN_TRANSIT,       // VERS WILAYA (SAC)
  5: TRACKING_STATUS.IN_TRANSIT,       // CENTRE (HUB)
  6: TRACKING_STATUS.IN_TRANSIT,       // TRANSFERT (SAC)
  7: TRACKING_STATUS.OUT_FOR_DELIVERY, // SORTIE EN LIVRAISON
  8: TRACKING_STATUS.DELIVERED,        // LIVRÉ
  9: TRACKING_STATUS.FAILED_DELIVERY,  // ÉCHEC DE LIVRAISON
  10: TRACKING_STATUS.EXCEPTION,       // ALERT
  11: TRACKING_STATUS.FAILED_DELIVERY, // REPORTER (Date)
  12: TRACKING_STATUS.PENDING,         // EN ATTENTE
  13: TRACKING_STATUS.FAILED_DELIVERY, // TENTATIVE ÉCHOUÉE 1
  14: TRACKING_STATUS.FAILED_DELIVERY, // TENTATIVE ÉCHOUÉE 2
  15: TRACKING_STATUS.FAILED_DELIVERY, // TENTATIVE ÉCHOUÉE 3
  16: TRACKING_STATUS.RETURNING,       // RETOUR VERS CENTRE
  17: TRACKING_STATUS.RETURNING,       // RETOURNEE AU CENTRE
  18: TRACKING_STATUS.READY_FOR_PICKUP,// RETOUR A RETIRER
  19: TRACKING_STATUS.RETURNING,       // RETOUR VERS VENDEUR (SAC)
  20: TRACKING_STATUS.RETURNED,        // RETOURNEE AU VENDEUR (SAC)
  21: TRACKING_STATUS.IN_TRANSIT,      // SOCIETE PARTENAIRE
  22: TRACKING_STATUS.FAILED_DELIVERY, // REFUSÉ
  23: TRACKING_STATUS.PICKED_UP,       // PICKUP
  24: TRACKING_STATUS.IN_TRANSIT,      // En Dispatche
  25: TRACKING_STATUS.IN_TRANSIT,      // Dispatché
  26: TRACKING_STATUS.PENDING,         // WAREHOUSE EN PREPARATION
  27: TRACKING_STATUS.EXCEPTION,       // WAREHOUSE HORS STOCK
  28: TRACKING_STATUS.PENDING,         // WAREHOUSE PRET
  29: TRACKING_STATUS.RETURNED,        // WAREHOUSE RETOURNÉE
  30: TRACKING_STATUS.CANCELLED,       // WAREHOUSE DEMANDE ANNULATION
  31: TRACKING_STATUS.CANCELLED,       // WAREHOUSE ANNULÉE
  32: TRACKING_STATUS.EXCEPTION,       // WAREHOUSE RETOURNÉE ENDOMAGÉ
  33: TRACKING_STATUS.PENDING,         // PAS ENCORE RAMASSÉ
  34: TRACKING_STATUS.PENDING,         // DROPSHIP EN PREPARATION
  35: TRACKING_STATUS.PENDING,         // DROPSHIP PRET
  36: TRACKING_STATUS.READY_FOR_PICKUP,// ECHANGE A RETIRER
  37: TRACKING_STATUS.RETURNED,        // DROPSHIPS RETOURNEÉ
  38: TRACKING_STATUS.EXCEPTION,       // DROPSHIPS RETOURNEÉ ENDOMMAGÉ
  39: TRACKING_STATUS.PICKED_UP,       // ECHANGE COLLECTÉ
  40: TRACKING_STATUS.IN_TRANSIT,      // AU CENTRE
  41: TRACKING_STATUS.CANCELLED,       // DROPSHIPS DEMANDE ANNULATION
  42: TRACKING_STATUS.CANCELLED,       // DROPSHIPS ANNULÉE
  43: TRACKING_STATUS.PENDING,         // FRET EN PREPARATION
  44: TRACKING_STATUS.PENDING,         // FRET PRET
  45: TRACKING_STATUS.CANCELLED,       // FRET DEMANDE ANNULATION
  46: TRACKING_STATUS.CANCELLED,       // FRET ANNULÉE
  83: TRACKING_STATUS.EXCEPTION,       // Bloqué
  112: TRACKING_STATUS.IN_TRANSIT,     // En localisation
  113: TRACKING_STATUS.OUT_FOR_DELIVERY,// Prêt pour livreur
  114: TRACKING_STATUS.IN_TRANSIT,     // En Transit
  115: TRACKING_STATUS.IN_TRANSIT,     // En Hub
  116: TRACKING_STATUS.RETURNING,      // Retour (Station)
  118: TRACKING_STATUS.EXCEPTION,      // Perdu
};

// ─── Status fallback map by name (lowercase) ──────────────────────────────────
/** @type {Record<string, string>} */
const STATUS_NAME_MAP = {
  'en preparation': TRACKING_STATUS.PENDING,
  'prêt à expédier': TRACKING_STATUS.PENDING,
  'en attente': TRACKING_STATUS.PENDING,
  'pas encore ramassé': TRACKING_STATUS.PENDING,
  'expedie': TRACKING_STATUS.PICKED_UP,
  'pickup': TRACKING_STATUS.PICKED_UP,
  'echange collecté': TRACKING_STATUS.PICKED_UP,
  'vers wilaya ( sac )': TRACKING_STATUS.IN_TRANSIT,
  'centre ( hub )': TRACKING_STATUS.IN_TRANSIT,
  'transfert (sac)': TRACKING_STATUS.IN_TRANSIT,
  'societe partenaire': TRACKING_STATUS.IN_TRANSIT,
  'en dispatche': TRACKING_STATUS.IN_TRANSIT,
  'dispatché': TRACKING_STATUS.IN_TRANSIT,
  'au centre': TRACKING_STATUS.IN_TRANSIT,
  'en localisation': TRACKING_STATUS.IN_TRANSIT,
  'en transit': TRACKING_STATUS.IN_TRANSIT,
  'en hub': TRACKING_STATUS.IN_TRANSIT,
  'sortie en livraison': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'prêt pour livreur': TRACKING_STATUS.OUT_FOR_DELIVERY,
  'livré': TRACKING_STATUS.DELIVERED,
  'échec de livraison': TRACKING_STATUS.FAILED_DELIVERY,
  'reporter (date)': TRACKING_STATUS.FAILED_DELIVERY,
  'tentative échouée 1': TRACKING_STATUS.FAILED_DELIVERY,
  'tentative échouée 2': TRACKING_STATUS.FAILED_DELIVERY,
  'tentative échouée 3': TRACKING_STATUS.FAILED_DELIVERY,
  'refusé': TRACKING_STATUS.FAILED_DELIVERY,
  'retour vers centre': TRACKING_STATUS.RETURNING,
  'retournee au centre': TRACKING_STATUS.RETURNING,
  'retour vers vendeur (sac)': TRACKING_STATUS.RETURNING,
  'retour (station)': TRACKING_STATUS.RETURNING,
  'retournee au vendeur (sac)': TRACKING_STATUS.RETURNED,
  'warehouse retournée': TRACKING_STATUS.RETURNED,
  'dropships retourneé': TRACKING_STATUS.RETURNED,
  'retour a retirer': TRACKING_STATUS.READY_FOR_PICKUP,
  'echange a retirer': TRACKING_STATUS.READY_FOR_PICKUP,
  'alert': TRACKING_STATUS.EXCEPTION,
  'warehouse hors stock': TRACKING_STATUS.EXCEPTION,
  'bloqué': TRACKING_STATUS.EXCEPTION,
  'perdu': TRACKING_STATUS.EXCEPTION,
};

const DELIVERY_EXPRESS = 'Express';
const DELIVERY_FLEXIBLE = 'Flexible';
const DELIVERY_POINT_RELAIS = 'Point relais';

/**
 * Adapter for the Zimou Express API (v3).
 *
 * Zimou Express is a delivery router: it accepts a package, assigns it to the
 * best available partner carrier (Yalidine, Maystro, DHD, etc.), and returns
 * both its own tracking code and the sub-carrier's code.
 *
 * Auth: Authorization: Bearer {token}
 *
 * Delivery type hint via notes field:
 *   "zimou_delivery_type:Flexible|Your note here"  → uses Flexible instead of Express
 */
export class ZimouAdapter extends AbstractAdapter {
  /**
   * @param {object} params
   * @param {import('../data/credentials/TokenCredentials.js').TokenCredentials} params.credentials
   * @param {import('axios').AxiosInstance|null} [params.httpClient]
   */
  constructor({ credentials, httpClient = null }) {
    super({
      baseUrl: getBaseUrl(PROVIDERS.ZIMOU),
      defaultHeaders: {
        Authorization: `Bearer ${credentials.token}`,
      },
      httpClient,
    });
    this.providerEnum = PROVIDERS.ZIMOU;
    this.credentials = credentials;
  }

  /**
   * Normalize status — tries integer ID first, falls back to name string.
   * @param {string} rawStatus - Either a numeric string (status_id) or a name
   */
  normalizeStatus(rawStatus) {
    if (/^\d+$/.test(rawStatus)) {
      return STATUS_ID_MAP[Number(rawStatus)] ?? TRACKING_STATUS.UNKNOWN;
    }
    return STATUS_NAME_MAP[rawStatus.toLowerCase().trim()] ?? TRACKING_STATUS.UNKNOWN;
  }

  /** Normalize directly from the integer status_id (more reliable than by name). */
  normalizeStatusById(statusId) {
    return STATUS_ID_MAP[statusId] ?? TRACKING_STATUS.UNKNOWN;
  }

  async testCredentials() {
    try {
      await this.get('v3/user');
      return true;
    } catch {
      return false;
    }
  }

  async getRates(fromWilayaId = null, _toWilayaId = null) {
    const raw = await this.get('v3/my/prices');
    const rows = raw.data ?? raw;

    if (!Array.isArray(rows) || rows.length === 0) return [];

    return rows
      .filter((item) => item && typeof item === 'object')
      .map((item) => new RateData({
        provider: PROVIDERS.ZIMOU,
        toWilayaId: Number(item.wilaya_id ?? item.wilaya ?? 0),
        toWilayaName: String(item.wilaya_name ?? item.wilaya ?? ''),
        homeDeliveryPrice: Number(item.express_price ?? item.home_price ?? item.price ?? 0),
        stopDeskPrice: Number(item.stopdesk_price ?? item.point_relais_price ?? item.price ?? 0),
        deliveryType: DELIVERY_TYPE.HOME,
        fromWilayaId,
      }));
  }

  getCreateOrderValidationRules() {
    return {
      order_id: { required: true, type: 'string', maxLength: 255 },
      first_name: { required: true, type: 'string', maxLength: 255 },
      last_name: { required: true, type: 'string', maxLength: 255 },
      phone: { required: true, type: 'string', maxLength: 20 },
      address: { required: true, type: 'string', maxLength: 500 },
      to_wilaya_id: { required: true, type: 'integer', min: 1, max: 58 },
      to_commune: { required: true, type: 'string' },
      product_description: { required: true, type: 'string' },
      price: { required: true, type: 'number', min: 0 },
      delivery_type: { required: true, type: 'integer', enum: [1, 2] },
      phone_alt: { required: false, type: 'string', maxLength: 20 },
      notes: { required: false, type: 'string', maxLength: 500 },
      weight: { required: false, type: 'number', min: 1 },
      stop_desk_id: { required: false, type: 'integer' },
    };
  }

  async createOrder(data) {
    const [zimouDeliveryType, cleanNotes] = this._resolveDeliveryType(data);

    const payload = {
      type: 'ecommerce',
      name: data.productDescription,
      client_first_name: data.firstName,
      client_last_name: data.lastName,
      client_phone: data.phone,
      address: data.address,
      order_id: data.orderId,
      price: String(data.price),
      free_delivery: data.freeShipping ? 'true' : 'false',
      delivery_type: zimouDeliveryType,
      wilaya: String(data.toWilayaId),
      commune: data.toCommune,
      can_be_opened: true,
    };

    if (data.phoneAlt != null) payload.client_phone2 = data.phoneAlt;
    if (cleanNotes != null) payload.observation = cleanNotes;
    if (data.weight != null) payload.weight = data.weight;
    if (data.stopDeskId != null) payload.office_id = data.stopDeskId;
    if (data.hasExchange && data.exchangeProduct != null) {
      payload.returned_product = data.exchangeProduct;
    }
    if (data.length != null || data.width != null || data.height != null) {
      payload.volumetric = { length: data.length, width: data.width, height: data.height };
    }
    if (data.quantity != null && data.quantity > 0) {
      payload.quantity_items = data.quantity;
    }

    const response = await this.post('v3/packages', payload);

    if (response.error && Number(response.error) === 1) {
      throw new CourierError(
        `Zimou Express rejected the order: ${response.message ?? 'Unknown error'}`,
      );
    }

    return this._hydrateOrder(response.data ?? response);
  }

  /**
   * Retrieve an order by its Zimou tracking code or numeric package ID.
   *
   * If trackingNumber is all digits → GET /v3/packages/{id}
   * Otherwise → GET /v3/packages/status?packages[]={tracking_code}
   */
  async getOrder(trackingNumber) {
    if (/^\d+$/.test(trackingNumber)) {
      try {
        const response = await this.get(`v3/packages/${trackingNumber}`);
        const data = response.data ?? response;

        if (!data || Object.keys(data).length === 0 || data.message) {
          throw new OrderNotFoundError(trackingNumber);
        }

        return this._hydrateOrder(data);
      } catch (err) {
        if (err instanceof OrderNotFoundError) throw err;
        throw new OrderNotFoundError(trackingNumber, err);
      }
    }

    // Tracking-code path
    const response = await this.get('v3/packages/status', {
      'packages[]': trackingNumber,
    });

    const data = response[trackingNumber] ?? response?.data?.[trackingNumber] ?? null;

    if (!data || Object.keys(data).length === 0) {
      throw new OrderNotFoundError(trackingNumber);
    }

    return this._hydrateOrderFromStatus(trackingNumber, data);
  }

  async getLabel(trackingNumber) {
    let data;

    if (/^\d+$/.test(trackingNumber)) {
      const response = await this.get(`v3/packages/${trackingNumber}`);
      data = response.data ?? response;
    } else {
      const order = await this.getOrder(trackingNumber);
      const packageId = order.raw?.id;
      if (packageId) {
        const response = await this.get(`v3/packages/${packageId}`);
        data = response.data ?? response;
      } else {
        data = order.raw;
      }
    }

    const printUrl = data?.print_url;

    if (!printUrl) {
      throw new CourierError(`Zimou Express returned no print_url for [${trackingNumber}].`);
    }

    return LabelData.fromUrl(PROVIDERS.ZIMOU, trackingNumber, printUrl, LABEL_TYPE.PDF_URL);
  }

  async cancelOrder(trackingNumber) {
    try {
      const response = await this._request('DELETE', 'v3/packages/bulk', {
        data: { tracking_codes: [trackingNumber] },
      });
      return Boolean(response.success ?? true);
    } catch (err) {
      throw new CourierError(`Zimou Express cancel failed: ${err.message}`);
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Resolve Zimou-specific delivery type string and extract clean notes.
   * Convention for Flexible: notes = "zimou_delivery_type:Flexible|Your note"
   * @returns {[string, string|null]}
   */
  _resolveDeliveryType(data) {
    if (data.deliveryType === DELIVERY_TYPE.STOP_DESK) {
      return [DELIVERY_POINT_RELAIS, data.notes];
    }

    const notes = data.notes;
    if (notes != null && notes.startsWith('zimou_delivery_type:')) {
      const parts = notes.split('|');
      const typeHint = parts[0].replace('zimou_delivery_type:', '').trim();
      const cleanedNotes = parts[1]?.trim() || null;

      const zimouType = typeHint === 'Flexible'
        ? DELIVERY_FLEXIBLE
        : typeHint === 'Point relais'
          ? DELIVERY_POINT_RELAIS
          : DELIVERY_EXPRESS;

      return [zimouType, cleanedNotes];
    }

    return [DELIVERY_EXPRESS, notes];
  }

  _hydrateOrder(raw) {
    const statusId = raw.status_id != null ? Number(raw.status_id) : null;
    const rawStatus = String(raw.status_name ?? (statusId != null ? String(statusId) : ''));
    const status = statusId != null
      ? this.normalizeStatusById(statusId)
      : this.normalizeStatus(rawStatus);

    const wilayaId = Number(
      this.dig(raw, 'commune', 'wilaya_id') ?? raw.wilaya_id ?? 0,
    );

    const partnerName = raw.tracking_partner_company ?? null;
    const partnerTracking = raw.delivery_company_tracking_code ?? null;

    const notesLines = [
      raw.observation ?? null,
      partnerName ? `Via: ${partnerName}` : null,
      partnerTracking ? `Partner tracking: ${partnerTracking}` : null,
    ].filter(Boolean);

    return new OrderData({
      orderId: String(raw.order_id ?? ''),
      trackingNumber: String(raw.tracking_code ?? String(raw.id ?? '')),
      provider: PROVIDERS.ZIMOU,
      status,
      recipientName: `${raw.client_first_name ?? ''} ${raw.client_last_name ?? ''}`.trim(),
      phone: String(raw.client_phone ?? ''),
      address: String(raw.address ?? ''),
      toWilayaId: wilayaId,
      toCommune: String(this.dig(raw, 'commune', 'name') ?? raw.commune ?? ''),
      price: Number(raw.price ?? 0),
      shippingFee: raw.delivery_price != null ? Number(raw.delivery_price) : null,
      rawStatus,
      notes: notesLines.length > 0 ? notesLines.join(' | ') : null,
      createdAt: this.parseDate(raw.created_at),
      updatedAt: this.parseDate(raw.updated_at),
      raw,
    });
  }

  _hydrateOrderFromStatus(trackingNumber, raw) {
    const statusId = raw.status_id != null ? Number(raw.status_id) : null;
    const rawStatus = String(raw.status_name ?? (statusId != null ? String(statusId) : ''));
    const status = statusId != null
      ? this.normalizeStatusById(statusId)
      : this.normalizeStatus(rawStatus);

    return new OrderData({
      orderId: String(raw.order_id ?? ''),
      trackingNumber,
      provider: PROVIDERS.ZIMOU,
      status,
      recipientName: `${raw.client_first_name ?? ''} ${raw.client_last_name ?? ''}`.trim(),
      phone: String(raw.client_phone ?? ''),
      address: String(raw.address ?? ''),
      toWilayaId: Number(raw.wilaya_id ?? 0),
      toCommune: String(raw.commune ?? ''),
      price: Number(raw.price ?? 0),
      rawStatus,
      notes: raw.tracking_partner_company ? `Via: ${raw.tracking_partner_company}` : null,
      createdAt: this.parseDate(raw.created_at),
      updatedAt: this.parseDate(raw.updated_at),
      raw,
    });
  }
}
