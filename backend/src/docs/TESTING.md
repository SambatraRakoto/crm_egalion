# Guide de test manuel — Nuruya CRM API

Base URL : `http://localhost:4000/api/v1`

## Préparation

1. Créer la base, appliquer le schéma et les données de démo :
   ```bash
   createdb nuruya_crm        # ou via pgAdmin
   npm run migrate
   npm run seed
   npm run dev
   ```
2. Compte super admin créé par le seed : **admin@nuruya.com** / **Admin@123**
3. La plupart des routes exigent l'en-tête : `Authorization: Bearer <accessToken>`
4. Récupère le token via `POST /auth/login` (voir ci-dessous), puis réutilise-le.

> Astuce curl (Git Bash). Sous PowerShell, préfère **Postman** (collection fournie
> dans `src/docs/nuruya-crm.postman_collection.json`) : les corps JSON ci-dessous
> se collent tels quels dans l'onglet *Body → raw → JSON*.

---

## 1. Auth — `/auth`

### POST /auth/login
```json
{ "email": "admin@nuruya.com", "password": "Admin@123" }
```
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nuruya.com","password":"Admin@123"}'
```
→ réponse : `data.accessToken`, `data.refreshToken`, `data.user`.

### POST /auth/register  *(admin)*
```json
{
  "fullName": "Ama Mensah",
  "email": "ama@nuruya.com",
  "phone": "+233201234567",
  "password": "Manager@123",
  "roles": ["manager"]
}
```

### GET /auth/me  *(auth)*
Pas de body. En-tête `Authorization` requis.

### POST /auth/change-password  *(auth)*
```json
{ "currentPassword": "Admin@123", "newPassword": "NewPass@2026" }
```

### POST /auth/refresh
```json
{ "refreshToken": "<refreshToken reçu au login>" }
```

### POST /auth/logout  *(auth)*
```json
{ "refreshToken": "<refreshToken>" }
```

### POST /auth/forgot-password
```json
{ "email": "ama@nuruya.com" }
```
→ en dev, `data.resetToken` est renvoyé (en prod il serait envoyé par email).

### POST /auth/reset-password
```json
{ "token": "<resetToken>", "newPassword": "Reset@2026" }
```

---

## 2. Utilisateurs — `/users`  *(admin)*

### GET /users?page=1&limit=20&search=ama
### GET /users/roles
### GET /users/:id

### PUT /users/:id
```json
{ "fullName": "Ama Mensah Owusu", "phone": "+233209999999" }
```

### PATCH /users/:id/roles
```json
{ "roles": ["manager", "finance"] }
```

### PATCH /users/:id/active
```json
{ "isActive": false }
```

### DELETE /users/:id
Pas de body.

---

## 3. Produits — `/products`

### GET /products?page=1&limit=20&search=crème&category=Beauté&status=active&stockState=low_stock&sortBy=price&sortDir=asc
- `stockState` : `in_stock` | `low_stock` | `out_of_stock`
- `sortBy` : `created_at` | `updated_at` | `name` | `price` | `stock_quantity` | `category`

### GET /products/:id

### POST /products  *(admin, manager)*
```json
{
  "sku": "NRY-010",
  "name": "Beurre de karité brut",
  "description": "Pot de 200g, 100% naturel",
  "category": "Beauté",
  "price": 90.00,
  "supplierCost": 35.00,
  "stockQuantity": 50,
  "lowStockThreshold": 8,
  "productStatus": "active",
  "imageUrl": "https://exemple.com/karite.jpg"
}
```

### PUT /products/:id  *(admin, manager)*
```json
{ "price": 95.00, "stockQuantity": 60, "productStatus": "active" }
```

### PATCH /products/:id/stock  *(admin, manager)*
Valeur absolue :
```json
{ "quantity": 120 }
```
…ou ajustement relatif (peut être négatif) :
```json
{ "delta": -5 }
```

### DELETE /products/:id  *(admin)*

---

## 4. Commandes — `/orders`

### GET /orders (filtres dashboard)
```
/orders?page=1&limit=20&status=pending&region=Greater%20Accra&period=month&sortBy=created_at&sortDir=desc
```
- `period` : `today` | `yesterday` | `week` | `month` | `year` | `custom`
- `custom` : ajouter `&from=2026-01-01&to=2026-06-30`
- `archived` : `true` | `false`
- `sortBy` : `created_at` | `updated_at` | `order_amount` | `delivery_status` | `ordered_at` | `delivered_at`

### GET /orders/:id  → renvoie aussi `items` (lignes de commande)

### POST /orders  *(admin, manager, agent)*
```json
{
  "customerName": "Kwame Boateng",
  "customerPhone": "+233244556677",
  "customerEmail": "kwame@example.com",
  "region": "Greater Accra",
  "city": "Accra",
  "deliveryAddress": "12 Oxford Street, Osu",
  "orderAmount": 240.00,
  "deliveryCost": 20.00,
  "shaqCost": 15.00,
  "paymentMethod": "cod",
  "deliveryStatus": "pending",
  "shaqTrackingId": "SHAQ-ACC-001",
  "notes": "Appeler avant livraison",
  "orderedAt": "2026-06-14T09:30:00+00:00",
  "items": [
    { "productName": "Beurre de karité brut", "sku": "NRY-010", "quantity": 2, "unitPrice": 90.00 },
    { "productName": "Savon naturel", "sku": "NRY-003", "quantity": 1, "unitPrice": 35.00 }
  ]
}
```
- `deliveryStatus` valides : `pending`, `collection`, `transit`, `dispatch`, `delivered`, `cancelled`, `returned`, `failed_delivery`, `issue`
- `productId` (UUID) est optionnel dans `items` si tu veux lier à un produit existant.

### PUT /orders/:id  *(admin, manager, agent)*
```json
{ "deliveryStatus": "delivered", "notes": "Livré à 14h" }
```
→ `delivered_at` est horodaté automatiquement.

### PATCH /orders/:id/archive   ·   PATCH /orders/:id/restore
Pas de body.

### DELETE /orders/:id  *(admin)*

### Opérations en masse (les `ids` sont des UUID de commandes)
PATCH /orders/bulk/status
```json
{ "ids": ["<uuid1>", "<uuid2>"], "status": "transit" }
```
PATCH /orders/bulk/archive
```json
{ "ids": ["<uuid1>", "<uuid2>"], "archived": true }
```
PATCH /orders/bulk/notes
```json
{ "ids": ["<uuid1>", "<uuid2>"], "notes": "Lot expédié le 14/06" }
```

---

## 5. Dashboard opérationnel — `/dashboard`  *(auth)*

Tous acceptent `?period=today|yesterday|week|month|year|custom` (+ `from`/`to`).

| Endpoint | Exemple |
|---|---|
| GET /dashboard/overview | `/dashboard/overview?period=month` |
| GET /dashboard/kpis | `/dashboard/kpis?period=year` |
| GET /dashboard/revenue-series | `/dashboard/revenue-series?period=year&granularity=month` |
| GET /dashboard/status-distribution | `/dashboard/status-distribution?period=month` |
| GET /dashboard/order-volume | `/dashboard/order-volume?period=week` |
| GET /dashboard/delivery-funnel | `/dashboard/delivery-funnel?period=month` |
| GET /dashboard/top-products | `/dashboard/top-products?period=month&limit=5` |
| GET /dashboard/top-regions | `/dashboard/top-regions?period=month&limit=5` |
| GET /dashboard/cancellation-by-region | `/dashboard/cancellation-by-region?period=year` |

`granularity` (revenue-series) : `day` | `week` | `month` | `year`.

---

## 6. Dashboard financier — `/finance`  *(admin, manager, finance)*

### GET /finance/summary?period=month
### GET /finance/report?period=year&granularity=month

---

## 7. Shopify — `/shopify`  *(admin, manager)*

### PUT /shopify/settings
```json
{
  "storeDomain": "ma-boutique.myshopify.com",
  "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxx",
  "apiVersion": "2024-10"
}
```
### GET /shopify/settings   ·   GET /shopify/check-connection
### POST /shopify/sync/products   ·   POST /shopify/sync/orders
### GET /shopify/sync/history?type=orders
### POST /shopify/webhooks/register  *(nécessite APP_PUBLIC_URL)*

### Webhooks temps réel (publics — signés HMAC)
> En **dev**, laisse `SHOPIFY_WEBHOOK_SECRET` vide dans `.env` : la vérification de
> signature est ignorée, tu peux poster sans en-tête. Sinon, calcule la signature :
> ```bash
> node -e "const c=require('crypto');const b=process.argv[1];console.log(c.createHmac('sha256','TON_SECRET').update(b).digest('base64'))" '{"id":1,...}'
> ```
> puis ajoute l'en-tête `X-Shopify-Hmac-Sha256: <résultat>`.

POST /shopify/webhooks/orders  (orders/create, orders/updated)
```json
{
  "id": 450789469,
  "name": "#1001",
  "email": "client@example.com",
  "total_price": "199.00",
  "financial_status": "paid",
  "created_at": "2026-06-14T10:30:00+00:00",
  "shipping_address": {
    "name": "Kwame Boateng",
    "phone": "+233244556677",
    "province": "Greater Accra",
    "city": "Accra",
    "address1": "12 Oxford Street",
    "address2": "Osu"
  }
}
```

POST /shopify/webhooks/orders/cancelled  (orders/cancelled)
```json
{
  "id": 450789469,
  "name": "#1001",
  "created_at": "2026-06-14T10:30:00+00:00",
  "cancelled_at": "2026-06-15T08:00:00+00:00",
  "total_price": "199.00"
}
```

POST /shopify/webhooks/fulfillments  (fulfillments/create, fulfillments/update)
```json
{
  "order_id": 450789469,
  "status": "success",
  "shipment_status": "in_transit",
  "tracking_number": "SHAQ-ACC-001"
}
```

POST /shopify/webhooks/products  (products/create, products/update)
```json
{
  "id": 632910392,
  "title": "Crème hydratante",
  "body_html": "Soin visage hydratant",
  "product_type": "Beauté",
  "image": { "src": "https://exemple.com/creme.jpg" },
  "variants": [
    { "sku": "NRY-001", "price": "120.00", "inventory_quantity": 40, "inventory_item_id": 808950810 }
  ]
}
```

POST /shopify/webhooks/inventory  (inventory_levels/update)
```json
{ "inventory_item_id": 808950810, "location_id": 905684977, "available": 25 }
```
> Le produit doit avoir été synchronisé (ou créé via webhook produit) au préalable
> pour que son `inventory_item_id` soit connu.

---

## 8. ShaQ — `/shaq`

### POST /shaq/webhook  (public, signé `x-shaq-signature` en **hex**)
> En dev, laisse `SHAQ_WEBHOOK_SECRET` vide pour ignorer la signature.
> Calcul (hex) : `...digest('hex')` au lieu de `base64`.
```json
{
  "tracking_id": "SHAQ-ACC-001",
  "status": "in_transit",
  "description": "Colis en route vers Accra",
  "timestamp": "2026-06-14T11:00:00+00:00"
}
```
- `status` ShaQ acceptés (mappés) : `pending`, `collected`/`picked_up`, `in_transit`,
  `out_for_delivery`, `delivered`, `cancelled`, `returned`, `failed`, `issue`…
- Si une commande a `shaqTrackingId = "SHAQ-ACC-001"`, son statut est mis à jour automatiquement.

### GET /shaq/events?trackingId=SHAQ-ACC-001&status=transit&page=1&limit=20  *(auth)*
### GET /shaq/orders/:orderId/events  *(auth)*

---

## 9. Audit — `/audit-logs`  *(admin)*

### GET /audit-logs?action=order.update&page=1&limit=20
- `action` ex. : `user.login`, `user.create`, `order.create`, `order.update`,
  `product.create`, `sync.run`…
- `userId` (UUID) pour filtrer par utilisateur.

---

## 10. Santé

### GET /health  (public)
→ `{ "success": true, "data": { "uptime": ... } }`

---

## Format des réponses

Succès :
```json
{ "success": true, "message": "...", "data": { }, "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```
Erreur :
```json
{ "success": false, "message": "Erreur de validation", "errors": [ { "field": "email", "message": "Email invalide" } ] }
```
