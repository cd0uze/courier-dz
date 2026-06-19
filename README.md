# courier-dz

[![npm version](https://img.shields.io/npm/v/courier-dz.svg)](https://www.npmjs.com/package/courier-dz)
[![license](https://img.shields.io/npm/l/courier-dz.svg)](./LICENSE)

Client API unifié pour les sociétés de livraison algériennes. Un seul package, une seule interface pour **30 providers**.

Supports ESM et CommonJS.

---

## Providers supportés

### Moteurs indépendants

| Provider | ID | Base URL |
|---|---|---|
| Yalidine | `yalidine` | `api.yalidine.app` |
| Yalitec | `yalitec` | `api.yalitec.me` |
| Maystro Delivery | `maystro` | `backend.maystro-delivery.com` |
| Procolis | `procolis` | `procolis.com/api_v1` |
| ZR Express (legacy) | `zrexpress` | `procolis.com/api_v1` |
| ZR Express NEW | `zrexpress_new` | `api.zrexpress.app` |
| Zimou Express | `zimou` | `zimou.express/api` |

### Moteur Ecotrack (24 sous-providers)

| Provider | ID |
|---|---|
| Ecotrack | `ecotrack` |
| Anderson Delivery | `anderson` |
| Areex | `areex` |
| BA Consult | `ba_consult` |
| Conexlog | `conexlog` |
| Coyote Express | `coyote_express` |
| DHD | `dhd` |
| Distazero | `distazero` |
| 48Hr Livraison | `e48hr` |
| FRET.Direct | `fretdirect` |
| GOLIVRI | `golivri` |
| MSM Go | `msm_go` |
| Packers | `packers` |
| Prest | `prest` |
| RB Livraison | `rb_livraison` |
| Rex Livraison | `rex_livraison` |
| Rocket Delivery | `rocket_delivery` |
| Salva Delivery | `salva_delivery` |
| Speed Delivery | `speed_delivery` |
| TSL Express | `tsl_express` |
| WorldExpress | `worldexpress` |
| Swift | `swift` |
| AlloLivraison | `allolivraison` |

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

    // Maystro — token Django REST Framework
    maystro: { token: 'YOUR_MAYSTRO_TOKEN' },

    // Procolis / ZR Express legacy — id + token
    procolis:  { id: 'YOUR_ID', token: 'YOUR_TOKEN' },
    zrexpress: { id: 'YOUR_ID', token: 'YOUR_TOKEN' },

    // ZR Express NEW — tenant UUID + API key
    zrexpress_new: { tenant_id: 'YOUR_TENANT_UUID', api_key: 'YOUR_API_KEY' },

    // Zimou Express — Bearer token
    zimou: { token: 'YOUR_ZIMOU_TOKEN' },

    // Tous les sous-providers Ecotrack — Bearer token
    dhd:           { token: 'YOUR_DHD_TOKEN' },
    anderson:      { token: 'YOUR_ANDERSON_TOKEN' },
    worldexpress:  { token: 'YOUR_WORLDEXPRESS_TOKEN' },
    swift:         { token: 'YOUR_SWIFT_TOKEN' },
    allolivraison: { token: 'YOUR_ALLOLIVRAISON_TOKEN' },
    // ... etc.
  },
});
```

### Credentials à la volée (sans config)

```js
const adapter = courier.provider('yalidine', {
  token: 'YOUR_API_ID',
  key: 'YOUR_API_KEY',
});
```

---

## Usage

### Créer une commande

```js
import { CourierManager, CreateOrderData, PROVIDERS, DELIVERY_TYPE } from 'courier-dz';

const courier = new CourierManager({ providers: { yalidine: { token: '...', key: '...' } } });

const orderData = new CreateOrderData({
  orderId: 'CMD-001',
  firstName: 'Mohamed',
  lastName: 'Benali',
  phone: '0555123456',
  address: '12 Rue Didouche Mourad',
  toWilayaId: 16,        // Alger
  toCommune: 'Hussein Dey',
  productDescription: 'Montre connectée',
  price: 4500,           // Montant COD en DZD
  deliveryType: DELIVERY_TYPE.HOME,
});

// Depuis un objet brut (body d'une requête Express)
const orderData2 = CreateOrderData.fromObject(req.body);

const adapter = courier.provider(PROVIDERS.YALIDINE);
const order = await adapter.createOrder(orderData);

console.log(order.trackingNumber); // "YLD-XXXXXXX"
console.log(order.status);         // "pending"
console.log(order.label());        // "Pending"
console.log(order.labelFr());      // "En attente"
console.log(order.labelAr());      // "قيد الانتظار"
console.log(order.toJSON());       // Objet sérialisable
```

### Récupérer une commande

```js
const adapter = courier.provider(PROVIDERS.MAYSTRO);
const order = await adapter.getOrder('TRACKING-NUMBER');

console.log(order.status);         // "delivered"
console.log(order.isDelivered());  // true
console.log(order.isTerminal());   // true
```

### Obtenir les tarifs

```js
const adapter = courier.provider(PROVIDERS.YALIDINE);

// Yalidine nécessite le fromWilayaId
const rates = await adapter.getRates(16); // Depuis Alger

rates.forEach(rate => {
  console.log(`${rate.toWilayaName}: domicile=${rate.homeDeliveryPrice} DZD, stop-desk=${rate.stopDeskPrice} DZD`);
});

// Ecotrack — optionnel
const dhdAdapter = courier.provider(PROVIDERS.DHD);
const dhdRates = await dhdAdapter.getRates(null, 31); // Vers Oran
```

### Récupérer un label

```js
import { LABEL_TYPE } from 'courier-dz';

const adapter = courier.provider(PROVIDERS.ECOTRACK);
const label = await adapter.getLabel('TRACKING-NUMBER');

if (label.type === LABEL_TYPE.PDF_URL) {
  console.log('PDF URL:', label.url);
} else if (label.type === LABEL_TYPE.PDF_BASE64) {
  const pdfBuffer = label.decodePdf(); // Buffer Node.js
  fs.writeFileSync('label.pdf', pdfBuffer);
} else if (label.type === LABEL_TYPE.HTML_URL) {
  // ZR Express NEW — SAS URL Azure qui expire rapidement
  console.log('HTML URL:', label.url);
}
```

### Annuler une commande

```js
// Supporté par Zimou et ZR Express NEW
const zimouAdapter = courier.provider(PROVIDERS.ZIMOU);
const cancelled = await zimouAdapter.cancelOrder('ZM-TRACKING');
console.log(cancelled); // true
```

### Vérifier les credentials

```js
const adapter = courier.provider(PROVIDERS.DHD);
const isValid = await adapter.testCredentials();
console.log(isValid); // true / false
```

---

## Métadonnées des providers

### Un seul provider

```js
import { getProviderMetadata, PROVIDERS } from 'courier-dz';

const meta = getProviderMetadata(PROVIDERS.YALIDINE);
console.log(meta.title);      // "Yalidine"
console.log(meta.logo);       // "https://yalidine.com/assets/img/..."
console.log(meta.trackingUrl);// "https://yalidine.com/suivre-un-colis/"
```

### Tous les providers (pour une UI de sélection)

```js
import { getAllProvidersMetadata } from 'courier-dz';

const allMeta = getAllProvidersMetadata();

// En React :
Object.entries(allMeta).map(([id, meta]) => (
  <option key={id} value={id}>{meta.title}</option>
));
```

### Via CourierManager

```js
const meta = courier.metadataFor(PROVIDERS.MAYSTRO);
const allMeta = courier.allMetadata();
```

---

## Statuts de tracking normalisés

Peu importe le provider, `order.status` retourne toujours une valeur de `TRACKING_STATUS` :

```js
import { TRACKING_STATUS, getStatusLabel, getStatusLabelFr, getStatusColor } from 'courier-dz';

// Valeurs possibles :
TRACKING_STATUS.PENDING          // 'pending'
TRACKING_STATUS.PICKED_UP        // 'picked_up'
TRACKING_STATUS.IN_TRANSIT       // 'in_transit'
TRACKING_STATUS.OUT_FOR_DELIVERY // 'out_for_delivery'
TRACKING_STATUS.DELIVERED        // 'delivered'
TRACKING_STATUS.FAILED_DELIVERY  // 'failed_delivery'
TRACKING_STATUS.RETURNING        // 'returning'
TRACKING_STATUS.RETURNED         // 'returned'
TRACKING_STATUS.CANCELLED        // 'cancelled'
TRACKING_STATUS.READY_FOR_PICKUP // 'ready_for_pickup'
TRACKING_STATUS.EXCEPTION        // 'exception'
TRACKING_STATUS.UNKNOWN          // 'unknown'

// Helpers
getStatusLabel('delivered');    // "Delivered"
getStatusLabelFr('delivered');  // "Livré"
getStatusLabelAr('delivered');  // "تم التوصيل"
getStatusColor('delivered');    // "green"
```

---

## Types de livraison

```js
import { DELIVERY_TYPE, getDeliveryTypeLabelFr } from 'courier-dz';

DELIVERY_TYPE.HOME      // 1 — Livraison à domicile
DELIVERY_TYPE.STOP_DESK // 2 — Stop desk / Point relais

getDeliveryTypeLabelFr(DELIVERY_TYPE.HOME); // "Livraison à domicile"
```

---

## Adaptateur personnalisé

```js
import { PROVIDERS } from 'courier-dz';

courier.extend(PROVIDERS.DHD, (creds) => new MyCustomDhdAdapter(creds));
```

---

## Gestion des erreurs

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
    console.log('Commande introuvable:', err.trackingNumber);
  } else if (err instanceof AuthenticationError) {
    console.log('Credentials invalides:', err.statusCode);
  } else if (err instanceof UnsupportedOperationError) {
    console.log('Opération non supportée:', err.operation, 'pour', err.provider);
  } else if (err instanceof CourierError) {
    console.log('Erreur courier:', err.message, err.statusCode);
  }
}
```

---

## Notes spéciales par provider

### Yalidine / Yalitec
- `getRates()` nécessite **obligatoirement** `fromWilayaId`
- Auth : `X-API-ID` + `X-API-TOKEN`

### Maystro
- Auth : `Token <token>` (Django REST Framework, **pas** Bearer)
- `toCommune` doit être un **integer** (ID de commune Maystro)
- Méthode supplémentaire : `adapter.createProduct(storeId, description)`

### Procolis / ZR Express legacy
- `getLabel()` n'est **pas supporté**
- Auth : `id` + `token` dans le body/query

### ZR Express NEW
- `createOrder()` nécessite des UUIDs de territoire dans `notes` :
  ```
  "zr_district:{uuid}|Note optionnelle"
  "zr_city:{uuid}|zr_district:{uuid}|Note optionnelle"
  ```
- `getLabel()` retourne une URL HTML Azure SAS (expire rapidement — à télécharger immédiatement)
- Méthode supplémentaire : `adapter.searchTerritory(name, level, parentId)`

### Zimou Express
- Delivery type hint via `notes` : `"zimou_delivery_type:Flexible|Votre note"`
- `cancelOrder()` est supporté
- `order.notes` contient le nom du transporteur partenaire assigné

---

## Intégration Express.js (MERN)

```js
// routes/shipping.js
import express from 'express';
import { CourierManager, CreateOrderData, PROVIDERS, CourierError } from 'courier-dz';

const router = express.Router();

const courier = new CourierManager({
  providers: {
    yalidine: { token: process.env.YALIDINE_TOKEN, key: process.env.YALIDINE_KEY },
    dhd: { token: process.env.DHD_TOKEN },
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
      to_wilaya ? Number(to_wilaya) : null,
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

## Changelog

### v1.0.0
- Conversion PHP → JavaScript (ESM + CommonJS)
- **Supprimés** : `negmar_express`, `mono_hub` (providers hors service)
- **Anderson** : nouvelle URL API → `anderson-ecommerce.ecotrack.dz`
- **WorldExpress** : nouvelle URL API → `world-express.ecotrack.dz`
- **Nouveaux providers** : `swift` (swift.ecotrack.dz), `allolivraison` (allolivraison.ecotrack.dz)

---

## License

MIT
