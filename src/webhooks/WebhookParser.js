import { PROVIDERS, isYalidineEngine, isEcotrackEngine, isProcolisEngine } from '../enums/Provider.js';
import { TRACKING_STATUS } from '../enums/TrackingStatus.js';
import { MaystroAdapter } from '../adapters/MaystroAdapter.js';
import { YalidineAdapter } from '../adapters/YalidineAdapter.js';
import { EcotrackAdapter } from '../adapters/EcotrackAdapter.js';
import { ProcolisAdapter } from '../adapters/ProcolisAdapter.js';
import { ZimouAdapter } from '../adapters/ZimouAdapter.js';
import { ZrExpressNewAdapter } from '../adapters/ZrExpressNewAdapter.js';
import { NoestAdapter } from '../adapters/NoestAdapter.js';
import { ElogistiaAdapter } from '../adapters/ElogistiaAdapter.js';
import { NearDeliveryAdapter } from '../adapters/NearDeliveryAdapter.js';
import { EcomDeliveryAdapter } from '../adapters/EcomDeliveryAdapter.js';
import { MdmAdapter } from '../adapters/MdmAdapter.js';

/**
 * Normalized webhook event emitted by parseWebhookPayload().
 *
 * @typedef {object} WebhookEvent
 * @property {string} provider - Provider ID the payload came from
 * @property {string|null} trackingNumber - Provider tracking number, if present
 * @property {string|null} orderId - Your external order id, if the provider echoes it
 * @property {string|null} rawStatus - Untranslated provider status
 * @property {string} status - Canonical TRACKING_STATUS value
 * @property {Date|null} occurredAt - Event timestamp when the payload carries one
 * @property {object} raw - The untouched payload
 */

/**
 * Resolve the status normalizer for a provider without instantiating an
 * adapter (adapter normalizeStatus methods only read module-level maps).
 */
function statusNormalizerFor(provider) {
  let proto = null;
  if (provider === PROVIDERS.MAYSTRO) proto = MaystroAdapter.prototype;
  else if (isYalidineEngine(provider)) proto = YalidineAdapter.prototype;
  else if (isEcotrackEngine(provider)) proto = EcotrackAdapter.prototype;
  else if (isProcolisEngine(provider)) proto = ProcolisAdapter.prototype;
  else if (provider === PROVIDERS.ZIMOU) proto = ZimouAdapter.prototype;
  else if (provider === PROVIDERS.ZREXPRESS_NEW) proto = ZrExpressNewAdapter.prototype;
  else if (provider === PROVIDERS.NOEST) proto = NoestAdapter.prototype;
  else if (provider === PROVIDERS.ELOGISTIA) proto = ElogistiaAdapter.prototype;
  else if (provider === PROVIDERS.NEAR_DELIVERY) proto = NearDeliveryAdapter.prototype;
  else if (provider === PROVIDERS.ECOM_DELIVERY) proto = EcomDeliveryAdapter.prototype;
  else if (provider === PROVIDERS.MDM) proto = MdmAdapter.prototype;

  if (!proto) return () => TRACKING_STATUS.UNKNOWN;
  return (raw) => proto.normalizeStatus(raw);
}

/** Keys commonly carrying the tracking number across provider payloads. */
const TRACKING_KEYS = [
  'tracking', 'tracking_number', 'trackingNumber', 'tracking_code', 'trackingId',
  'Tracking', 'code', 'parcel_id', 'parcelId',
];

/** Keys commonly carrying the raw status across provider payloads. */
const STATUS_KEYS = [
  'status', 'new_status', 'newStatus', 'state', 'status_id', 'statusId',
  'Statut', 'statut', 'situation', 'Situation', 'etat',
];

/** Keys commonly carrying your external order id. */
const ORDER_ID_KEYS = [
  'external_order_id', 'externalOrderId', 'external_id', 'externalId',
  'id_Externe', 'ID_Externe', 'reference', 'order_id', 'orderId', 'display_id',
];

/** Keys commonly carrying the event timestamp. */
const DATE_KEYS = [
  'occurred_at', 'occurredAt', 'updated_at', 'updatedAt', 'created_at',
  'createdAt', 'date', 'timestamp', 'event_date',
];

function firstValue(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

/**
 * Parse a raw webhook payload from any supported provider into a normalized
 * {@link WebhookEvent}. The extraction is defensive: providers wrap the parcel
 * under `data` / `order` / `parcel` / `Colis[0]` or send it at the top level.
 *
 * @param {string} provider - Provider ID the webhook is registered with
 * @param {object} body - Parsed JSON body of the incoming webhook request
 * @returns {WebhookEvent}
 */
function tryParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Maystro delivers webhook bodies as JSON that has been base64-encoded TWICE
 * (official GitBook docs). Decode progressively: direct JSON, then one and two
 * base64 passes. Returns null when nothing yields an object.
 */
function decodeDoubleBase64Json(text) {
  let step = String(text ?? '').trim().replace(/^"+|"+$/g, '');
  let parsed = tryParseJson(step);
  for (let i = 0; i < 2 && (parsed == null || typeof parsed !== 'object'); i++) {
    try { step = Buffer.from(step, 'base64').toString('utf8'); } catch { return null; }
    parsed = tryParseJson(step);
  }
  return parsed && typeof parsed === 'object' ? parsed : null;
}

export function parseWebhookPayload(provider, body) {
  let input = body;
  // Maystro: body may arrive as a (double) base64-encoded JSON string, or as
  // an object whose `data`/`payload` field carries the encoded message.
  if (provider === PROVIDERS.MAYSTRO) {
    if (typeof input === 'string') input = decodeDoubleBase64Json(input) ?? {};
    else if (input && typeof input.data === 'string') input = decodeDoubleBase64Json(input.data) ?? input;
    else if (input && typeof input.payload === 'string') {
      const decoded = tryParseJson(input.payload) ?? decodeDoubleBase64Json(input.payload);
      if (decoded) input = { ...input, payload: decoded };
    }
  }
  const raw = input && typeof input === 'object' ? input : {};

  // Unwrap the parcel object from common envelopes.
  let parcel = raw;
  for (const key of ['data', 'order', 'parcel', 'shipment', 'payload']) {
    if (raw[key] && typeof raw[key] === 'object' && !Array.isArray(raw[key])) {
      parcel = raw[key];
      break;
    }
  }
  if (Array.isArray(raw.Colis) && raw.Colis[0] && typeof raw.Colis[0] === 'object') {
    parcel = raw.Colis[0];
  }

  const rawStatusValue = firstValue(parcel, STATUS_KEYS) ?? firstValue(raw, STATUS_KEYS);
  const rawStatus = rawStatusValue != null ? String(rawStatusValue) : null;
  const normalize = statusNormalizerFor(provider);

  // `id` is only trusted inside the unwrapped parcel object (for Maystro the
  // order id IS the tracking identifier) — at the top level it may be the
  // webhook event id.
  const tracking = firstValue(parcel, TRACKING_KEYS)
    ?? firstValue(raw, TRACKING_KEYS)
    ?? (parcel !== raw ? firstValue(parcel, ['id']) : null);
  const orderId = firstValue(parcel, ORDER_ID_KEYS) ?? firstValue(raw, ORDER_ID_KEYS);
  const dateValue = firstValue(parcel, DATE_KEYS) ?? firstValue(raw, DATE_KEYS);

  let occurredAt = null;
  if (dateValue != null) {
    const d = new Date(dateValue);
    if (!Number.isNaN(d.getTime())) occurredAt = d;
  }

  return {
    provider,
    trackingNumber: tracking != null ? String(tracking) : null,
    orderId: orderId != null ? String(orderId) : null,
    rawStatus,
    status: rawStatus != null ? normalize(rawStatus) : TRACKING_STATUS.UNKNOWN,
    occurredAt,
    raw,
  };
}

/**
 * Providers able to push status changes via webhooks (register with the
 * matching adapter methods). Everything else must be polled (cron).
 * @type {ReadonlySet<string>}
 */
export const WEBHOOK_CAPABLE_PROVIDERS = Object.freeze(new Set([
  PROVIDERS.MAYSTRO,        // createWebhook()/listWebhooks()/deleteWebhook()
  PROVIDERS.ZREXPRESS_NEW,  // createWebhook()/listWebhooks()/updateWebhook()/deleteWebhook()
]));

/**
 * Whether a provider supports webhook registration through this package.
 * @param {string} provider
 * @returns {boolean}
 */
export function supportsWebhooks(provider) {
  return WEBHOOK_CAPABLE_PROVIDERS.has(provider);
}
