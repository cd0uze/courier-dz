# courier-dz

[![npm version](https://img.shields.io/npm/v/courier-dz.svg)](https://www.npmjs.com/package/courier-dz)
[![license](https://img.shields.io/npm/l/courier-dz.svg)](https://github.com/cd0uze/courier-dz/blob/main/LICENSE)

Unified API client for Algerian courier / delivery providers. One package, one interface for **94 providers** across **11 API engines**.

Pure ESM + CommonJS. Zero runtime dependencies except `axios`.

---

## Table of contents

- [Why courier-dz?](#why-courier-dz)
- [Supported providers](#supported-providers--94-total)
- [Method support matrix](#method-support-matrix)
- [Installation](#installation)
- [Configuration & credentials](#configuration--credentials)
- [Core concepts](#core-concepts)
  - [CourierManager](#couriermanager)
  - [Data objects](#data-objects)
  - [Tracking statuses](#tracking-statuses)
  - [Delivery & label types](#delivery--label-types)
- [Method reference](#method-reference)
  - [Common methods (every adapter)](#common-methods-every-adapter)
  - [Yalidine / Yalitec / Guepex](#yalidine--yalitec--guepex)
  - [Maystro Delivery](#maystro-delivery)
  - [Procolis / ZR Express (legacy)](#procolis--zr-express-legacy)
  - [ZR Express NEW](#zr-express-new)
  - [Zimou Express](#zimou-express)
  - [Noest Express](#noest-express)
  - [Ecotrack engine (74 providers)](#ecotrack-engine-74-providers)
  - [Elogistia](#elogistia)
  - [Near Delivery](#near-delivery)
  - [E-COM Delivery](#e-com-delivery)
  - [MDM Express](#mdm-express)
- [Webhooks](#webhooks)
- [Free shipping & fragile flags](#free-shipping--fragile-flags)
- [Rate limiting](#rate-limiting)
- [Error handling](#error-handling)
- [Express.js integration](#expressjs-integration-mern)
- [Disclaimer](#disclaimer)

---

## Why courier-dz?

Every Algerian courier exposes a different API shape, different field names, and different raw status strings (`"Livré"`, `"delivered"`, `"SORTIE EN LIVRAISON"`, `8`, …). Integrating more than one means writing the same glue code again and again.

**courier-dz** removes that with four principles:

1. **Unified data objects** — `CreateOrderData`, `OrderData`, `RateData`, `LabelData`. One input shape and one output shape, whatever the provider.
2. **Canonical status dictionary** — `TRACKING_STATUS` (12 values). Each adapter maps its raw statuses/IDs into it, so your code only ever sees `TRACKING_STATUS.DELIVERED`.
3. **Swappable adapters** — change the provider with a single string; application code stays identical.
4. **Safe by default** — a built-in per-provider [sliding-window rate limiter](#rate-limiting) enforces each provider's documented quota preventively, plus automatic retry on HTTP 429.

---

## Supported providers — 94 total

Providers are grouped by the **API engine** they share. Adapters are picked automatically by `CourierManager` from the provider ID.

### Standalone engines (13 providers)

| Provider             | ID              | Base URL                                | Auth |
|----------------------|-----------------|-----------------------------------------|------|
| Yalidine             | `yalidine`      | `api.yalidine.app`                      | `X-API-ID` + `X-API-TOKEN` |
| Yalitec              | `yalitec`       | `api.yalitec.me`                        | `X-API-ID` + `X-API-TOKEN` |
| Guepex               | `guepex`        | `api.guepex.app`                        | `X-API-ID` + `X-API-TOKEN` |
| Maystro Delivery     | `maystro`       | `backend.maystro-delivery.com/api`      | `Authorization: Token <token>` |
| Procolis             | `procolis`      | `procolis.com/api_v1`                   | `token` + `key` headers |
| ZR Express (legacy)  | `zrexpress`     | `procolis.com/api_v1`                   | `token` + `key` headers |
| ZR Express NEW       | `zrexpress_new` | `api.zrexpress.app`                     | `X-Tenant` + `X-Api-Key` |
| Zimou Express        | `zimou`         | `zimou.express/api`                     | `Authorization: Bearer <token>` |
| Noest Express        | `noest`         | `app.noest-dz.com`                      | `Authorization: Bearer <token>` + `user_guid` on writes |
| Elogistia            | `elogistia`     | `api.elogistia.com`                     | query param: `apiKey=` (parcel ops) / `key=` (catalogue reads) |
| Near Delivery        | `near_delivery` | `api.neardelivery.app/api/v1`           | `ApiKey` + `ApiSecret` headers |
| E-COM Delivery       | `ecom_delivery` | `ecom-dz.net`                           | `Token` + `Key` headers |
| MDM Express          | `mdm`           | `api.mdm.express`                       | `x-api-key` header |

### Yalidine engine — 6 providers

Same endpoints, only the subdomain differs. Auth: `X-API-ID` + `X-API-TOKEN`.

| Provider       | ID               | Base URL                 |
|----------------|------------------|--------------------------|
| Yalidine       | `yalidine`       | `api.yalidine.app`       |
| Yalitec        | `yalitec`        | `api.yalitec.me`         |
| Guepex         | `guepex`         | `api.guepex.app`         |
| Economiqua     | `economiqua`     | `api.economiqua.app`     |
| Easy and Speed | `easy_and_speed` | `api.easyandspeed.app`   |
| We Can Services| `wecan`          | `api.wecanservices.me`   |

### Procolis engine — 6 providers

All share `procolis.com/api_v1`, each account with its own `token` + `key`.

| Provider            | ID                |
|---------------------|-------------------|
| Procolis            | `procolis`        |
| ZR Express (legacy) | `zrexpress`       |
| ABEX Express        | `abex`            |
| Leopard Express     | `leopard_express` |
| Colilog Express     | `colilog`         |
| Flash Delivery      | `flash_delivery`  |

### Ecotrack engine — 74 providers sharing one API surface

All use `Authorization: Bearer <token>` (the token is also sent as an `api_token` query param).

| Provider          | ID                | Subdomain                          |
|-------------------|-------------------|------------------------------------|
| Ecotrack          | `ecotrack`        | `ecotrack.dz`                      |
| Anderson Delivery | `anderson`        | `anderson-ecommerce.ecotrack.dz`   |
| Areex             | `areex`           | `areex.ecotrack.dz`                |
| BA Consult        | `ba_consult`      | `bacexpress.ecotrack.dz`           |
| Conexlog (UPS)    | `conexlog`        | `app.conexlog-dz.com`              |
| Coyote Express    | `coyote_express`  | `coyoteexpressdz.ecotrack.dz`      |
| DHD               | `dhd`             | `dhd.ecotrack.dz`                  |
| Distazero         | `distazero`       | `distazero.ecotrack.dz`            |
| 48Hr Livraison    | `e48hr`           | `48hr.ecotrack.dz`                 |
| FRET.Direct       | `fretdirect`      | `fret.ecotrack.dz`                 |
| GOLIVRI           | `golivri`         | `golivri.ecotrack.dz`              |
| MSM Go            | `msm_go`          | `msmgo.ecotrack.dz`                |
| Packers           | `packers`         | `packers.ecotrack.dz`              |
| Prest             | `prest`           | `prest.ecotrack.dz`                |
| RB Livraison      | `rb_livraison`    | `rblivraison.ecotrack.dz`          |
| Rex Livraison     | `rex_livraison`   | `rex.ecotrack.dz`                  |
| Rocket Delivery   | `rocket_delivery` | `rocket.ecotrack.dz`               |
| Salva Delivery    | `salva_delivery`  | `salvadelivery.ecotrack.dz`        |
| Speed Delivery    | `speed_delivery`  | `speeddelivery.ecotrack.dz`        |
| TSL Express       | `tsl_express`     | `tsl.ecotrack.dz`                  |
| WorldExpress      | `worldexpress`    | `world-express.ecotrack.dz`        |
| Swift             | `swift`           | `swift.ecotrack.dz`                |
| AlloLivraison     | `allolivraison`   | `allolivraison.ecotrack.dz`        |

Plus **51 more Ecotrack clones** imported from the Vargo provider census, all served by the same `EcotrackAdapter` (only base URL + metadata differ):

`samex`, `sbl_express`, `weewee_delivery`, `jaguar_livraison`, `rj360_express`, `expedia_chrono`, `mars_express`, `lynx`, `eco_rapide_express`, `navex_delivery`, `rm_express`, `rihal_express`, `atlas_express`, `boogi`, `chronorex`, `cirta_express`, `colireli`, `colizone`, `gs_ecommerce`, `jo_express`, `om_express`, `on_time_express`, `pdex`, `quick_delivery`, `rs_express`, `ruta_express`, `tawsil_star`, `univer_delivery`, `vitrans`, `aranex`, `bfk_express`, `hdd_express`, `med_express`, `alania_express`, `champion_logistics`, `colex`, `delivro_mail`, `elguide_delivery`, `fast_horse_express`, `fz_delivery`, `imir_logistics`, `lihlih_express`, `mazaya_logistics`, `ovred`, `speed_mail`, `win_delivery`, `amana_speed`, `zinya_tec`, `sultan_colis_express`, `major_ex`, `red_ex`

Use the exported `PROVIDERS` constant instead of raw strings:

```js
import { PROVIDERS } from 'courier-dz';
PROVIDERS.YALIDINE;      // 'yalidine'
PROVIDERS.ZREXPRESS_NEW; // 'zrexpress_new'
PROVIDERS.DHD;           // 'dhd'
```

Engine helpers are exported too: `isYalidineEngine(id)`, `isEcotrackEngine(id)`, `isProcolisEngine(id)`, `requiresApiId(id)`, `getBaseUrl(id)`, `getProviderRateLimits(id)`.

Capability helpers tell you what a provider natively supports so your dashboard can adapt:

```js
import { supportsFreeShipping, supportsFragile, supportsBulkDelete, supportsBulkCreate, supportsWebhooks } from 'courier-dz';

supportsFreeShipping('yalidine');   // true  — native `freeshipping` flag
supportsFreeShipping('noest');      // false — deduct the fee from the COD amount yourself
supportsFragile('dhd');             // true  — Ecotrack native `fragile` flag
supportsFragile('noest');           // false — adapter prefixes the note with "FRAGILE" instead
supportsBulkDelete('ecom_delivery');// true
supportsWebhooks('maystro');        // true  — register push notifications, no polling needed
```

---

## Method support matrix

Legend: ✅ implemented · ❌ throws `UnsupportedOperationError` · ⚙️ provider-specific extra method.

| Method | Yalidine engine (6) | Maystro | Procolis engine (6) | ZR Express NEW | Zimou | Noest | Ecotrack (all 74) | Elogistia | Near Delivery | E-COM Delivery | MDM |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `testCredentials()` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `metadata()` / `provider()` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `getCreateOrderValidationRules()` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `createOrder(data)` | ✅ | ✅ ¹ | ✅ | ✅ ² | ✅ | ✅ | ✅ | ✅ | ✅ ⁸ | ✅ | ✅ ⁹ |
| `bulkCreateOrders(data[])` | ✅ | ✅ | ✅ | ✅ (≤100) | ❌ | ✅ (≤100) | ✅ (≤100) | ❌ | ✅ | ✅ | ✅ |
| `getOrder(tracking)` | ✅ | ✅ | ✅ | ✅ ³ | ✅ ⁴ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `getOrders(tracking[])` | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ⚙️ `searchOrders()` |
| `getRates(from, to)` | ✅ ⁵ | ❌ ⁶ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `getLabel(tracking)` | ✅ (HTML URL) | ✅ (PDF b64) | ❌ | ✅ (HTML URL) | ✅ (PDF URL) | ✅ (PDF b64) | ✅ (PDF b64) | ✅ (PDF b64) | ✅ (PDF b64) | ❌ | ⚙️ `generateLabels()` |
| `cancelOrder(tracking)` | ✅ ⁷ | ✅ (abort) | ❌ | ✅ | ✅ | ✅ ⁷ | ✅ ⁷ | ✅ | ✅ | ✅ | ❌ |
| `shipOrder(...)` | ❌ | ❌ | ✅ (`pret`) | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `updateOrder(...)` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| tracking history | — | ⚙️ `getTrackingHistory()` | — | — | — | — | — | ⚙️ `getTrackingHistory()` | ⚙️ `getTrackingHistory()` | ⚙️ `getTrackingHistory()` | ⚙️ `getTrackingHistory()` |
| webhooks | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `getWilayas()` | ✅ | ✅ | ❌ | ⚙️ `getTerritories()` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `getCommunes(wilayaId)` | ✅ | ✅ | ❌ | ⚙️ `getTerritories()` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| stop-desk directory | ⚙️ `getCenters()` | — | — | ⚙️ `getOffices()` | ⚙️ `getOffices()` | ⚙️ `getOffices()` | — | ⚙️ `getOffices()` | ⚙️ `getOffices()` (buralists) | — | — |
| other extras | `bulkDeleteOrders()` | ⚙️ `createProduct()`, `getDeliveryPrice()` | `bulkShipOrders()` | `bulkDeleteByIds()`, `bulkDeleteByTracking()`, `searchTerritory()` | — | `bulkShipOrders()` | — | — | ⚙️ `getCenters()` | `bulkDeleteOrders()`, `bulkShipOrders()` | ⚙️ `getStatusStatistics()` |

> ¹ Maystro requires a registered catalogue `product_id` — see [Maystro](#maystro-delivery).
> ² ZR Express NEW requires city + district territory UUIDs **and** a source hub id — see [ZR Express NEW](#zr-express-new).
> ³ ZR Express NEW `getOrder()` accepts either a UUID parcel id or a tracking number (e.g. `16-JUKYSI-ZR`).
> ⁴ Zimou `getOrder()` accepts either the integer package id or the `tracking_code` string.
> ⁵ Yalidine `getRates()` **requires** `fromWilayaId`.
> ⁶ Maystro has no per-wilaya rate grid; use `getDeliveryPrice(communeId)` instead.
> ⁷ Deletion is only accepted **before** the parcel is shipped/validated (`"en préparation"` state).
> ⁸ Near Delivery requires a destination **buralist id** (relay point) via `stopDeskId` — resolve it with `getOffices()`.
> ⁹ MDM identifies destinations by a provider-side `cityId` passed in `toCommune`.

---

## Installation

```bash
npm install courier-dz
```

```js
// ESM
import { CourierManager, PROVIDERS } from 'courier-dz';

// CommonJS
const { CourierManager, PROVIDERS } = require('courier-dz');
```

---

## Configuration & credentials

Each provider engine needs a different credential shape. Pass them once at construction under `providers`, keyed by provider ID:

```js
import { CourierManager } from 'courier-dz';

const courier = new CourierManager({
  providers: {
    // Yalidine engine — token = API ID (X-API-ID), key = API Token (X-API-TOKEN)
    yalidine: { token: 'YOUR_API_ID', key: 'YOUR_API_KEY' },
    yalitec:  { token: 'YOUR_API_ID', key: 'YOUR_API_KEY' },
    guepex:   { token: 'YOUR_API_ID', key: 'YOUR_API_KEY' },

    // Maystro — Django REST Framework token (sent as "Token <token>", NOT Bearer)
    maystro: { token: 'YOUR_MAYSTRO_TOKEN' },

    // Procolis / ZR Express legacy — token + key (legacy { id, token } also accepted)
    procolis:  { token: 'YOUR_TOKEN', key: 'YOUR_KEY' },
    zrexpress: { token: 'YOUR_TOKEN', key: 'YOUR_KEY' },

    // ZR Express NEW — tenant UUID + API key (X-Tenant + X-Api-Key)
    zrexpress_new: { tenant_id: 'YOUR_TENANT_UUID', api_key: 'YOUR_API_KEY' },

    // Zimou Express — Bearer token
    zimou: { token: 'YOUR_ZIMOU_TOKEN' },

    // Noest — Bearer token + account user GUID (guid is required on write calls)
    noest: { token: 'YOUR_NOEST_TOKEN', guid: 'YOUR_USER_GUID' },

    // Ecotrack sub-providers — one Bearer token per account
    ecotrack:      { token: 'YOUR_ECOTRACK_TOKEN' },
    dhd:           { token: 'YOUR_DHD_TOKEN' },
    anderson:      { token: 'YOUR_ANDERSON_TOKEN' },
    swift:         { token: 'YOUR_SWIFT_TOKEN' },
    // ... any of the 23 Ecotrack providers, same shape
  },
});
```

### Credential shapes

| Engine | Class | Fields | Accepted aliases |
|---|---|---|---|
| Yalidine / Yalitec / Guepex | `YalidineCredentials` | `token`, `key` | `key` ↔ `apiKey` |
| Maystro, Zimou, Ecotrack | `TokenCredentials` | `token` | — |
| Procolis / ZR legacy | `ProcolisCredentials` | `token`, `key` | legacy `{ id, token }` |
| ZR Express NEW | `ZrExpressNewCredentials` | `tenant_id`, `api_key` | `tenantId`, `apiKey` |
| Noest | `NoestCredentials` | `token`, `guid` | `api_token`, `user_guid` |

Missing/malformed credentials throw `InvalidCredentialsError` (with the offending `provider` attached) the first time you resolve that provider.

### Runtime credentials (no global config)

Pass credentials directly to `provider()` to override or skip global config. Instances are cached per credential set:

```js
const adapter = courier.provider('yalidine', {
  token: 'YOUR_API_ID',
  key:   'YOUR_API_KEY',
});
```

---

## Core concepts

### CourierManager

The single entry point. It resolves the right adapter for a provider ID, hydrates credentials, and caches adapter instances.

| Method | Description |
|---|---|
| `provider(id, credentials?)` | Resolve (and cache) the adapter for `id`. Optional runtime `credentials` override config. |
| `via(id, credentials?)` | Alias of `provider()`. |
| `metadataFor(id)` | Static provider metadata without instantiating an adapter. |
| `allMetadata()` | Metadata for all 32 providers, keyed by ID (great for building a picker). |
| `extend(id, factory)` | Register a custom adapter factory `(creds) => adapter` for `id` (testing / overrides). |
| `flushResolved()` | Clear the adapter instance cache (e.g. after rotating credentials at runtime). |

```js
const adapter = courier.provider(PROVIDERS.YALIDINE);
const meta    = courier.metadataFor(PROVIDERS.DHD);
courier.extend(PROVIDERS.DHD, (creds) => new MyCustomDhdAdapter(creds));
```

### Data objects

**`CreateOrderData`** — the unified order-creation input. Construct it directly or via `CreateOrderData.fromObject(body)`, which accepts both `camelCase` and `snake_case` keys (handy for raw HTTP bodies).

| Field | Type | Notes |
|---|---|---|
| `orderId` | string | Your internal reference. Must be unique per request for bulk/Yalidine. |
| `firstName`, `lastName` | string | Recipient name. |
| `phone` | string | Algerian format `0[5-7]XXXXXXXX`. |
| `phoneAlt` | string \| null | Secondary phone. |
| `address` | string | Full delivery address. |
| `toWilayaId` | number | Destination wilaya `1–58`. |
| `toCommune` | string | Commune name (**Maystro expects a numeric commune id** — see notes). |
| `productDescription` | string | Product label. |
| `price` | number | Cash-on-delivery amount in DZD (`0` = free / prepaid). |
| `deliveryType` | number | `DELIVERY_TYPE.HOME` (1) or `DELIVERY_TYPE.STOP_DESK` (2). |
| `freeShipping` | boolean | Waive the delivery fee. |
| `hasExchange` / `exchangeProduct` | boolean / string | Exchange parcel + product to collect. |
| `stopDeskId` | number \| null | Stop-desk / office id when `STOP_DESK`. |
| `fromWilayaId` | number \| null | Origin wilaya. |
| `notes` | string \| null | Free note — also the channel for provider-specific hints (see per-provider sections). |
| `weight` | number \| null | kg. Required for Noest bulk and some others. |
| `length` / `width` / `height` | number \| null | cm. |
| `quantity` | number \| null | Item count. |

**`OrderData`** — the unified response from `createOrder()` / `getOrder()`. Same shape for every provider:

`orderId`, `trackingNumber`, `provider`, `status` (canonical), `recipientName`, `phone`, `address`, `toWilayaId`, `toCommune`, `price`, `shippingFee`, `rawStatus` (untranslated provider status), `notes`, `createdAt`, `updatedAt`, `raw` (the full untouched API payload).

Helper methods: `.label()` / `.labelFr()` / `.labelAr()` (localized status), `.isDelivered()`, `.isTerminal()` (stop polling when true), `.toJSON()` (snake_case plain object).

**`RateData`** — a unified rate row: `provider`, `toWilayaId`, `toWilayaName`, `toWilayaNameAr`, `homeDeliveryPrice`, `stopDeskPrice`, `returnPrice`, `deliveryType`, `estimatedDaysMin/Max`, `hasCommunePricing`, `communes` (per-commune array when supported), `territoryId` / `territoryLevel` (ZR Express NEW opaque territory ids), `oversizeFee` (Yalidine per-kg surcharge above 5 kg).

**`LabelData`** — a unified label: `provider`, `trackingNumber`, `type` (`LABEL_TYPE`), and exactly one of `base64` or `url`. `.decodePdf()` returns a Node `Buffer` when `type === PDF_BASE64`.

### Tracking statuses

`order.status` is always one of these 12 canonical values, whatever the provider's raw wording:

```js
import { TRACKING_STATUS } from 'courier-dz';

TRACKING_STATUS.PENDING          // 'pending'          — Created, not yet collected
TRACKING_STATUS.PICKED_UP        // 'picked_up'        — Collected from the sender
TRACKING_STATUS.IN_TRANSIT       // 'in_transit'       — Moving between hubs/wilayas
TRACKING_STATUS.OUT_FOR_DELIVERY // 'out_for_delivery' — With the delivery agent
TRACKING_STATUS.DELIVERED        // 'delivered'        — Successfully delivered ✓ (terminal)
TRACKING_STATUS.FAILED_DELIVERY  // 'failed_delivery'  — Attempt failed / recipient absent / refused
TRACKING_STATUS.RETURNING        // 'returning'        — Heading back to the sender
TRACKING_STATUS.RETURNED         // 'returned'         — Back at the sender (terminal)
TRACKING_STATUS.CANCELLED        // 'cancelled'        — Cancelled before shipment (terminal)
TRACKING_STATUS.READY_FOR_PICKUP // 'ready_for_pickup' — Waiting at a stop desk / relay point
TRACKING_STATUS.EXCEPTION        // 'exception'        — Lost, damaged, blocked
TRACKING_STATUS.UNKNOWN          // 'unknown'          — Raw status not mapped
```

Each adapter ships its own raw→canonical mapping (`adapter.normalizeStatus(raw)`). Notably:

- **Yalidine / Procolis** map French labels (`"Livré"`, `"En cours de livraison"`, …).
- **Ecotrack** maps both activity slugs (`livred`, `dispatched_to_driver`) and order slugs (`en_livraison`, `retour_recu`), accent-insensitively.
- **Zimou** maps a numeric `status_id` (1–118) first, falling back to the status name — the ID map is the authoritative source.
- **ZR Express NEW / Noest** map slugs / `event_key` values.

Status helper functions (all exported):

```js
import {
  getStatusLabel, getStatusLabelFr, getStatusLabelAr, getStatusColor,
  isTerminalStatus, isSuccessfulStatus, isActiveStatus,
} from 'courier-dz';

getStatusLabel('delivered');     // "Delivered"
getStatusLabelFr('delivered');   // "Livré"
getStatusLabelAr('delivered');   // "تم التوصيل"
getStatusColor('delivered');     // "green"    — badge colour hint
isTerminalStatus('delivered');   // true       — delivered / returned / cancelled
isSuccessfulStatus('delivered'); // true       — delivered only
isActiveStatus('in_transit');    // true       — parcel is still moving
```

### Delivery & label types

```js
import { DELIVERY_TYPE, getDeliveryTypeLabelFr, LABEL_TYPE, getLabelTypeLabel } from 'courier-dz';

DELIVERY_TYPE.HOME      // 1 — Home delivery
DELIVERY_TYPE.STOP_DESK // 2 — Stop desk / relay point
getDeliveryTypeLabelFr(DELIVERY_TYPE.HOME); // "Livraison à domicile"

LABEL_TYPE.PDF_BASE64 // 'pdf_base64' — decode with label.decodePdf()
LABEL_TYPE.PDF_URL    // 'pdf_url'    — link to a PDF
LABEL_TYPE.IMAGE_URL  // 'image_url'  — link to an image
LABEL_TYPE.HTML_URL   // 'html_url'   — link to an HTML label (Yalidine, ZR Express NEW)
```

---

## Method reference

### Common methods (every adapter)

```js
const adapter = courier.provider(PROVIDERS.DHD);

await adapter.testCredentials(); // boolean — validates the key against a cheap endpoint
adapter.provider();              // 'dhd'
adapter.metadata();              // { name, title, website, description, logo, apiDocs, support, trackingUrl }
adapter.getCreateOrderValidationRules(); // provider-specific validation schema (field → rules)
adapter.normalizeStatus(rawStatusString); // canonical TRACKING_STATUS value
```

`getCreateOrderValidationRules()` returns a plain object describing each field's `required`, `type`, and constraints (`min`, `max`, `maxLength`, `pattern`, `enum`). Use it to validate a request body before calling `createOrder()`.

### Create an order (any provider)

```js
import { CourierManager, CreateOrderData, PROVIDERS, DELIVERY_TYPE } from 'courier-dz';

const courier = new CourierManager({ providers: { yalidine: { token: '...', key: '...' } } });

const orderData = new CreateOrderData({
  orderId:            'CMD-001',
  firstName:          'Mohamed',
  lastName:           'Benali',
  phone:              '0555123456',
  address:            '12 Rue Didouche Mourad',
  toWilayaId:         16,            // Alger
  toCommune:          'Hussein Dey',
  productDescription: 'Smart watch',
  price:              4500,          // COD in DZD
  deliveryType:       DELIVERY_TYPE.HOME,
  weight:             1,             // kg
});

const adapter = courier.provider(PROVIDERS.YALIDINE);
const order   = await adapter.createOrder(orderData);

console.log(order.trackingNumber); // provider tracking number
console.log(order.status);         // 'pending'
console.log(order.labelFr());      // 'En attente'
console.log(order.toJSON());
```

### Track a shipment

```js
const order = await courier.provider(PROVIDERS.MAYSTRO).getOrder('TRACKING-NUMBER');
console.log(order.status);        // e.g. 'delivered'
console.log(order.isDelivered()); // true
console.log(order.isTerminal());  // true → stop polling
```

---

### Yalidine / Yalitec / Guepex

Same engine for all three IDs. Auth: `X-API-ID` + `X-API-TOKEN`. The API identifies destinations by **wilaya name** (French) — the adapter converts `toWilayaId` (1–58) automatically via a built-in name table.

| Method | Description |
|---|---|
| `createOrder(data)` | `POST /v1/parcels`. Returns `OrderData`. Throws `CourierError` on rejection. |
| `bulkCreateOrders(data[])` | Native bulk create (no documented cap). Returns per-order `{ orderId, success, tracking, label, message, order }`. |
| `getOrder(tracking)` | `GET /v1/parcels/{tracking}`. Throws `OrderNotFoundError` if absent. |
| `getRates(fromWilayaId, toWilayaId?)` | **`fromWilayaId` required.** With `toWilayaId` → one `RateData` with per-commune prices; without → loops all 58 destinations. Includes `returnPrice` and `oversizeFee`. |
| `getLabel(tracking)` | Returns a `LABEL_TYPE.HTML_URL` (the parcel's `label` URL — there is no dedicated label endpoint). |
| `bulkDeleteOrders(tracking \| tracking[])` | `DELETE /v1/parcels/`. Only works while a parcel is `"en préparation"`. Returns `[{ tracking, deleted }]`. |
| `cancelOrder(tracking)` | Convenience wrapper over `bulkDeleteOrders` → `boolean`. |
| `getWilayas()` | All deliverable wilayas (auto-paginated). |
| `getCommunes(wilayaId?)` | Communes with `has_stop_desk` / `is_deliverable` flags. |
| `getCenters(wilayaId?)` | Stop-desk centers. A center's `center_id` is the `stopdesk_id` you pass at creation. |

```js
const y = courier.provider(PROVIDERS.YALIDINE);
const rates = await y.getRates(16);          // from Alger to all wilayas
const rates31 = await y.getRates(16, 31);    // from Alger to Oran (per-commune)
```

---

### Maystro Delivery

> Maystro webhook bodies are JSON **base64-encoded twice** (official docs).
> `parseWebhookPayload('maystro', body)` decodes strings and `data`/`payload`
> envelopes transparently. Cancel uses the official `PATCH shared/status/{id}/`
> (older `stores/orders/{id}/status/` kept as fallback); history uses
> `GET stores/history_order/{id}`.

Auth: `Authorization: Token <token>` (Django REST Framework — **not** Bearer). Two Maystro-specific rules matter:

- **`toCommune` must be a numeric Maystro commune id**, not a name. Resolve it via `getCommunes()` first.
- **`createOrder()` requires a catalogue `product_id`.** The product must already exist in your Maystro store. Pass hints through the `notes` field (pipe-separated, order-independent):
  - `"maystro_product:{id}"` — required catalogue product id (UUID or display id).
  - `"maystro_express:1"` — request express delivery.
  - anything else becomes the driver note.

```js
const m = courier.provider(PROVIDERS.MAYSTRO);

const communes = await m.getCommunes(16);                 // resolve name → id
const data = CreateOrderData.fromObject({
  order_id: 'CMD-002', first_name: 'Sara', last_name: 'K',
  phone: '0661000000', to_wilaya_id: 16, to_commune: 1621, // numeric id
  product_description: 'Perfume', price: 3000, delivery_type: 1,
  notes: 'maystro_express:1|maystro_product:PRD-123|Fragile',
});
const order = await m.createOrder(data);
```

| Method | Description |
|---|---|
| `createOrder(data)` | `POST /stores/orders/`. Requires `product_id` via notes. |
| `bulkCreateOrders(data[])` | Posts to Maystro's dedicated bulk import host. Returns Maystro's per-order results. |
| `getOrder(id)` | `GET /stores/orders/{id}/`. |
| `getLabel(tracking)` | `POST /delivery/starter/starter_bordureau/` → raw PDF → `LABEL_TYPE.PDF_BASE64`. |
| `getWilayas({country, language})` | `country` 1=Algeria / 2=Tunisia; `language` `ar\|en\|fr`. |
| `getCommunes(wilayaId?)` | Commune list (defensive field mapping — raw row preserved under `.raw`). |
| `getDeliveryPrice(communeId, {express, deliveryType})` | Per-commune fee in DZD, or `null` if none. **Maystro's replacement for `getRates()`**. |
| `createProduct(storeId, description, productId?)` | Create a catalogue product to reference in orders. |
| `cancelOrder(id)` | Abort the order: `PATCH stores/orders/{id}/status/` with `{status: 50}`. |
| `updateOrder(id, fields)` | `PATCH stores/orders/{id}/` with partial Maystro fields. |
| `getTrackingHistory(id)` | Status-change history of the order. |
| `createWebhook(url, triggerTypeId?)` | Register a push endpoint (`POST stores/hooks/costume/`). |
| `listWebhooks()` / `deleteWebhook(id)` / `listWebhookTypes()` / `sendTestWebhook()` | Manage webhook endpoints. |
| `getRates()` | ❌ Not supported → `UnsupportedOperationError`. |

Maystro reports order status as a **numeric code** — the adapter maps the full
table (4=Créé … 41=Livré, 50=Annulé, 52=Récupéré par le magasin) to canonical
statuses, and the French labels are exported as `MAYSTRO_STATUS_LABELS`.

---

### Procolis / ZR Express (legacy)

Both IDs share `procolis.com/api_v1`. Auth: `token` + `key` sent as HTTP headers on every request.

| Method | Description |
|---|---|
| `testCredentials()` | `GET token` → checks `Statut === 'Accès activé'`. |
| `getRates(from?, to?)` | `POST tarification` → per-wilaya home/stop-desk prices. Filtered by `toWilayaId` when given. |
| `createOrder(data)` | `POST add_colis`. Rejects duplicates (`"Double Tracking"`) and non-`"Good"` responses with `CourierError`. |
| `bulkCreateOrders(data[])` | One `POST add_colis` with several `Colis` entries; per-order results. |
| `getOrder(tracking)` / `getOrders(tracking[])` | `POST lire` (single or batched). Throws `OrderNotFoundError` if empty. |
| `shipOrder(tracking)` / `bulkShipOrders(tracking[])` | `POST pret` — flag parcels "Prêt à expédier" so Procolis dispatches them. |
| `getLabel()` / `cancelOrder()` | ❌ Not supported → `UnsupportedOperationError`. |

The status dictionary covers the full 28 documented Procolis statuses
(`En Preparation`, `Dispatcher`, `Au Bureau`, `SD - …`, `Retour Stock`, …) —
`normalizeStatus()` folds them all into the canonical vocabulary.

The same adapter serves the Procolis clones: **ABEX** (`abex`), **Leopard
Express** (`leopard_express`), **Colilog** (`colilog`) and **Flash Delivery**
(`flash_delivery`) — each with its own `token` + `key`.

> The legacy ZR Express API is deprecated by the provider in favour of the new platform — prefer `zrexpress_new` for new integrations.

---

### ZR Express NEW

> **State trap (fixed here):** without an explicit `stateId`, ZR creates the
> parcel in `OrderReceived`, which the hub never picks up. Since 1.1 the adapter
> resolves the `ReadyToDispatch` workflow state automatically (cached) and
> stamps it on every created parcel. Pass your own `stateId` in the payload to
> override.

A fully redesigned REST API (`api.zrexpress.app`, v1) that shares nothing with the legacy Procolis integration. Auth: **two headers** `X-Tenant` + `X-Api-Key`.

**Addresses are keyed by opaque territory UUIDs, never by wilaya code.** `createOrder()` therefore needs three UUIDs, supplied through the `notes` field (pipe-separated):

```
"zr_city:{cityUuid}|zr_district:{districtUuid}|zr_hub:{sourceHubUuid}|Optional note"
```

- `zr_district` (**required**) — the destination commune/district territory UUID.
- `zr_city` (**required**) — the destination wilaya/city territory UUID. *(If `toWilayaId` is itself already a UUID string it is used as the city id — there is no numeric wilaya→UUID lookup table.)*
- `zr_hub` (**required**) — your merchant **source** hub UUID. For a stop-desk order it falls back to `stopDeskId` (the chosen destination hub) if `zr_hub` is absent.

Resolve UUIDs with `getTerritories()`, `searchTerritory()` and `getOffices()`.

| Method | Description |
|---|---|
| `createOrder(data)` | Two-step: `POST /api/v1/parcels` returns `{ id }`, then the adapter fetches the full parcel via `getOrder(id)`. |
| `bulkCreateOrders(data[])` | `POST /api/v1/parcels/bulk`, chunked at **100**. Returns `{ totalRequested, successCount, failureCount, successes[], failures[] }` (indices re-based to the input array). |
| `getOrder(uuidOrTracking)` | Accepts a parcel UUID or a tracking number (e.g. `16-JUKYSI-ZR`). |
| `getRates(from?, to?)` | `GET /api/v1/delivery-pricing/rates`. Mixed **commune-level and wilaya-level** rows; each `RateData` carries `territoryId` + `territoryLevel` (`'commune'`/`'wilaya'`) and home/pickup/return prices. `toWilayaId` = the territory **code** (not `0`). |
| `getTerritories({level, parentId, pageSize})` | Paginated wilayas/communes with UUIDs, codes, Arabic names, `parentId`, and delivery-capability flags. |
| `getOffices({pickupOnly, pageSize})` | Hubs; each `id` is the `hubId` used on create. Includes city/district territory UUIDs, address, phones, coordinates. |
| `searchTerritory(name, level, parentId?)` | Look up a single territory UUID by name (`level` = `'wilaya'`/`'commune'`). |
| `cancelOrder(uuidOrTracking)` | `DELETE /api/v1/parcels/{id}` (resolves the UUID from a tracking number if needed). |
| `bulkDeleteByIds(uuid[])` / `bulkDeleteByTracking(tracking[])` | Native bulk delete, chunked at **200**. |
| `shipOrder(uuidOrTracking, newStateId, {comment, deliveryPersonId, arrivalHubId})` | `PATCH /api/v1/parcels/{id}/state` — move a parcel to a workflow state. |
| `getLabel(tracking)` | `LABEL_TYPE.HTML_URL` — an **Azure Blob SAS URL that expires quickly**. Do not cache; regenerate on demand. |

---

### Zimou Express

Zimou is a **delivery router**: it accepts a package and assigns it to the best partner carrier (Yalidine, Maystro, DHD, …), returning both its own `tracking_code` and the sub-carrier's code. Auth: `Authorization: Bearer <token>`.

Three delivery tiers: **Express** (default for `HOME`), **Flexible** (cheaper/slower), **Point relais** (`STOP_DESK`). Request Flexible via the `notes` field:

```js
notes: 'zimou_delivery_type:Flexible|Leave at the door if absent'
```

The adapter strips the prefix and sends the rest as the observation note.

| Method | Description |
|---|---|
| `createOrder(data)` | `POST /v3/packages`. Throws `CourierError` when the API returns `error: 1`. |
| `getOrder(idOrTracking)` | Integer id → `GET /v3/packages/{id}`; tracking code → `GET /v3/packages/status`. |
| `getOrders(tracking[])` | Bulk status lookup in one call — ideal for polling. Unknown trackings are omitted. |
| `getRates(from?, to?)` | `GET /v3/my/prices`, priced **per wilaya**. Zimou returns one row per partner carrier; the adapter picks the most common non-zero price (mode) per delivery type. Reconcile the real fee post-dispatch. |
| `getWilayas()` / `getCommunes(wilayaId?)` | Reference data from `/v3/helpers/*`. |
| `getOffices(communeId?)` | Stop-desk offices with `delivery_price`, `partner_company_name`, address. |
| `getLabel(idOrTracking)` | `LABEL_TYPE.PDF_URL` (the package `print_url`). |
| `cancelOrder(tracking)` | `DELETE /v3/packages/bulk`. |

On the returned `OrderData`, `order.notes` names the assigned partner (`"Via: Yalidine | Partner tracking: …"`), and `order.raw` exposes `tracking_partner_company` and `delivery_company_tracking_code`.

---

### Noest Express

> **Draft trap (fixed here):** on NOEST, a created order sits in a DRAFT state
> that logistics never sees until it is validated — no pickup, no error. Since
> 1.1, `createOrder()` / `bulkCreateOrders()` **validate automatically** so a
> returned tracking is pickup-ready. Set `adapter.autoValidate = false` to keep
> drafts (edit before shipping), then call `shipOrder(tracking)` yourself.

Auth: `Authorization: Bearer <token>` on every request; write/action calls **also** require the account `user_guid` in the JSON body (supplied automatically from your `guid` credential). Read endpoints work with the token alone. Noest prices **per wilaya** and infers status from the latest tracking `event_key`.

| Method | Description |
|---|---|
| `createOrder(data)` | `POST api/public/create/order`. Returns `OrderData` (status `PENDING`). |
| `bulkCreateOrders(data[])` | `POST api/public/create/orders`, chunked at **100**. Every item **requires `poids`** (weight) — defaults to `1` when unset. Returns `{ totalRequested, successCount, failureCount, passed[], failed[] }`. |
| `getOrder(tracking)` / `getOrders(tracking[])` | `POST api/public/get/trackings/info`. |
| `getRates(from?, to?)` | `GET api/public/fees` → per-wilaya `homeDeliveryPrice` (`tarif`), `stopDeskPrice` (`tarif_stopdesk`), and `returnPrice`. |
| `getLabel(tracking)` | Follows a 302 → pre-signed S3 PDF (expires ~300 s) → `LABEL_TYPE.PDF_BASE64`. |
| `shipOrder(tracking)` / `bulkShipOrders(tracking[])` | Validate parcels (`valid/order`, `valid/orders`). After validation a parcel can no longer be deleted. |
| `cancelOrder(tracking)` | `POST api/public/delete/order` — only before shipping. |
| `getWilayas()` | `[{ id, name, isActive }]`. |
| `getCommunes(wilayaId)` | **`wilayaId` required** → `[{ name, wilayaId, zipCode, isActive }]`. |
| `getOffices()` | Stop-desk directory; each `stationCode` is the `station_code` used on create. |

> `type_id`: 1 = livraison, 2 = échange, 3 = pickup. `stop_desk`: 0 = home, 1 = stop-desk (then `station_code` picks the desk).

---

### Ecotrack engine (74 providers)

One adapter serves the generic `ecotrack` provider and all 73 branded sub-providers (DHD, Conexlog, Anderson, Swift, AlloLivraison, Samex, Mars Express, …) — only the base URL and metadata differ. Auth: `Authorization: Bearer <token>` (also sent as an `api_token` query param).

`createOrder()` supports the native **fragile** flag: set `fragile: true` on `CreateOrderData` and the adapter sends `fragile=1`.

| Method | Description |
|---|---|
| `testCredentials()` | `GET api/v1/validate/token` → checks `success === true`. |
| `createOrder(data)` | `POST api/v1/create/order`. |
| `bulkCreateOrders(data[])` | `POST api/v1/create/orders`, chunked at **100**. Returns `{ totalRequested, successCount, failureCount, results[] }`. |
| `getOrder(tracking)` | `GET api/v1/get/orders?tracking=…`. |
| `getRates(from?, to?)` | `GET api/v1/get/fees` → per-wilaya home/stop-desk prices; filtered by `toWilayaId` when given. |
| `getLabel(tracking)` | `GET api/v1/get/order/label` → raw PDF → `LABEL_TYPE.PDF_BASE64`. |
| `cancelOrder(tracking)` | `DELETE api/v1/delete/order` — only before validation. |
| `shipOrder(tracking, {askCollection})` | `POST api/v1/valid/order` — validate/dispatch. After this the order can't be edited or deleted. |
| `getWilayas()` | `[{ id, name }]`. |
| `getCommunes(wilayaId?)` | `[{ name, wilayaId, zipCode, hasStopDesk }]`. |

```js
const dhd = courier.provider(PROVIDERS.DHD);
const rates = await dhd.getRates(null, 31);   // to Oran
const order = await dhd.createOrder(orderData);
await dhd.shipOrder(order.trackingNumber, { askCollection: true });
```

---

### Elogistia

Auth: API key in a `key` header. The API identifies destinations by **wilaya name** — the adapter resolves `toWilayaId` automatically via `getWilayas()` (or pass the name directly).

| Method | Description |
|---|---|
| `createOrder(data)` | `POST insertCommande`. Exchange orders use `modeDeLivraison: 4`. |
| `getOrder(tracking)` | `GET getOrders?tracking=…`. |
| `getTrackingHistory(tracking)` | `GET getTracking` — event history. |
| `cancelOrder(tracking)` | `GET deleteOrder`. |
| `getLabel(tracking, format?)` | `printBordereau_10x15` / `printBordereau_15x20` → PDF base64. |
| `getWilayas()` / `getCommunes()` / `getOffices()` | Reference data (`getWilayas`, `getMunicipalities`, `getAgences`). |
| `getRates()` | `GET getShippingCost`. |

Statuses are French (`Ramassée`, `En hub`, `Livrée & réglée`, `Retour remis`, …) and fully mapped to the canonical vocabulary.

---

### Near Delivery

Auth: `ApiKey` + `ApiSecret` headers (`near_delivery: { key, secret }` in config). Near Delivery routes parcels to **buralist relay points**: every order must carry a destination `buralist_id` — resolve it with `getOffices()` and pass it as `stopDeskId`.

| Method | Description |
|---|---|
| `createOrder(data)` / `bulkCreateOrders(data[])` | `POST parcels` (native bulk). |
| `getOrder(tracking)` | `GET track/{tracking}`. |
| `getTrackingHistory(tracking)` | `GET parcels/{tracking}/status-history/sender`. |
| `updateOrder(tracking, fields)` / `cancelOrder(tracking)` | `PATCH` / `DELETE parcels/{id}` (id resolved from the tracking). |
| `getLabel(tracking)` | `GET sender/parcels/{tracking}/bordereau` → PDF base64. |
| `getOffices()` | Buralists (relay points) — source of `buralist_id`. |
| `getCenters()` | Sender drop-off centers. |
| `getRates()` | `GET sender/delivery-fees`. |

Statuses are numeric (0=Pending … 7=Delivered, 10-15=Return flow, 14=Return confirmed) and fully mapped.

---

### E-COM Delivery

Auth: `Token` + `Key` headers (`ecom_delivery: { token, key }` in config). A Procolis-style French API on `ecom-dz.net` (`Api_v1/Colis`, PascalCase fields).

| Method | Description |
|---|---|
| `createOrder(data)` / `bulkCreateOrders(data[])` | `POST Api_v1/Colis` (native bulk). |
| `getOrder(tracking)` / `getOrders(tracking[])` | `GET Api_v1/Colis/Tracking/{t}` / `POST Api_v1/Colis/Liste`. |
| `getTrackingHistory(tracking)` | `GET Api_v1/Historique/Tracking/{t}`. |
| `shipOrder(tracking)` / `bulkShipOrders(tracking[])` | `PUT Api_v1/aExpédier` — validate/dispatch. |
| `updateOrder(tracking, data)` | `PUT Api_v1/Colis/{t}`. |
| `cancelOrder(tracking)` / `bulkDeleteOrders(tracking[])` | `PUT Api_v1/Supprimer` (native bulk delete). |

23 documented French statuses (`En Préparation`, `Au Bureau`, `Retour Fournisseur`, `Annuler x3`, …) fully mapped.

---

### MDM Express

Auth: `x-api-key` header (`mdm: { token, store_id? }` in config). MDM is an e-commerce + delivery platform (`api.mdm.express`, `/api/v2`). Destinations are identified by a provider-side **cityId** passed in `toCommune`.

MDM natively supports **both** `freeShipping` and `fragile` on order creation.

| Method | Description |
|---|---|
| `createOrder(data)` / `bulkCreateOrders(data[])` | `POST api/v2/orders` / `api/v2/orders/bulk`. |
| `getOrder(tracking)` | `GET api/v2/orders/{tracking}`. |
| `getTrackingHistory(tracking)` | `GET api/v2/orders/{tracking}/status-history`. |
| `searchOrders(filters)` | `POST api/v2/orders/search`. |
| `getStatusStatistics()` | `GET api/v2/orders/statistics/statuses`. |
| `generateLabels(tracking[])` → `getLabelFile(fileId)` | `POST api/prints/parcel-slips` then `GET api/prints/files/{fileId}`. |

Statuses: `pending`, `confirmed`, `shipped`, `delivered`, `cancelled`, `returned`, `expired`, `archived`.

---

## Webhooks

Two providers support **push notifications** — register a webhook once and stop polling their orders:

```js
// Maystro
const m = courier.provider(PROVIDERS.MAYSTRO);
await m.createWebhook('https://myapp.com/webhooks/maystro');
await m.listWebhooks();
await m.listWebhookTypes();     // trigger types (to filter events)
await m.sendTestWebhook();      // fire a test event
await m.deleteWebhook('webhook-id');

// ZR Express NEW
const zr = courier.provider(PROVIDERS.ZREXPRESS_NEW);
const endpoint = await zr.createWebhook('https://myapp.com/webhooks/zr', ['shipment.delivered', 'shipment.returned']);
await zr.getWebhookSecret(endpoint.id); // verify incoming payload signatures
await zr.listWebhooks();
await zr.updateWebhook(endpoint.id, { url: 'https://myapp.com/hooks/zr' });
await zr.deleteWebhook(endpoint.id);
```

Incoming payloads are normalized with `parseWebhookPayload()` — same shape whatever the provider:

```js
import { parseWebhookPayload, supportsWebhooks, isTerminalStatus } from 'courier-dz';

app.post('/webhooks/:provider', (req, res) => {
  const event = parseWebhookPayload(req.params.provider, req.body);
  // event = { provider, trackingNumber, orderId, rawStatus, status, occurredAt, raw }
  if (event.status === 'delivered') markOrderDelivered(event.trackingNumber);
  if (event.status === 'returned') restockOrder(event.trackingNumber);
  res.sendStatus(200);
});

// Poll (cron) only the providers that can't push:
if (!supportsWebhooks(order.provider)) pollStatus(order);
```

---

## Free shipping & fragile flags

`CreateOrderData` carries two logistics flags; each adapter forwards them natively when the provider supports it:

| Flag | Native support | Fallback |
|---|---|---|
| `freeShipping: true` | Yalidine engine (`freeshipping`), Zimou (`free_delivery`), MDM (`freeShipping`) | None — check `supportsFreeShipping(id)`; when `false`, don't add the delivery fee to the COD `price` yourself. |
| `fragile: true` | Ecotrack engine (`fragile=1`), MDM (`fragile`) | Noest, Procolis engine, Elogistia, E-COM Delivery: the adapter prefixes the driver note with `"FRAGILE"`. |

```js
const order = new CreateOrderData({
  // …
  freeShipping: true, // waive the delivery fee at the courier level (if supported)
  fragile: true,      // flag the parcel as fragile
});
```

---

### Fetch a shipping label (all providers)

`getLabel()` always returns a `LabelData` whose `type` tells you how to consume it:

```js
import { LABEL_TYPE } from 'courier-dz';
import fs from 'node:fs';

const label = await adapter.getLabel('TRACKING-NUMBER');

switch (label.type) {
  case LABEL_TYPE.PDF_BASE64:
    fs.writeFileSync('label.pdf', label.decodePdf()); // Node Buffer
    break;
  case LABEL_TYPE.PDF_URL:
  case LABEL_TYPE.IMAGE_URL:
    console.log('Open:', label.url);
    break;
  case LABEL_TYPE.HTML_URL:
    // Yalidine & ZR Express NEW — short-lived URL, do NOT cache
    console.log('HTML label:', label.url);
    break;
}
```

---

## Rate limiting

Every adapter enforces its provider's documented quota **preventively** with a sliding-window limiter, then retries on HTTP 429 as a safety net — so you rarely have to think about throttling.

- **Preventive**: requests are held until sending one more keeps every configured window under quota. Limits are set ~10–20 % **below** the documented ceiling to avoid boundary 429s (repeated boundary hits can get an account suspended).
- **Curative**: on a 429 the client waits and retries up to 3 times, honouring a numeric `Retry-After` header but always enforcing an exponential-backoff floor (2 s → 4 s → 8 s …, capped at 60 s).
- **Network errors** are retried with exponential backoff too.

Documented windows (via `getProviderRateLimits(id)`):

| Engine | Enforced limit |
|---|---|
| Yalidine engine (all 6) | 4/s + 45/min + 900/h + 9000/day |
| Ecotrack (all 74) | 45/min |
| Noest | 45/min |
| Maystro, Procolis engine, ZR Express NEW, Zimou, Elogistia, Near Delivery, E-COM Delivery, MDM | 45/min (conservative floor — no published limit) |

You normally don't touch this, but you can inspect a provider's limits:

```js
import { getProviderRateLimits, PROVIDERS } from 'courier-dz';
getProviderRateLimits(PROVIDERS.YALIDINE);
// [ {max:4,windowMs:1000}, {max:45,windowMs:60000}, {max:900,windowMs:3600000}, {max:9000,windowMs:86400000} ]
```

---

## Error handling

All errors extend `CourierError`:

| Class | Thrown when | Extra fields |
|---|---|---|
| `CourierError` | Any API/network failure (`statusCode` carries the HTTP status, `0` for network errors). | `statusCode`, `cause` |
| `AuthenticationError` | HTTP 401/403 — bad or expired credentials. | `statusCode` |
| `OrderNotFoundError` | An order/parcel doesn't exist at the provider (HTTP 404). | `trackingNumber` |
| `UnsupportedOperationError` | A method isn't supported by that provider. | `operation`, `provider` |
| `InvalidCredentialsError` | Credentials missing/malformed in config. | `provider` |

```js
import {
  CourierError, AuthenticationError, OrderNotFoundError,
  UnsupportedOperationError, InvalidCredentialsError,
} from 'courier-dz';

try {
  const order = await adapter.getOrder('INVALID-TRACKING');
} catch (err) {
  if (err instanceof OrderNotFoundError)          console.log('Not found:', err.trackingNumber);
  else if (err instanceof AuthenticationError)    console.log('Auth failed:', err.statusCode);
  else if (err instanceof UnsupportedOperationError) console.log('Unsupported:', err.operation, err.provider);
  else if (err instanceof CourierError)           console.log('Courier error:', err.message, err.statusCode);
}
```

---

## Express.js integration (MERN)

```js
// routes/shipping.js
import express from 'express';
import { CourierManager, CreateOrderData, CourierError } from 'courier-dz';

const router = express.Router();

const courier = new CourierManager({
  providers: {
    yalidine: { token: process.env.YALIDINE_TOKEN, key: process.env.YALIDINE_KEY },
    noest:    { token: process.env.NOEST_TOKEN, guid: process.env.NOEST_GUID },
    dhd:      { token: process.env.DHD_TOKEN },
  },
});

// POST /api/shipping/orders   { provider, ...orderFields }
router.post('/orders', async (req, res) => {
  try {
    const { provider, ...orderFields } = req.body;
    const orderData = CreateOrderData.fromObject(orderFields);
    const order = await courier.provider(provider).createOrder(orderData);
    res.json({ success: true, order: order.toJSON() });
  } catch (err) {
    if (err instanceof CourierError) res.status(err.statusCode || 400).json({ error: err.message });
    else res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shipping/track/:provider/:tracking
router.get('/track/:provider/:tracking', async (req, res) => {
  try {
    const order = await courier.provider(req.params.provider).getOrder(req.params.tracking);
    res.json(order.toJSON());
  } catch (err) {
    if (err instanceof CourierError) res.status(err.statusCode || 404).json({ error: err.message });
    else res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shipping/rates/:provider?from_wilaya=16&to_wilaya=31
router.get('/rates/:provider', async (req, res) => {
  try {
    const { from_wilaya, to_wilaya } = req.query;
    const rates = await courier.provider(req.params.provider).getRates(
      from_wilaya ? Number(from_wilaya) : null,
      to_wilaya   ? Number(to_wilaya)   : null,
    );
    res.json(rates.map((r) => r.toJSON()));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
```

---

## Disclaimer

- Not officially affiliated with or endorsed by any shipping provider.
- Verify that every provider is authorised by [ARPCE](https://www.arpce.dz/ar/service/post-sd#operators) before using it in production.

---

## License

MIT
