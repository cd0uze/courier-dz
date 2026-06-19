// ─── Provider enum ────────────────────────────────────────────────────────────
// Single source of truth: provider IDs, base URLs, engines, and metadata.

/**
 * All supported Algerian courier providers.
 * Providers using the same API engine are grouped in comments.
 */
export const PROVIDERS = Object.freeze({
  // ── Yalidine engine (2 providers) ─────────────────────────────────────────
  YALIDINE: 'yalidine',
  /** Yalitec uses the identical Yalidine API engine with a different subdomain */
  YALITEC: 'yalitec',

  // ── Maystro (standalone engine) ────────────────────────────────────────────
  MAYSTRO: 'maystro',

  // ── Procolis engine — legacy (2 providers) ─────────────────────────────────
  PROCOLIS: 'procolis',
  ZREXPRESS: 'zrexpress',

  // ── ZR Express NEW platform (standalone — api.zrexpress.app) ───────────────
  ZREXPRESS_NEW: 'zrexpress_new',

  // ── Zimou Express (standalone router engine) ───────────────────────────────
  ZIMOU: 'zimou',

  // ── Ecotrack engine — generic base + branded sub-providers ─────────────────
  ECOTRACK: 'ecotrack',
  ANDERSON: 'anderson',
  AREEX: 'areex',
  BA_CONSULT: 'ba_consult',
  CONEXLOG: 'conexlog',
  COYOTE_EXPRESS: 'coyote_express',
  DHD: 'dhd',
  DISTAZERO: 'distazero',
  E48HR: 'e48hr',
  FRETDIRECT: 'fretdirect',
  GOLIVRI: 'golivri',
  MSM_GO: 'msm_go',
  PACKERS: 'packers',
  PREST: 'prest',
  RB_LIVRAISON: 'rb_livraison',
  REX_LIVRAISON: 'rex_livraison',
  ROCKET_DELIVERY: 'rocket_delivery',
  SALVA_DELIVERY: 'salva_delivery',
  SPEED_DELIVERY: 'speed_delivery',
  TSL_EXPRESS: 'tsl_express',
  WORLDEXPRESS: 'worldexpress',
  // ── New providers ──────────────────────────────────────────────────────────
  SWIFT: 'swift',
  ALLOLIVRAISON: 'allolivraison',
});

// ─── Engine classification ────────────────────────────────────────────────────

const YALIDINE_ENGINE_SET = new Set([PROVIDERS.YALIDINE, PROVIDERS.YALITEC]);

const NON_ECOTRACK_SET = new Set([
  PROVIDERS.YALIDINE,
  PROVIDERS.YALITEC,
  PROVIDERS.MAYSTRO,
  PROVIDERS.PROCOLIS,
  PROVIDERS.ZREXPRESS,
  PROVIDERS.ZIMOU,
  PROVIDERS.ZREXPRESS_NEW,
]);

export function isYalidineEngine(provider) {
  return YALIDINE_ENGINE_SET.has(provider);
}

export function isEcotrackEngine(provider) {
  return !NON_ECOTRACK_SET.has(provider);
}

export function requiresApiId(provider) {
  return provider === PROVIDERS.PROCOLIS || provider === PROVIDERS.ZREXPRESS;
}

// ─── Base URLs ────────────────────────────────────────────────────────────────

export const PROVIDER_BASE_URLS = Object.freeze({
  [PROVIDERS.YALIDINE]: 'https://api.yalidine.app',
  [PROVIDERS.YALITEC]: 'https://api.yalitec.me',
  [PROVIDERS.MAYSTRO]: 'https://backend.maystro-delivery.com/api',
  [PROVIDERS.PROCOLIS]: 'https://procolis.com/api_v1',
  [PROVIDERS.ZREXPRESS]: 'https://procolis.com/api_v1',
  [PROVIDERS.ZIMOU]: 'https://zimou.express/api',
  [PROVIDERS.ZREXPRESS_NEW]: 'https://api.zrexpress.app',
  [PROVIDERS.ECOTRACK]: 'https://ecotrack.dz',
  [PROVIDERS.ANDERSON]: 'https://anderson-ecommerce.ecotrack.dz',       // updated API
  [PROVIDERS.AREEX]: 'https://areex.ecotrack.dz',
  [PROVIDERS.BA_CONSULT]: 'https://bacexpress.ecotrack.dz',
  [PROVIDERS.CONEXLOG]: 'https://app.conexlog-dz.com',
  [PROVIDERS.COYOTE_EXPRESS]: 'https://coyoteexpressdz.ecotrack.dz',
  [PROVIDERS.DHD]: 'https://dhd.ecotrack.dz',
  [PROVIDERS.DISTAZERO]: 'https://distazero.ecotrack.dz',
  [PROVIDERS.E48HR]: 'https://48hr.ecotrack.dz',
  [PROVIDERS.FRETDIRECT]: 'https://fret.ecotrack.dz',
  [PROVIDERS.GOLIVRI]: 'https://golivri.ecotrack.dz',
  [PROVIDERS.MSM_GO]: 'https://msmgo.ecotrack.dz',
  [PROVIDERS.PACKERS]: 'https://packers.ecotrack.dz',
  [PROVIDERS.PREST]: 'https://prest.ecotrack.dz',
  [PROVIDERS.RB_LIVRAISON]: 'https://rblivraison.ecotrack.dz',
  [PROVIDERS.REX_LIVRAISON]: 'https://rex.ecotrack.dz',
  [PROVIDERS.ROCKET_DELIVERY]: 'https://rocket.ecotrack.dz',
  [PROVIDERS.SALVA_DELIVERY]: 'https://salvadelivery.ecotrack.dz',
  [PROVIDERS.SPEED_DELIVERY]: 'https://speeddelivery.ecotrack.dz',
  [PROVIDERS.TSL_EXPRESS]: 'https://tsl.ecotrack.dz',
  [PROVIDERS.WORLDEXPRESS]: 'https://world-express.ecotrack.dz',        // updated API
  [PROVIDERS.SWIFT]: 'https://swift.ecotrack.dz',                       // new provider
  [PROVIDERS.ALLOLIVRAISON]: 'https://allolivraison.ecotrack.dz',       // new provider
});

export function getBaseUrl(provider) {
  const url = PROVIDER_BASE_URLS[provider];
  if (!url) throw new Error(`No base URL defined for provider "${provider}".`);
  return url;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const PROVIDER_METADATA = Object.freeze({
  [PROVIDERS.YALIDINE]: {
    name: 'Yalidine', title: 'Yalidine',
    website: 'https://yalidine.com/',
    description: 'Yalidine société de livraison en Algérie offre un service de livraison rapide et sécurisé.',
    logo: 'https://yalidine.com/assets/img/yalidine-logo.png',
    apiDocs: 'https://yalidine.app/app/dev/docs/api/index.php',
    support: 'https://yalidine.com/#contact',
    trackingUrl: 'https://yalidine.com/suivre-un-colis/',
  },
  [PROVIDERS.YALITEC]: {
    name: 'Yalitec', title: 'Yalitec',
    website: 'https://www.yalitec.com/fr',
    description: 'Yalitec société de livraison en Algérie offre un service de livraison rapide et sécurisé.',
    logo: 'https://www.yalitec.com/_next/image?url=%2Fimages%2Flogo.png&w=384&q=75',
    apiDocs: 'https://yalitec.me/app/dev/docs/api/index.php',
    support: 'https://www.yalitec.com/fr#contact',
    trackingUrl: null,
  },
  [PROVIDERS.MAYSTRO]: {
    name: 'MaystroDelivery', title: 'Maystro Delivery',
    website: 'https://maystro-delivery.com/',
    description: 'Maystro Delivery société de livraison en Algérie offre un service de livraison rapide et sécurisé.',
    logo: 'https://maystro-delivery.com/img/Maystro-blue-extonly.svg',
    apiDocs: 'https://maystro.gitbook.io/maystro-delivery-documentation',
    support: 'https://maystro-delivery.com/ContactUS.html',
    trackingUrl: 'https://maystro-delivery.com/trackingSD.html',
  },
  [PROVIDERS.PROCOLIS]: {
    name: 'Procolis', title: 'Procolis',
    website: 'https://procolis.com',
    description: 'Procolis est une plateforme de gestion de livraison en Algérie.',
    logo: null,
    apiDocs: 'https://procolis.com',
    support: 'https://procolis.com',
    trackingUrl: null,
  },
  [PROVIDERS.ZREXPRESS]: {
    name: 'ZRExpress', title: 'ZR Express',
    website: 'https://zrexpress.com',
    description: 'ZRexpress société de livraison en Algérie offre un service de livraison rapide et sécurisé.',
    logo: 'https://zrexpress.com/ZREXPRESS_WEB/ext/Logo.jpg',
    apiDocs: 'https://zrexpress.com/ZREXPRESS_WEB/FR/Developpement.awp',
    support: 'https://www.facebook.com/ZRexpresslivraison/',
    trackingUrl: null,
  },
  [PROVIDERS.ZREXPRESS_NEW]: {
    name: 'ZRExpressNew', title: 'ZR Express NEW',
    website: 'https://zrexpress.app',
    description: "La nouvelle plateforme ZR Express — API REST moderne remplaçant l'ancienne intégration Procolis.",
    logo: null,
    apiDocs: 'https://docs.zrexpress.app/reference/createparcelendpoint',
    support: 'mailto:support@zrexpress.net',
    trackingUrl: null,
  },
  [PROVIDERS.ZIMOU]: {
    name: 'ZimouExpress', title: 'Zimou Express',
    website: 'https://zimou.express',
    description: "Zimou Express est un routeur de livraison en Algérie qui dispatche automatiquement les colis vers le meilleur transporteur partenaire.",
    logo: null,
    apiDocs: 'https://zimou.express/api/docs',
    support: 'https://zimou.express',
    trackingUrl: 'https://zimou.express',
  },
  [PROVIDERS.ECOTRACK]: {
    name: 'Ecotrack', title: 'Ecotrack',
    website: 'https://ecotrack.dz',
    description: 'Ecotrack est une plateforme multi-transporteurs pour la livraison en Algérie.',
    logo: null,
    apiDocs: 'https://ecotrack.dz',
    support: 'https://ecotrack.dz',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.ANDERSON]: {
    name: 'AndersonDelivery', title: 'Anderson Delivery',
    website: 'https://anderson-ecommerce.ecotrack.dz/',
    description: "Anderson Delivery est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://cdn1.ecotrack.dz/anderson/images/login_logoctVbSeP.png',
    apiDocs: 'https://anderson-ecommerce.ecotrack.dz/',
    support: 'https://anderson-ecommerce.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.AREEX]: {
    name: 'Areex', title: 'Areex',
    website: 'https://areex.ecotrack.dz/',
    description: "Areex est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://areex.ecotrack.dz/',
    support: 'https://areex.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.BA_CONSULT]: {
    name: 'BaConsult', title: 'BA Consult',
    website: 'https://bacexpress.ecotrack.dz/',
    description: "BA Consult est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://cdn1.ecotrack.dz/bacexpress/images/login_logoeORMVno.png',
    apiDocs: 'https://bacexpress.ecotrack.dz/',
    support: 'https://bacexpress.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.CONEXLOG]: {
    name: 'Conexlog', title: 'Conexlog',
    website: 'https://conexlog-dz.com/',
    description: "CONEXLOG est le prestataire exclusif des services agréés en Algérie pour le groupe UPS.",
    logo: 'https://conexlog-dz.com/assets/img/logo.png',
    apiDocs: 'https://conexlog-dz.com/',
    support: 'https://conexlog-dz.com/contact.php',
    trackingUrl: 'https://conexlog-dz.com/suivi.php',
  },
  [PROVIDERS.COYOTE_EXPRESS]: {
    name: 'CoyoteExpress', title: 'Coyote Express',
    website: 'https://coyoteexpressdz.ecotrack.dz/',
    description: "Coyote Express est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://coyoteexpressdz.ecotrack.dz/',
    support: 'https://coyoteexpressdz.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.DHD]: {
    name: 'Dhd', title: 'DHD',
    website: 'https://dhd-dz.com/',
    description: "DHD livraison est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://dhd-dz.com/assets/img/logo.png',
    apiDocs: 'https://dhd-dz.com/',
    support: 'https://dhd-dz.com/#contact',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.DISTAZERO]: {
    name: 'Distazero', title: 'Distazero',
    website: 'https://distazero.ecotrack.dz/',
    description: "Distazero est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://cdn1.ecotrack.dz/distazero/images/login_logooI8OebS.png',
    apiDocs: 'https://distazero.ecotrack.dz/',
    support: 'https://distazero.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.E48HR]: {
    name: 'E48hrLivraison', title: '48Hr Livraison',
    website: 'https://48hr.ecotrack.dz/',
    description: "48Hr Livraison est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://48hr.ecotrack.dz/',
    support: 'https://48hr.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.FRETDIRECT]: {
    name: 'Fretdirect', title: 'FRET.Direct',
    website: 'https://fret.ecotrack.dz/',
    description: "FRET.Direct est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://fret.ecotrack.dz/',
    support: 'https://fret.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.GOLIVRI]: {
    name: 'Golivri', title: 'GOLIVRI',
    website: 'https://golivri.ecotrack.dz/',
    description: "GOLIVRI est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://cdn1.ecotrack.dz/golivri/images/login_logoP2208XU.png',
    apiDocs: 'https://golivri.ecotrack.dz/',
    support: 'https://golivri.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.MSM_GO]: {
    name: 'MsmGo', title: 'MSM Go',
    website: 'https://msmgo.ecotrack.dz',
    description: "MSM Go est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://msmgo.ecotrack.dz',
    support: 'https://msmgo.ecotrack.dz',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.PACKERS]: {
    name: 'Packers', title: 'Packers',
    website: 'https://packers.ecotrack.dz/',
    description: "Packers est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://packers.ecotrack.dz/',
    support: 'https://packers.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.PREST]: {
    name: 'Prest', title: 'Prest',
    website: 'https://prest.ecotrack.dz/',
    description: "Prest est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://prest.ecotrack.dz/',
    support: 'https://prest.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.RB_LIVRAISON]: {
    name: 'RbLivraison', title: 'RB Livraison',
    website: 'https://rblivraison.ecotrack.dz/',
    description: "RB Livraison est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://rblivraison.ecotrack.dz/',
    support: 'https://rblivraison.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.REX_LIVRAISON]: {
    name: 'RexLivraison', title: 'Rex Livraison',
    website: 'https://rex.ecotrack.dz/',
    description: "Rex Livraison est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://cdn1.ecotrack.dz/rex/images/login_logoCu3Rwdm.png',
    apiDocs: 'https://rex.ecotrack.dz/',
    support: 'https://rex.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.ROCKET_DELIVERY]: {
    name: 'RocketDelivery', title: 'Rocket Delivery',
    website: 'https://rocket.ecotrack.dz/',
    description: "Rocket Delivery est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://cdn1.ecotrack.dz/rocket/images/login_logogAux6nt.png',
    apiDocs: 'https://rocket.ecotrack.dz/',
    support: 'https://rocket.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.SALVA_DELIVERY]: {
    name: 'SalvaDelivery', title: 'Salva Delivery',
    website: 'https://salvadelivery.ecotrack.dz/',
    description: "Salva Delivery est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://cdn1.ecotrack.dz/salvadelivery/images/login_logo6GOyzNz.png',
    apiDocs: 'https://salvadelivery.ecotrack.dz/',
    support: 'https://salvadelivery.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.SPEED_DELIVERY]: {
    name: 'SpeedDelivery', title: 'Speed Delivery',
    website: 'https://speeddelivery.ecotrack.dz/',
    description: "Speed Delivery est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://speeddelivery.ecotrack.dz/',
    support: 'https://speeddelivery.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.TSL_EXPRESS]: {
    name: 'TslExpress', title: 'TSL Express',
    website: 'https://tsl.ecotrack.dz/',
    description: "TSL Express est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://cdn1.ecotrack.dz/tsl/images/login_logoxDIzsCJ.png',
    apiDocs: 'https://tsl.ecotrack.dz/',
    support: 'https://tsl.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.WORLDEXPRESS]: {
    name: 'Worldexpress', title: 'WorldExpress',
    website: 'https://world-express.ecotrack.dz/',
    description: "WorldExpress est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://world-express.ecotrack.dz/',
    support: 'https://world-express.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.SWIFT]: {
    name: 'Swift', title: 'Swift',
    website: 'https://swift.ecotrack.dz/',
    description: "Swift est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://swift.ecotrack.dz/',
    support: 'https://swift.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.ALLOLIVRAISON]: {
    name: 'AlloLivraison', title: 'AlloLivraison',
    website: 'https://allolivraison.ecotrack.dz/',
    description: "AlloLivraison est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: null,
    apiDocs: 'https://allolivraison.ecotrack.dz/',
    support: 'https://allolivraison.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
});

/**
 * Get metadata for a specific provider.
 * @param {string} provider - Provider ID (use PROVIDERS constant)
 * @returns {object} Provider metadata object
 */
export function getProviderMetadata(provider) {
  const meta = PROVIDER_METADATA[provider];
  if (!meta) throw new Error(`Unknown provider "${provider}".`);
  return meta;
}

/**
 * Get metadata for all providers.
 * @returns {Record<string, object>} All provider metadata, keyed by provider ID
 */
export function getAllProvidersMetadata() {
  return PROVIDER_METADATA;
}
