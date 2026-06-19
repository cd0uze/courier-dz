# courier-dz

[![npm version](https://img.shields.io/npm/v/courier-dz.svg)](https://www.npmjs.com/package/courier-dz)
[![license](https://img.shields.io/npm/l/courier-dz.svg)](https://github.com/cd0uze/courier-dz/blob/main/LICENSE)

Unified API client for Algerian shipping providers. One package, one interface for **30 providers**.

Supports both ESM and CommonJS.

---

## Why courier-dz?

Every Algerian courier has a different API shape, different field names, and different tracking status strings (`"Livré"`, `"delivered"`, `"SORTIE EN LIVRAISON"` …). Integrating more than one means writing glue code over and over.

**courier-dz** solves this with three principles:

1. **Unified data objects** — `CreateOrderData`, `OrderData`, `RateData`, `LabelData`. One shape, every provider.
2. **Canonical status dictionary** — `TRACKING_STATUS` with 12 values. Each adapter normalises its raw strings or IDs into this dictionary. Your code only ever sees `TRACKING_STATUS.DELIVERED`.
3. **Swappable adapters** — swap providers with a single string change. Zero application-code changes.

---

## Supported Providers — 30 total

### Standalone engines

| Provider             | ID              | Base URL                       |
|----------------------|-----------------|--------------------------------|
| Yalidine             | `yalidine`      | `api.yalidine.app`             |
| Yalitec              | `yalitec`       | `api.yalitec.me`               |
| Maystro Delivery     | `maystro`       | `backend.maystro-delivery.com` |
| Procolis             | `procolis`      | `procolis.com/api_v1`          |
| ZR Express (legacy)  | `zrexpress`     | `procolis.com/api_v1`          |
| ZR Express NEW       | `zrexpress_new` | `api.zrexpress.app`            |
| Zimou Express        | `zimou`         | `zimou.express/api`            |

### Ecotrack engine — 23 providers sharing one API surface

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

---

## Supported Methods

| Method                          | Yalidine / Yalitec | Maystro | Procolis / ZR Express | ZR Express NEW | Zimou Express | Ecotrack (all 23) |
|---------------------------------|:------------------:|:-------:|:---------------------:|:--------------:|:-------------:|:-----------------:|
| `testCredentials()`             | ✅                 | ✅      | ✅                    | ✅             | ✅            | ✅                |
| `metadata()`                    | ✅                 | ✅      | ✅                    | ✅             | ✅            | ✅                |
| `getRates()`                    | ✅ *               | ❌      | ✅                    | ✅ ‡           | ❌            | ✅                |
| `getCreateOrderValidationRules()` | ✅               | ✅      | ✅                    | ✅             | ✅            | ✅                |
| `createOrder()`                 | ✅                 | ✅      | ✅                    | ✅             | ✅            | ✅                |
| `getOrder()`                    | ✅                 | ✅      | ✅                    | ✅ **          | ✅ ***        | ✅                |
| `cancelOrder()`                 | ➖                 | ➖      | ➖                    | ✅             | ✅            | ➖                |
| `getLabel()`                    | ✅                 | ✅      | ❌                    | ✅             | ✅            | ✅                |
| `createProduct()` +             | ❌                 | ✅      | ❌                    | ❌             | ❌            | ❌                |

> \* Yalidine `getRates()` requires `fromWilayaId`.  
> \*\* ZR Express NEW `getOrder()` accepts either a UUID parcel ID or a tracking number (e.g. `16-JUKYSI-ZR`).  
> \*\*\* Zimou `getOrder()` accepts either the integer package ID or the `tracking_code` string.  
> \+ Maystro-only method — call `adapter.createProduct()` directly.  
> ‡ ZR Express NEW `getRates()` returns commune-level prices; `toWilayaId` is `0` for all entries.  
> ➖ = planned / unknown support.

---

## Installation

```bash
npm install courier-dz
```

---

## Configuration

```js
import { CourierManager } from 'courier-dz';

const courier = new CourierManager({
  providers: {
    // Yalidine / Yalitec — token = API ID, key = API Token
    yalidine: { token: 'YOUR_API_ID', key: 'YOUR_API_KEY' },
    yalitec:  { token: 'YOUR_API_ID', key: 'YOUR_API_KEY' },

    // Maystro — Django REST Framework token (not Bearer)
    maystro: { token: 'YOUR_MAYSTRO_TOKEN' },

    // Procolis / ZR Express legacy — id + token
    procolis:  { id: 'YOUR_ID', token: 'YOUR_TOKEN' },
    zrexpress: { id: 'YOUR_ID', token: 'YOUR_TOKEN' },

    // ZR Express NEW — tenant UUID + API key
    zrexpress_new: { tenant_id: 'YOUR_TENANT_UUID', api_key: 'YOUR_API_KEY' },

    // Zimou Express — Bearer token
    zimou: { token: 'YOUR_ZIMOU_TOKEN' },

    // Ecotrack sub-providers — one Bearer token per account
    dhd:           { token: 'YOUR_DHD_TOKEN' },
    anderson:      { token: 'YOUR_ANDERSON_TOKEN' },
    worldexpress:  { token: 'YOUR_WORLDEXPRESS_TOKEN' },
    swift:         { token: 'YOUR_SWIFT_TOKEN' },
    allolivraison: { token: 'YOUR_ALLOLIVRAISON_TOKEN' },
    // ... see full list in the providers table above
  },
});
```

### Runtime credentials (without global config)

```js
const adapter = courier.provider('yalidine', {
  token: 'YOUR_API_ID',
  key: 'YOUR_API_KEY',
});
```

---

## Usage

### Create an order

```js
import { CourierManager, CreateOrderData, PROVIDERS, DELIVERY_TYPE } from 'courier-dz';

const courier = new CourierManager({ providers: { yalidine: { token: '...', key: '...' } } });

const orderData = new CreateOrderData({
  orderId:            'CMD-001',
  firstName:          'Mohamed',
  lastName:           'Benali',
  phone:              '0555123456',
  address:            '12 Rue Didouche Mourad',
  toWilayaId:         16,           // Algiers
  toCommune:          'Hussein Dey',
  productDescription: 'Smart watch',
  price:              4500,         // COD amount in DZD
  deliveryType:       DELIVERY_TYPE.HOME,
  weight:             1,            // in kg — required for some providers
});

// From a raw object (e.g. Express request body)
const orderData2 = CreateOrderData.fromObject(req.body);

const adapter = courier.provider(PROVIDERS.YALIDINE);
const order = await adapter.createOrder(orderData);

console.log(order.trackingNumber); // "YLD-XXXXXXX"
console.log(order.status);         // "pending"
console.log(order.label());        // "Pending"
console.log(order.labelFr());      // "En attente"
console.log(order.labelAr());      // "قيد الانتظار"
console.log(order.toJSON());       // Serialisable plain object
```

### Track a shipment

```js
const adapter = courier.provider(PROVIDERS.MAYSTRO);
const order = await adapter.getOrder('TRACKING-NUMBER');

console.log(order.status);         // "delivered"
console.log(order.isDelivered());  // true
console.log(order.isTerminal());   // true — stop polling
```

### Get shipping rates

```js
const adapter = courier.provider(PROVIDERS.YALIDINE);

// Yalidine requires fromWilayaId
const rates = await adapter.getRates(16); // From Algiers

rates.forEach(rate => {
  console.log(`${rate.toWilayaName}: home=${rate.homeDeliveryPrice} DZD, stop-desk=${rate.stopDeskPrice} DZD`);
});

// Ecotrack — both params optional
const dhdAdapter = courier.provider(PROVIDERS.DHD);
const dhdRates = await dhdAdapter.getRates(null, 31); // To Oran
```

### Fetch a shipping label

```js
import { LABEL_TYPE } from 'courier-dz';

const adapter = courier.provider(PROVIDERS.ECOTRACK);
const label = await adapter.getLabel('TRACKING-NUMBER');

if (label.type === LABEL_TYPE.PDF_URL) {
  // Redirect or open directly
  console.log('PDF URL:', label.url);
} else if (label.type === LABEL_TYPE.PDF_BASE64) {
  // Decode and write to disk
  const pdfBuffer = label.decodePdf(); // Node.js Buffer
  fs.writeFileSync('label.pdf', pdfBuffer);
} else if (label.type === LABEL_TYPE.HTML_URL) {
  // ZR Express NEW — Azure SAS URL, expires quickly — do not cache
  console.log('HTML URL:', label.url);
}
```

### Cancel an order

```js
// Supported by Zimou Express and ZR Express NEW only
const zimouAdapter = courier.provider(PROVIDERS.ZIMOU);
const cancelled = await zimouAdapter.cancelOrder('ZM-TRACKING');
console.log(cancelled); // true
```

### Test credentials

```js
const adapter = courier.provider(PROVIDERS.DHD);
const isValid = await adapter.testCredentials();
console.log(isValid); // true / false
```

---

## Provider Metadata

### Single provider

```js
import { getProviderMetadata, PROVIDERS } from 'courier-dz';

const meta = getProviderMetadata(PROVIDERS.YALIDINE);
console.log(meta.title);       // "Yalidine"
console.log(meta.website);     // "https://yalidine.com"
console.log(meta.logo);        // "https://yalidine.com/assets/img/..."
console.log(meta.trackingUrl); // "https://yalidine.com/suivre-un-colis/"
console.log(meta.apiDocs);     // API documentation URL
```

### All providers (for a selection UI)

```js
import { getAllProvidersMetadata } from 'courier-dz';

const allMeta = getAllProvidersMetadata();

// In React:
Object.entries(allMeta).map(([id, meta]) => (
  <option key={id} value={id}>{meta.title}</option>
));
```

### Via CourierManager

```js
const meta    = courier.metadataFor(PROVIDERS.MAYSTRO);
const allMeta = courier.allMetadata();
```

---

## Normalised Tracking Statuses

No matter which provider you use, `order.status` always returns a value from `TRACKING_STATUS`:

```js
import { TRACKING_STATUS, getStatusLabel, getStatusLabelFr, getStatusLabelAr, getStatusColor } from 'courier-dz';

TRACKING_STATUS.PENDING          // 'pending'          — Created, not yet collected
TRACKING_STATUS.PICKED_UP        // 'picked_up'        — Collected from sender
TRACKING_STATUS.IN_TRANSIT       // 'in_transit'       — Moving between hubs
TRACKING_STATUS.OUT_FOR_DELIVERY // 'out_for_delivery' — With delivery agent
TRACKING_STATUS.DELIVERED        // 'delivered'        — Successfully delivered ✓
TRACKING_STATUS.FAILED_DELIVERY  // 'failed_delivery'  — Attempt failed
TRACKING_STATUS.RETURNING        // 'returning'        — Heading back to sender
TRACKING_STATUS.RETURNED         // 'returned'         — Back at sender
TRACKING_STATUS.CANCELLED        // 'cancelled'        — Cancelled before shipment
TRACKING_STATUS.READY_FOR_PICKUP // 'ready_for_pickup' — At stop desk / relay point
TRACKING_STATUS.EXCEPTION        // 'exception'        — Lost, damaged, or blocked
TRACKING_STATUS.UNKNOWN          // 'unknown'          — Unmapped raw status

// Label helpers
getStatusLabel('delivered');    // "Delivered"
getStatusLabelFr('delivered');  // "Livré"
getStatusLabelAr('delivered');  // "تم التوصيل"
getStatusColor('delivered');    // "green"
```

---

## Delivery Types

```js
import { DELIVERY_TYPE, getDeliveryTypeLabelFr } from 'courier-dz';

DELIVERY_TYPE.HOME      // 1 — Home delivery
DELIVERY_TYPE.STOP_DESK // 2 — Stop desk / relay point

getDeliveryTypeLabelFr(DELIVERY_TYPE.HOME); // "Livraison à domicile"
```

---

## Provider-Specific Notes

### Yalidine / Yalitec
- `getRates()` **requires** `fromWilayaId`
- Auth: `X-API-ID` + `X-API-TOKEN` headers

### Maystro
- Auth: `Token <token>` (Django REST Framework — **not** Bearer)
- `toCommune` must be an **integer** (Maystro commune ID, not a string name)
- Extra method: `adapter.createProduct(storeId, description)`

### Procolis / ZR Express legacy
- `getLabel()` is **not supported**
- Auth: `id` + `token` passed in the request body/query

### ZR Express NEW
- `createOrder()` requires territory UUIDs passed via the `notes` field:
  ```
  "zr_district:{uuid}|Optional note"
  "zr_city:{uuid}|zr_district:{uuid}|Optional note"
  ```
  The wilaya-level UUID (`zr_city`) is **auto-resolved** from `toWilayaId` using a built-in static map — you only need to supply the district UUID.
- `getOrder()` accepts either a UUID parcel ID (`order.raw.id`) or a tracking number (e.g. `16-JUKYSI-ZR`)
- `cancelOrder()` maps to `DELETE /api/v1/parcels/{id}` — accepts UUID or tracking number
- `getLabel()` returns an Azure Blob SAS URL pointing to an HTML label file — **the URL expires, do not cache it**, always regenerate on demand
- Extra method: `adapter.searchTerritory(name, level, parentId)` to look up district UUIDs

### Zimou Express
- Supports three delivery tiers: **Express** (default for `HOME`), **Flexible** (cheaper, slower), **Stop desk** (`STOP_DESK`). To request Flexible, embed a hint in the `notes` field:
  ```js
  notes: 'zimou_delivery_type:Flexible|Leave at door if absent'
  ```
  The adapter strips the prefix and sends the remaining text as the observation note.
- `cancelOrder()` is supported
- `order.notes` contains the name of the assigned partner carrier (e.g. `"Via: Yalidine | Partner tracking: YALI-99999"`)
- `order.raw` exposes partner tracking details: `tracking_partner_company`, `delivery_company_tracking_code`

---

## Custom Adapter

```js
import { PROVIDERS } from 'courier-dz';

courier.extend(PROVIDERS.DHD, (creds) => new MyCustomDhdAdapter(creds));
```

---

## Error Handling

```js
import {
  CourierError,
  AuthenticationError,
  OrderNotFoundError,
  UnsupportedOperationError,
  InvalidCredentialsError,
} from 'courier-dz';

try {
  const order = await adapter.getOrder('INVALID-TRACKING');
} catch (err) {
  if (err instanceof OrderNotFoundError) {
    console.log('Order not found:', err.trackingNumber);
  } else if (err instanceof AuthenticationError) {
    console.log('Invalid credentials:', err.statusCode);
  } else if (err instanceof UnsupportedOperationError) {
    console.log('Unsupported operation:', err.operation, 'for', err.provider);
  } else if (err instanceof CourierError) {
    console.log('Courier error:', err.message, err.statusCode);
  }
}
```

---

## Express.js Integration (MERN)

```js
// routes/shipping.js
import express from 'express';
import { CourierManager, CreateOrderData, PROVIDERS, CourierError } from 'courier-dz';

const router = express.Router();

const courier = new CourierManager({
  providers: {
    yalidine: { token: process.env.YALIDINE_TOKEN, key: process.env.YALIDINE_KEY },
    dhd:      { token: process.env.DHD_TOKEN },
  },
});

// POST /api/shipping/orders
router.post('/orders', async (req, res) => {
  try {
    const { provider, ...orderFields } = req.body;
    const orderData = CreateOrderData.fromObject(orderFields);
    const adapter = courier.provider(provider);
    const order = await adapter.createOrder(orderData);
    res.json({ success: true, order: order.toJSON() });
  } catch (err) {
    if (err instanceof CourierError) {
      res.status(err.statusCode || 400).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// GET /api/shipping/track/:provider/:tracking
router.get('/track/:provider/:tracking', async (req, res) => {
  try {
    const { provider, tracking } = req.params;
    const adapter = courier.provider(provider);
    const order = await adapter.getOrder(tracking);
    res.json(order.toJSON());
  } catch (err) {
    if (err instanceof CourierError) {
      res.status(err.statusCode || 404).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// GET /api/shipping/rates/:provider
router.get('/rates/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { from_wilaya, to_wilaya } = req.query;
    const adapter = courier.provider(provider);
    const rates = await adapter.getRates(
      from_wilaya ? Number(from_wilaya) : null,
      to_wilaya   ? Number(to_wilaya)   : null,
    );
    res.json(rates.map(r => r.toJSON()));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
```

---

## CommonJS

```js
const { CourierManager, PROVIDERS, TRACKING_STATUS } = require('courier-dz');
```

---

## Disclaimer

- Not officially affiliated with or endorsed by any shipping provider.
- Verify all providers are authorised by [ARPCE](https://www.arpce.dz/ar/service/post-sd#operators) before use in production.

---

## Changelog

### v1.0.0
- PHP → JavaScript port (ESM + CommonJS)
- **Removed**: `negmar_express`, `mono_hub` (providers no longer active)
- **Anderson**: updated API URL → `anderson-ecommerce.ecotrack.dz`
- **WorldExpress**: updated API URL → `world-express.ecotrack.dz`
- **New providers**: `swift` (`swift.ecotrack.dz`), `allolivraison` (`allolivraison.ecotrack.dz`)

---

## License

MIT