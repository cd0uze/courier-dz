/**
 * courier-dz — Unified API client for Algerian courier providers
 *
 * @module courier-dz
 */

// ── Main class ───────────────────────────────────────────────────────────────
export { CourierManager } from './CourierManager.js';

// ── Enums ────────────────────────────────────────────────────────────────────
export {
  PROVIDERS,
  PROVIDER_BASE_URLS,
  PROVIDER_METADATA,
  isYalidineEngine,
  isEcotrackEngine,
  requiresApiId,
  getBaseUrl,
  getProviderMetadata,
  getAllProvidersMetadata,
} from './enums/Provider.js';

export {
  TRACKING_STATUS,
  getStatusLabel,
  getStatusLabelFr,
  getStatusLabelAr,
  getStatusColor,
  isTerminalStatus,
  isSuccessfulStatus,
  isActiveStatus,
} from './enums/TrackingStatus.js';

export {
  DELIVERY_TYPE,
  getDeliveryTypeLabel,
  getDeliveryTypeLabelFr,
  getDeliveryTypeLabelAr,
} from './enums/DeliveryType.js';

export {
  LABEL_TYPE,
  getLabelTypeLabel,
} from './enums/LabelType.js';

// ── Data classes ─────────────────────────────────────────────────────────────
export { OrderData } from './data/OrderData.js';
export { CreateOrderData } from './data/CreateOrderData.js';
export { RateData } from './data/RateData.js';
export { LabelData } from './data/LabelData.js';
export { ProviderMetadata } from './data/ProviderMetadata.js';

// ── Credentials ───────────────────────────────────────────────────────────────
export { TokenCredentials } from './data/credentials/TokenCredentials.js';
export { YalidineCredentials } from './data/credentials/YalidineCredentials.js';
export { ProcolisCredentials } from './data/credentials/ProcolisCredentials.js';
export { ZrExpressNewCredentials } from './data/credentials/ZrExpressNewCredentials.js';

// ── Adapters (for advanced use / custom extensions) ───────────────────────────
export { AbstractAdapter } from './adapters/AbstractAdapter.js';
export { EcotrackAdapter } from './adapters/EcotrackAdapter.js';
export { YalidineAdapter } from './adapters/YalidineAdapter.js';
export { MaystroAdapter } from './adapters/MaystroAdapter.js';
export { ProcolisAdapter } from './adapters/ProcolisAdapter.js';
export { ZimouAdapter } from './adapters/ZimouAdapter.js';
export { ZrExpressNewAdapter } from './adapters/ZrExpressNewAdapter.js';

// ── Exceptions ────────────────────────────────────────────────────────────────
export { CourierError } from './exceptions/CourierError.js';
export { AuthenticationError } from './exceptions/AuthenticationError.js';
export { OrderNotFoundError } from './exceptions/OrderNotFoundError.js';
export { UnsupportedOperationError } from './exceptions/UnsupportedOperationError.js';
export { InvalidCredentialsError } from './exceptions/InvalidCredentialsError.js';
