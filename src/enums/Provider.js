// ─── Provider enum ────────────────────────────────────────────────────────────
// Single source of truth: provider IDs, base URLs, engines, and metadata.

/**
 * All supported Algerian courier providers.
 * Providers using the same API engine are grouped in comments.
 */
export const PROVIDERS = Object.freeze({
  // ── Yalidine engine (3 providers) ─────────────────────────────────────────
  YALIDINE: 'yalidine',
  /** Yalitec uses the identical Yalidine API engine with a different subdomain */
  YALITEC: 'yalitec',
  /** Guepex uses the same Yalidine API engine */
  GUEPEX: 'guepex',

  // ── Maystro (standalone engine) ────────────────────────────────────────────
  MAYSTRO: 'maystro',

  // ── Procolis engine — legacy (2 providers) ─────────────────────────────────
  PROCOLIS: 'procolis',
  ZREXPRESS: 'zrexpress',

  // ── ZR Express NEW platform (standalone — api.zrexpress.app) ───────────────
  ZREXPRESS_NEW: 'zrexpress_new',

  // ── Zimou Express (standalone router engine) ───────────────────────────────
  ZIMOU: 'zimou',

  // ── Noest (standalone — app.noest-dz.com) ──────────────────────────────────
  NOEST: 'noest',

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

  // ── Ecotrack clones (imported from the Vargo provider census) ──────────────
  SAMEX: 'samex',
  SBL_EXPRESS: 'sbl_express',
  WEEWEE_DELIVERY: 'weewee_delivery',
  JAGUAR_LIVRAISON: 'jaguar_livraison',
  RJ360_EXPRESS: 'rj360_express',
  EXPEDIA_CHRONO: 'expedia_chrono',
  MARS_EXPRESS: 'mars_express',
  LYNX: 'lynx',
  ECO_RAPIDE_EXPRESS: 'eco_rapide_express',
  NAVEX_DELIVERY: 'navex_delivery',
  RM_EXPRESS: 'rm_express',
  RIHAL_EXPRESS: 'rihal_express',
  ATLAS_EXPRESS: 'atlas_express',
  BOOGI: 'boogi',
  CHRONOREX: 'chronorex',
  CIRTA_EXPRESS: 'cirta_express',
  COLIRELI: 'colireli',
  COLIZONE: 'colizone',
  GS_ECOMMERCE: 'gs_ecommerce',
  JO_EXPRESS: 'jo_express',
  OM_EXPRESS: 'om_express',
  ON_TIME_EXPRESS: 'on_time_express',
  PDEX: 'pdex',
  QUICK_DELIVERY: 'quick_delivery',
  RS_EXPRESS: 'rs_express',
  RUTA_EXPRESS: 'ruta_express',
  TAWSIL_STAR: 'tawsil_star',
  UNIVER_DELIVERY: 'univer_delivery',
  VITRANS: 'vitrans',
  ARANEX: 'aranex',
  BFK_EXPRESS: 'bfk_express',
  HDD_EXPRESS: 'hdd_express',
  MED_EXPRESS: 'med_express',
  ALANIA_EXPRESS: 'alania_express',
  CHAMPION_LOGISTICS: 'champion_logistics',
  COLEX: 'colex',
  DELIVRO_MAIL: 'delivro_mail',
  ELGUIDE_DELIVERY: 'elguide_delivery',
  FAST_HORSE_EXPRESS: 'fast_horse_express',
  FZ_DELIVERY: 'fz_delivery',
  IMIR_LOGISTICS: 'imir_logistics',
  LIHLIH_EXPRESS: 'lihlih_express',
  MAZAYA_LOGISTICS: 'mazaya_logistics',
  OVRED: 'ovred',
  SPEED_MAIL: 'speed_mail',
  WIN_DELIVERY: 'win_delivery',
  AMANA_SPEED: 'amana_speed',
  ZINYA_TEC: 'zinya_tec',
  SULTAN_COLIS_EXPRESS: 'sultan_colis_express',
  MAJOR_EX: 'major_ex',
  RED_EX: 'red_ex',

  // ── Yalidine clones ─────────────────────────────────────────────────────────
  ECONOMIQUA: 'economiqua',
  EASY_AND_SPEED: 'easy_and_speed',
  WECAN: 'wecan',

  // ── Procolis clones (same procolis.com/api_v1 engine) ──────────────────────
  ABEX: 'abex',
  LEOPARD_EXPRESS: 'leopard_express',
  COLILOG: 'colilog',
  FLASH_DELIVERY: 'flash_delivery',

  // ── Standalone engines ──────────────────────────────────────────────────────
  ELOGISTIA: 'elogistia',
  NEAR_DELIVERY: 'near_delivery',
  ECOM_DELIVERY: 'ecom_delivery',
  MDM: 'mdm',
});

// ─── Engine classification ────────────────────────────────────────────────────

const YALIDINE_ENGINE_SET = new Set([
  PROVIDERS.YALIDINE,
  PROVIDERS.YALITEC,
  PROVIDERS.GUEPEX,
  PROVIDERS.ECONOMIQUA,
  PROVIDERS.EASY_AND_SPEED,
  PROVIDERS.WECAN,
]);

const ECOTRACK_ENGINE_SET = new Set([
  PROVIDERS.ECOTRACK,
  PROVIDERS.ANDERSON,
  PROVIDERS.AREEX,
  PROVIDERS.BA_CONSULT,
  PROVIDERS.CONEXLOG,
  PROVIDERS.COYOTE_EXPRESS,
  PROVIDERS.DHD,
  PROVIDERS.DISTAZERO,
  PROVIDERS.E48HR,
  PROVIDERS.FRETDIRECT,
  PROVIDERS.GOLIVRI,
  PROVIDERS.MSM_GO,
  PROVIDERS.PACKERS,
  PROVIDERS.PREST,
  PROVIDERS.RB_LIVRAISON,
  PROVIDERS.REX_LIVRAISON,
  PROVIDERS.ROCKET_DELIVERY,
  PROVIDERS.SALVA_DELIVERY,
  PROVIDERS.SPEED_DELIVERY,
  PROVIDERS.TSL_EXPRESS,
  PROVIDERS.WORLDEXPRESS,
  PROVIDERS.SWIFT,
  PROVIDERS.ALLOLIVRAISON,
  PROVIDERS.SAMEX,
  PROVIDERS.SBL_EXPRESS,
  PROVIDERS.WEEWEE_DELIVERY,
  PROVIDERS.JAGUAR_LIVRAISON,
  PROVIDERS.RJ360_EXPRESS,
  PROVIDERS.EXPEDIA_CHRONO,
  PROVIDERS.MARS_EXPRESS,
  PROVIDERS.LYNX,
  PROVIDERS.ECO_RAPIDE_EXPRESS,
  PROVIDERS.NAVEX_DELIVERY,
  PROVIDERS.RM_EXPRESS,
  PROVIDERS.RIHAL_EXPRESS,
  PROVIDERS.ATLAS_EXPRESS,
  PROVIDERS.BOOGI,
  PROVIDERS.CHRONOREX,
  PROVIDERS.CIRTA_EXPRESS,
  PROVIDERS.COLIRELI,
  PROVIDERS.COLIZONE,
  PROVIDERS.GS_ECOMMERCE,
  PROVIDERS.JO_EXPRESS,
  PROVIDERS.OM_EXPRESS,
  PROVIDERS.ON_TIME_EXPRESS,
  PROVIDERS.PDEX,
  PROVIDERS.QUICK_DELIVERY,
  PROVIDERS.RS_EXPRESS,
  PROVIDERS.RUTA_EXPRESS,
  PROVIDERS.TAWSIL_STAR,
  PROVIDERS.UNIVER_DELIVERY,
  PROVIDERS.VITRANS,
  PROVIDERS.ARANEX,
  PROVIDERS.BFK_EXPRESS,
  PROVIDERS.HDD_EXPRESS,
  PROVIDERS.MED_EXPRESS,
  PROVIDERS.ALANIA_EXPRESS,
  PROVIDERS.CHAMPION_LOGISTICS,
  PROVIDERS.COLEX,
  PROVIDERS.DELIVRO_MAIL,
  PROVIDERS.ELGUIDE_DELIVERY,
  PROVIDERS.FAST_HORSE_EXPRESS,
  PROVIDERS.FZ_DELIVERY,
  PROVIDERS.IMIR_LOGISTICS,
  PROVIDERS.LIHLIH_EXPRESS,
  PROVIDERS.MAZAYA_LOGISTICS,
  PROVIDERS.OVRED,
  PROVIDERS.SPEED_MAIL,
  PROVIDERS.WIN_DELIVERY,
  PROVIDERS.AMANA_SPEED,
  PROVIDERS.ZINYA_TEC,
  PROVIDERS.SULTAN_COLIS_EXPRESS,
  PROVIDERS.MAJOR_EX,
  PROVIDERS.RED_EX,
]);

export function isYalidineEngine(provider) {
  return YALIDINE_ENGINE_SET.has(provider);
}

export function isEcotrackEngine(provider) {
  return ECOTRACK_ENGINE_SET.has(provider);
}

const PROCOLIS_ENGINE_SET = new Set([
  PROVIDERS.PROCOLIS,
  PROVIDERS.ZREXPRESS,
  PROVIDERS.ABEX,
  PROVIDERS.LEOPARD_EXPRESS,
  PROVIDERS.COLILOG,
  PROVIDERS.FLASH_DELIVERY,
]);

export function requiresApiId(provider) {
  return PROCOLIS_ENGINE_SET.has(provider);
}

export function isProcolisEngine(provider) {
  return PROCOLIS_ENGINE_SET.has(provider);
}

// ─── Feature capabilities ─────────────────────────────────────────────────────

/**
 * Providers with a NATIVE free-shipping flag on order creation
 * (the delivery fee is waived at the courier level).
 * For any other provider the caller must adjust the COD amount itself
 * (e.g. don't add the delivery fee to `price`).
 * @param {string} provider
 * @returns {boolean}
 */
export function supportsFreeShipping(provider) {
  return isYalidineEngine(provider) // `freeshipping` boolean
    || provider === PROVIDERS.ZIMOU // `free_delivery`
    || provider === PROVIDERS.MDM;  // `freeShipping`
}

/**
 * Providers with a NATIVE fragile flag on order creation.
 * For the other engines with a note field (Noest, Procolis engine,
 * Elogistia, E-COM Delivery) the adapter automatically prefixes the note
 * with "FRAGILE" when CreateOrderData.fragile is true.
 * @param {string} provider
 * @returns {boolean}
 */
export function supportsFragile(provider) {
  return isEcotrackEngine(provider) // `fragile` 0/1
    || provider === PROVIDERS.MDM;  // `fragile`
}

/**
 * Providers exposing a native bulk-delete API.
 * @param {string} provider
 * @returns {boolean}
 */
export function supportsBulkDelete(provider) {
  return isYalidineEngine(provider)              // bulkDeleteOrders()
    || provider === PROVIDERS.ZREXPRESS_NEW      // bulkDeleteByIds()/bulkDeleteByTracking()
    || provider === PROVIDERS.ECOM_DELIVERY;     // bulkDeleteOrders()
}

/**
 * Providers exposing a native bulk-create API (one HTTP call, many parcels).
 * @param {string} provider
 * @returns {boolean}
 */
export function supportsBulkCreate(provider) {
  return isYalidineEngine(provider)
    || isEcotrackEngine(provider)
    || isProcolisEngine(provider)
    || provider === PROVIDERS.MAYSTRO
    || provider === PROVIDERS.NOEST
    || provider === PROVIDERS.ZREXPRESS_NEW
    || provider === PROVIDERS.NEAR_DELIVERY
    || provider === PROVIDERS.ECOM_DELIVERY
    || provider === PROVIDERS.MDM;
}

/**
 * Coerce an API flag that arrives as `0`/`1` (number OR string) or a real
 * boolean into a boolean. DO NOT use `Boolean(v)`: `Boolean("0") === true`
 * silently marks every commune as stop-desk capable, and a dispatch to a
 * non-desk commune is then rejected by the carrier (« cette commune n'a pas
 * de stop desk »).
 * @param {unknown} v
 * @returns {boolean}
 */
export function toBool01(v) {
  return v === true || v === 1 || v === '1' || v === 'true';
}

// ─── Base URLs ────────────────────────────────────────────────────────────────

export const PROVIDER_BASE_URLS = Object.freeze({
  [PROVIDERS.YALIDINE]: 'https://api.yalidine.app',
  [PROVIDERS.YALITEC]: 'https://api.yalitec.me',
  [PROVIDERS.GUEPEX]: 'https://api.guepex.app',
  [PROVIDERS.MAYSTRO]: 'https://backend.maystro-delivery.com/api',
  [PROVIDERS.PROCOLIS]: 'https://procolis.com/api_v1',
  [PROVIDERS.ZREXPRESS]: 'https://procolis.com/api_v1',
  [PROVIDERS.ZIMOU]: 'https://zimou.express/api',
  [PROVIDERS.NOEST]: 'https://app.noest-dz.com',
  [PROVIDERS.ZREXPRESS_NEW]: 'https://api.zrexpress.app',
  [PROVIDERS.ECOTRACK]: 'https://ecotrack.dz',
  [PROVIDERS.ANDERSON]: 'https://anderson-ecommerce.ecotrack.dz',       // updated API
  [PROVIDERS.AREEX]: 'https://areex.ecotrack.dz',
  [PROVIDERS.BA_CONSULT]: 'https://bacexpress.ecotrack.dz',
  [PROVIDERS.CONEXLOG]: 'https://app.conexlog-dz.com',
  [PROVIDERS.COYOTE_EXPRESS]: 'https://coyoteexpressdz.ecotrack.dz',
  [PROVIDERS.DHD]: 'https://platform.dhd-dz.com', // dhd.ecotrack.dz émet un 301 vers ce domaine (un POST 301 devient GET)
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

  // ── Ecotrack clones (base URLs from the Vargo provider census) ─────────────
  [PROVIDERS.SAMEX]: 'https://samex.ecotrack.dz',
  [PROVIDERS.SBL_EXPRESS]: 'https://sbl.ecotrack.dz',
  [PROVIDERS.WEEWEE_DELIVERY]: 'https://weeweedelivery.ecotrack.dz',
  [PROVIDERS.JAGUAR_LIVRAISON]: 'https://jaguar.ecotrack.dz',
  [PROVIDERS.RJ360_EXPRESS]: 'https://rj360express.ecotrack.dz',
  [PROVIDERS.EXPEDIA_CHRONO]: 'https://expediachrono.ecotrack.dz',
  [PROVIDERS.MARS_EXPRESS]: 'https://marsexpress.ecotrack.dz',
  [PROVIDERS.LYNX]: 'https://lynx.ecotrack.dz',
  [PROVIDERS.ECO_RAPIDE_EXPRESS]: 'https://ecorapide-express.ecotrack.dz',
  [PROVIDERS.NAVEX_DELIVERY]: 'https://navexdelivery.ecotrack.dz',
  [PROVIDERS.RM_EXPRESS]: 'https://rmexpress.ecotrack.dz',
  [PROVIDERS.RIHAL_EXPRESS]: 'https://rihalexpress.ecotrack.dz',
  [PROVIDERS.ATLAS_EXPRESS]: 'https://atlaexpress.ecotrack.dz',
  [PROVIDERS.BOOGI]: 'https://boogi.ecotrack.dz',
  [PROVIDERS.CHRONOREX]: 'https://chronorex.ecotrack.dz',
  [PROVIDERS.CIRTA_EXPRESS]: 'https://cirtaexpress.ecotrack.dz',
  [PROVIDERS.COLIRELI]: 'https://colireli.ecotrack.dz',
  [PROVIDERS.COLIZONE]: 'https://colizone.ecotrack.dz',
  [PROVIDERS.GS_ECOMMERCE]: 'https://gsecommerce.ecotrack.dz',
  [PROVIDERS.JO_EXPRESS]: 'https://joexpress.ecotrack.dz',
  [PROVIDERS.OM_EXPRESS]: 'https://omexpress.ecotrack.dz',
  [PROVIDERS.ON_TIME_EXPRESS]: 'https://ontime.ecotrack.dz',
  [PROVIDERS.PDEX]: 'https://pdex.ecotrack.dz',
  [PROVIDERS.QUICK_DELIVERY]: 'https://quickdelivery.ecotrack.dz',
  [PROVIDERS.RS_EXPRESS]: 'https://rsexpress.ecotrack.dz',
  [PROVIDERS.RUTA_EXPRESS]: 'https://rutaexpress.ecotrack.dz',
  [PROVIDERS.TAWSIL_STAR]: 'https://tawsil.ecotrack.dz',
  [PROVIDERS.UNIVER_DELIVERY]: 'https://univerdelivery.ecotrack.dz',
  [PROVIDERS.VITRANS]: 'https://vitrans.ecotrack.dz',
  [PROVIDERS.ARANEX]: 'https://aranex.ecotrack.dz',
  [PROVIDERS.BFK_EXPRESS]: 'https://bfkexpress.ecotrack.dz',
  [PROVIDERS.HDD_EXPRESS]: 'https://hhdexpress.ecotrack.dz',
  [PROVIDERS.MED_EXPRESS]: 'https://medexpress.ecotrack.dz',
  [PROVIDERS.ALANIA_EXPRESS]: 'https://alania.ecotrack.dz',
  [PROVIDERS.CHAMPION_LOGISTICS]: 'https://champion.ecotrack.dz',
  [PROVIDERS.COLEX]: 'https://colex.ecotrack.dz',
  [PROVIDERS.DELIVRO_MAIL]: 'https://delivromail.ecotrack.dz',
  [PROVIDERS.ELGUIDE_DELIVERY]: 'https://elguidedelivery.ecotrack.dz',
  [PROVIDERS.FAST_HORSE_EXPRESS]: 'https://fasthorse.ecotrack.dz',
  [PROVIDERS.FZ_DELIVERY]: 'https://fzdelivery.ecotrack.dz',
  [PROVIDERS.IMIR_LOGISTICS]: 'https://imir.ecotrack.dz',
  [PROVIDERS.LIHLIH_EXPRESS]: 'https://lihlihexpress.ecotrack.dz',
  [PROVIDERS.MAZAYA_LOGISTICS]: 'https://mazaya.ecotrack.dz',
  [PROVIDERS.OVRED]: 'https://ovred.ecotrack.dz',
  [PROVIDERS.SPEED_MAIL]: 'https://speedmail.ecotrack.dz',
  [PROVIDERS.WIN_DELIVERY]: 'https://windelivery.ecotrack.dz',
  [PROVIDERS.AMANA_SPEED]: 'https://amana.ecotrack.dz',
  [PROVIDERS.ZINYA_TEC]: 'https://zinyatec.ecotrack.dz',
  [PROVIDERS.SULTAN_COLIS_EXPRESS]: 'https://sultancolisexpress.ecotrack.dz',
  [PROVIDERS.MAJOR_EX]: 'https://majorex.ecotrack.dz',
  [PROVIDERS.RED_EX]: 'https://redex.ecotrack.dz',

  // ── Yalidine clones ─────────────────────────────────────────────────────────
  [PROVIDERS.ECONOMIQUA]: 'https://api.economiqua.app',
  [PROVIDERS.EASY_AND_SPEED]: 'https://api.easyandspeed.app',
  [PROVIDERS.WECAN]: 'https://api.wecanservices.me',

  // ── Procolis clones (same procolis.com/api_v1 engine) ──────────────────────
  [PROVIDERS.ABEX]: 'https://procolis.com/api_v1',
  [PROVIDERS.LEOPARD_EXPRESS]: 'https://procolis.com/api_v1',
  [PROVIDERS.COLILOG]: 'https://procolis.com/api_v1',
  [PROVIDERS.FLASH_DELIVERY]: 'https://procolis.com/api_v1',

  // ── Standalone engines ──────────────────────────────────────────────────────
  [PROVIDERS.ELOGISTIA]: 'https://api.elogistia.com',
  [PROVIDERS.NEAR_DELIVERY]: 'https://api.neardelivery.app/api/v1',
  [PROVIDERS.ECOM_DELIVERY]: 'https://ecom-dz.net',
  [PROVIDERS.MDM]: 'https://api.mdm.express',
});

export function getBaseUrl(provider) {
  const url = PROVIDER_BASE_URLS[provider];
  if (!url) throw new Error(`No base URL defined for provider "${provider}".`);
  return url;
}

// ─── Rate limits (per provider, as documented) ──────────────────────────────────
// Mission "règle d'or": only providers whose docs state a limit get a specific one;
// every other provider falls back to the 50 req/min floor.

/** Conservative 45 req/min floor for providers with no documented rate limit. */
const RATE_LIMIT_FLOOR = Object.freeze([{ max: 45, windowMs: 60_000 }]);

/**
 * Documented quota window(s) per provider engine. Verified live for Ecotrack,
 * Yalidine (HTTP quota headers) and Noest during the Phase 0 audit.
 *
 * @param {string} provider - Provider ID (use PROVIDERS constant)
 * @returns {Array<{max:number, windowMs:number}>}
 */
export function getProviderRateLimits(provider) {
  // NOTE: every value below sits DELIBERATELY BELOW the provider's documented
  // ceiling (≈10-20% headroom). Hitting a quota exactly at its boundary is what
  // triggers sporadic 429s (and, repeated, risks an account suspension), so the
  // preventive limiter aims under the line rather than at it.

  // Ecotrack engine (generic + every branded sub-provider): doc 50/min → use 45/min.
  if (isEcotrackEngine(provider)) {
    return [{ max: 45, windowMs: 60_000 }];
  }

  // Yalidine engine (Yalidine / Yalitec / Guepex): doc 5/s + 50/min + 1000/h +
  // 10000/day → use 4/s + 45/min + 900/h + 9000/day.
  if (isYalidineEngine(provider)) {
    return [
      { max: 4, windowMs: 1_000 },
      { max: 45, windowMs: 60_000 },
      { max: 900, windowMs: 3_600_000 },
      { max: 9_000, windowMs: 86_400_000 },
    ];
  }

  // Noest: doc 60/min → use 45/min (Noest 429s aggressively at the boundary).
  if (provider === PROVIDERS.NOEST) {
    return [{ max: 45, windowMs: 60_000 }];
  }

  // Maystro, Procolis/ZR-legacy, ZR Express NEW, Zimou: no documented limit →
  // conservative 45/min floor.
  return RATE_LIMIT_FLOOR;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

/**
 * Build metadata for an Ecotrack-engine clone from its base URL + title.
 * All clones share the Ecotrack tracking page and API surface.
 */
function ecotrackCloneMeta(providerId, name, title) {
  const website = `${PROVIDER_BASE_URLS[providerId]}/`;
  return {
    name, title,
    website,
    description: `${title} est une entreprise algérienne opérant dans le secteur de livraison express (plateforme Ecotrack).`,
    logo: null,
    apiDocs: website,
    support: website,
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  };
}

/** [providerId, machineName, displayTitle] for every Ecotrack clone added from the Vargo census. */
const ECOTRACK_CLONE_TITLES = [
  [PROVIDERS.SAMEX, 'Samex', 'Samex'],
  [PROVIDERS.SBL_EXPRESS, 'SblExpress', 'SBL Express'],
  [PROVIDERS.WEEWEE_DELIVERY, 'WeeWeeDelivery', 'Wee Wee Delivery'],
  [PROVIDERS.JAGUAR_LIVRAISON, 'JaguarLivraison', 'Jaguar Livraison'],
  [PROVIDERS.RJ360_EXPRESS, 'Rj360Express', 'RJ 360 Express'],
  [PROVIDERS.EXPEDIA_CHRONO, 'ExpediaChrono', 'Expedia Chrono'],
  [PROVIDERS.MARS_EXPRESS, 'MarsExpress', 'Mars Express'],
  [PROVIDERS.LYNX, 'Lynx', 'Lynx Express'],
  [PROVIDERS.ECO_RAPIDE_EXPRESS, 'EcoRapideExpress', 'Eco Rapide Express'],
  [PROVIDERS.NAVEX_DELIVERY, 'NavexDelivery', 'Navex Delivery'],
  [PROVIDERS.RM_EXPRESS, 'RmExpress', 'RM Express'],
  [PROVIDERS.RIHAL_EXPRESS, 'RihalExpress', 'Rihal Express'],
  [PROVIDERS.ATLAS_EXPRESS, 'AtlasExpress', 'Atlas Express'],
  [PROVIDERS.BOOGI, 'Boogi', 'Boogi Technologie'],
  [PROVIDERS.CHRONOREX, 'Chronorex', 'Chronorex Express'],
  [PROVIDERS.CIRTA_EXPRESS, 'CirtaExpress', 'Cirta Express'],
  [PROVIDERS.COLIRELI, 'Colireli', 'ColiReli'],
  [PROVIDERS.COLIZONE, 'Colizone', 'Colizone'],
  [PROVIDERS.GS_ECOMMERCE, 'GsEcommerce', 'GS Ecommerce'],
  [PROVIDERS.JO_EXPRESS, 'JoExpress', 'Jo Express'],
  [PROVIDERS.OM_EXPRESS, 'OmExpress', 'Om Courrier Express'],
  [PROVIDERS.ON_TIME_EXPRESS, 'OnTimeExpress', 'On Time Express'],
  [PROVIDERS.PDEX, 'Pdex', 'PDEX — Package Delivery Express'],
  [PROVIDERS.QUICK_DELIVERY, 'QuickDelivery', 'Quick Delivery DZ'],
  [PROVIDERS.RS_EXPRESS, 'RsExpress', 'RS Express'],
  [PROVIDERS.RUTA_EXPRESS, 'RutaExpress', 'Ruta Express'],
  [PROVIDERS.TAWSIL_STAR, 'TawsilStar', 'Tawsil Star'],
  [PROVIDERS.UNIVER_DELIVERY, 'UniverDelivery', 'Univer Delivery'],
  [PROVIDERS.VITRANS, 'Vitrans', 'Vitrans'],
  [PROVIDERS.ARANEX, 'Aranex', 'Aranex'],
  [PROVIDERS.BFK_EXPRESS, 'BfkExpress', 'BFK Express'],
  [PROVIDERS.HDD_EXPRESS, 'HddExpress', 'HDD Express'],
  [PROVIDERS.MED_EXPRESS, 'MedExpress', 'Med Express'],
  [PROVIDERS.ALANIA_EXPRESS, 'AlaniaExpress', 'Alania Express'],
  [PROVIDERS.CHAMPION_LOGISTICS, 'ChampionLogistics', 'Champion Logistics'],
  [PROVIDERS.COLEX, 'Colex', 'Colex'],
  [PROVIDERS.DELIVRO_MAIL, 'DelivroMail', 'Delivro Mail'],
  [PROVIDERS.ELGUIDE_DELIVERY, 'ElguideDelivery', 'El Guide Delivery'],
  [PROVIDERS.FAST_HORSE_EXPRESS, 'FastHorseExpress', 'Fast Horse Express'],
  [PROVIDERS.FZ_DELIVERY, 'FzDelivery', 'FZ Delivery'],
  [PROVIDERS.IMIR_LOGISTICS, 'ImirLogistics', 'Imir Logistics'],
  [PROVIDERS.LIHLIH_EXPRESS, 'LihLihExpress', 'LIH LIH Express'],
  [PROVIDERS.MAZAYA_LOGISTICS, 'MazayaLogistics', 'Mazaya Logistics'],
  [PROVIDERS.OVRED, 'Ovred', 'Ovred'],
  [PROVIDERS.SPEED_MAIL, 'SpeedMail', 'Speed Mail'],
  [PROVIDERS.WIN_DELIVERY, 'WinDelivery', 'Win Delivery'],
  [PROVIDERS.AMANA_SPEED, 'AmanaSpeed', 'AMANA Speed'],
  [PROVIDERS.ZINYA_TEC, 'ZinyaTec', 'Zinya Tec'],
  [PROVIDERS.SULTAN_COLIS_EXPRESS, 'SultanColisExpress', 'Sultan Colis Express'],
  [PROVIDERS.MAJOR_EX, 'MajorEx', 'Major Express'],
  [PROVIDERS.RED_EX, 'RedEx', 'Red Ex'],
];

const ECOTRACK_CLONE_METADATA = Object.fromEntries(
  ECOTRACK_CLONE_TITLES.map(([id, name, title]) => [id, ecotrackCloneMeta(id, name, title)]),
);

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
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQUVdDFlv8cMVCTt6HT2IjG3cx9VlOMl9vqyLgr2CuN2w&s=10',
    apiDocs: 'https://yalitec.me/app/dev/docs/api/index.php',
    support: 'https://www.yalitec.com/fr#contact',
    trackingUrl: null,
  },
  [PROVIDERS.GUEPEX]: {
    name: 'Guepex', title: 'Guepex',
    website: 'https://guepex.app/',
    description: 'Guepex société de livraison en Algérie offre un service de livraison rapide et sécurisé.',
    logo: 'https://guepex.app/app/assets/img/guepex-login-logo.jpg',
    apiDocs: null,
    support: 'https://guepex.app/',
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
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfzAmuO1QpSYv47VGFFlm6vMV7vaKXDLnF7HMkHOzAdEtWGuylruBy9aJR&s=10',
    apiDocs: 'https://zrexpress.com/ZREXPRESS_WEB/FR/Developpement.awp',
    support: 'https://www.facebook.com/ZRexpresslivraison/',
    trackingUrl: null,
  },
  [PROVIDERS.ZREXPRESS_NEW]: {
    name: 'ZRExpressNew', title: 'ZR Express NEW',
    website: 'https://zrexpress.app',
    description: "La nouvelle plateforme ZR Express — API REST moderne remplaçant l'ancienne intégration Procolis.",
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfzAmuO1QpSYv47VGFFlm6vMV7vaKXDLnF7HMkHOzAdEtWGuylruBy9aJR&s=10',
    apiDocs: 'https://docs.zrexpress.app/reference/createparcelendpoint',
    support: 'mailto:support@zrexpress.net',
    trackingUrl: null,
  },
  [PROVIDERS.ZIMOU]: {
    name: 'ZimouExpress', title: 'Zimou Express',
    website: 'https://zimou.express',
    description: "Zimou Express est un routeur de livraison en Algérie qui dispatche automatiquement les colis vers le meilleur transporteur partenaire.",
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpOwfuXyb_dZFp4lr_VqMjfXbX-cVEXQrkRt1ZVonMAg&s=10',
    apiDocs: 'https://zimou.express/api/docs',
    support: 'https://zimou.express',
    trackingUrl: 'https://zimou.express',
  },
  [PROVIDERS.NOEST]: {
    name: 'Noest', title: 'NOEST Express',
    website: 'https://noest-dz.com',
    description: "NOEST Express est une société de livraison en Algérie (plateforme app.noest-dz.com).",
    logo: 'https://app.noest-dz.com/css/customer/images/new_logo_.png',
    apiDocs: 'https://app.noest-dz.com',
    support: 'mailto:api@noest-dz.com',
    trackingUrl: 'https://app.noest-dz.com/tracking/',
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
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlGb1wvk2Nv04G7RqgiFxeS4CKOQrsDcGvFx0wGJ2INFjh2dgmc4Ome2cb&s=10',
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
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQLz8sW6_nx1tXsvIlXdX_ZrmCgSfgzTYIkhCOVPpz5nQ&s=10',
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
    logo: 'https://cdn1.ecotrack.dz/48hr/images/login_logoze5m7ZB.png',
    apiDocs: 'https://48hr.ecotrack.dz/',
    support: 'https://cdn1.ecotrack.dz/48hr/images/login_logoze5m7ZB.png',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.FRETDIRECT]: {
    name: 'Fretdirect', title: 'FRET.Direct',
    website: 'https://fret.ecotrack.dz/',
    description: "FRET.Direct est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://www.fret.direct/_next/image?url=%2Flogo-frets.png&w=3840&q=75',
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
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcThXa-sswLWrwctIFMZTlOwFaQ5JR-KdJ0mKDY1mZgRsw&s=10',
    apiDocs: 'https://msmgo.ecotrack.dz',
    support: 'https://msmgo.ecotrack.dz',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.PACKERS]: {
    name: 'Packers', title: 'Packers',
    website: 'https://packers.ecotrack.dz/',
    description: "Packers est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRqVGuzXsDuxESh78x5zZNjp3ZPA4UBdH8_ihKsoopbyqurwZC64zRaLE0&s=10',
    apiDocs: 'https://packers.ecotrack.dz/',
    support: 'https://packers.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.PREST]: {
    name: 'Prest', title: 'Prest',
    website: 'https://prest.ecotrack.dz/',
    description: "Prest est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQE_cVuWTNSzyjayZJCAJJOkK4hMKbkaWj-oOQrAlTlFhYEDT2I1EtynuE&s=10',
    apiDocs: 'https://prest.ecotrack.dz/',
    support: 'https://prest.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.RB_LIVRAISON]: {
    name: 'RbLivraison', title: 'RB Livraison',
    website: 'https://rblivraison.ecotrack.dz/',
    description: "RB Livraison est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRk9QW25N5E57JFqfbuxzS80dunTG-OE6y5TQ-V_aelUg&s=10',
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
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT_kxXgHikpmJ_Nl6S3E30Us_w6vfErJcKUjylcSIaCyXNWc6iblzTuHWo&s=10',
    apiDocs: 'https://world-express.ecotrack.dz/',
    support: 'https://world-express.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.SWIFT]: {
    name: 'Swift', title: 'Swift',
    website: 'https://swift.ecotrack.dz/',
    description: "Swift est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://cdn1.ecotrack.dz/swift/images/login_logoD6yf4pu.png',
    apiDocs: 'https://swift.ecotrack.dz/',
    support: 'https://swift.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },
  [PROVIDERS.ALLOLIVRAISON]: {
    name: 'AlloLivraison', title: 'AlloLivraison',
    website: 'https://allolivraison.ecotrack.dz/',
    description: "AlloLivraison est une entreprise algérienne opérant dans le secteur de livraison express.",
    logo: 'https://cdn1.ecotrack.dz/allolivraison/images/login_logom1lwSwV.png',
    apiDocs: 'https://allolivraison.ecotrack.dz/',
    support: 'https://allolivraison.ecotrack.dz/',
    trackingUrl: 'https://suivi.ecotrack.dz/suivi/',
  },

  // ── Ecotrack clones (generated) ─────────────────────────────────────────────
  ...ECOTRACK_CLONE_METADATA,

  // ── Yalidine clones ─────────────────────────────────────────────────────────
  [PROVIDERS.ECONOMIQUA]: {
    name: 'Economiqua', title: 'Economiqua',
    website: 'https://economiqua.app/',
    description: 'Economiqua société de livraison en Algérie (plateforme Yalidine).',
    logo: null,
    apiDocs: 'https://economiqua.app/app/dev/docs/api/index.php',
    support: 'https://economiqua.app/',
    trackingUrl: null,
  },
  [PROVIDERS.EASY_AND_SPEED]: {
    name: 'EasyAndSpeed', title: 'Easy and Speed',
    website: 'https://easyandspeed.app/',
    description: 'Easy and Speed société de livraison en Algérie (plateforme Yalidine).',
    logo: null,
    apiDocs: 'https://easyandspeed.app/app/dev/docs/api/index.php',
    support: 'https://easyandspeed.app/',
    trackingUrl: null,
  },
  [PROVIDERS.WECAN]: {
    name: 'WeCanServices', title: 'We Can Services',
    website: 'https://wecanservices.me/',
    description: 'We Can Services société de livraison en Algérie (plateforme Yalidine).',
    logo: null,
    apiDocs: 'https://wecanservices.me/',
    support: 'https://wecanservices.me/',
    trackingUrl: null,
  },

  // ── Procolis clones ─────────────────────────────────────────────────────────
  [PROVIDERS.ABEX]: {
    name: 'Abex', title: 'ABEX Express',
    website: 'https://procolis.com',
    description: 'ABEX Express, société de livraison en Algérie opérée via la plateforme Procolis.',
    logo: null,
    apiDocs: 'https://procolis.com',
    support: 'https://procolis.com',
    trackingUrl: null,
  },
  [PROVIDERS.LEOPARD_EXPRESS]: {
    name: 'LeopardExpress', title: 'Leopard Express',
    website: 'https://procolis.com',
    description: 'Leopard Express, société de livraison en Algérie opérée via la plateforme Procolis.',
    logo: null,
    apiDocs: 'https://procolis.com',
    support: 'https://procolis.com',
    trackingUrl: null,
  },
  [PROVIDERS.COLILOG]: {
    name: 'ColilogExpress', title: 'Colilog Express',
    website: 'https://procolis.com',
    description: 'Colilog Express, société de livraison en Algérie opérée via la plateforme Procolis.',
    logo: null,
    apiDocs: 'https://procolis.com',
    support: 'https://procolis.com',
    trackingUrl: null,
  },
  [PROVIDERS.FLASH_DELIVERY]: {
    name: 'FlashDelivery', title: 'Flash Delivery',
    website: 'https://procolis.com',
    description: 'Flash Delivery, société de livraison en Algérie opérée via la plateforme Procolis.',
    logo: null,
    apiDocs: 'https://procolis.com',
    support: 'https://procolis.com',
    trackingUrl: null,
  },

  // ── Standalone engines ──────────────────────────────────────────────────────
  [PROVIDERS.ELOGISTIA]: {
    name: 'Elogistia', title: 'Elogistia',
    website: 'https://elogistia.com/',
    description: 'Elogistia est une société de livraison en Algérie avec sa propre API (api.elogistia.com).',
    logo: null,
    apiDocs: 'https://api.elogistia.com',
    support: 'https://elogistia.com/',
    trackingUrl: null,
  },
  [PROVIDERS.NEAR_DELIVERY]: {
    name: 'NearDelivery', title: 'Near Delivery',
    website: 'https://neardelivery.app/',
    description: 'Near Delivery est une société de livraison en Algérie basée sur un réseau de buralistes (points relais).',
    logo: null,
    apiDocs: 'https://api.neardelivery.app',
    support: 'https://neardelivery.app/',
    trackingUrl: null,
  },
  [PROVIDERS.ECOM_DELIVERY]: {
    name: 'EcomDelivery', title: 'E-COM Delivery',
    website: 'https://ecom-dz.net/',
    description: 'E-COM Delivery est une société de livraison en Algérie (API Api_v1 style Procolis sur ecom-dz.net).',
    logo: null,
    apiDocs: 'https://ecom-dz.net/',
    support: 'https://ecom-dz.net/',
    trackingUrl: null,
  },
  [PROVIDERS.MDM]: {
    name: 'MdmExpress', title: 'MDM Express',
    website: 'https://mdm.express/',
    description: 'MDM Express est une plateforme e-commerce et de livraison en Algérie (api.mdm.express).',
    logo: null,
    apiDocs: 'https://api.mdm.express',
    support: 'https://mdm.express/',
    trackingUrl: null,
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
