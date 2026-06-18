# Nuruya CRM — Backend API

Backend REST professionnel pour le CRM e-commerce Nuruya (boutique Shopify, Ghana).
Synchronise les données entre **Shopify**, **ShaQ Express** (livraison) et le CRM.

## Stack

Node.js · Express 5 · PostgreSQL (driver `pg`, **SQL natif, sans ORM**) · JWT
(`jsonwebtoken`) · `bcryptjs` · `express-validator` · `helmet` · `cors` · `morgan`
· `express-rate-limit`. Modules **CommonJS**.

## Architecture

```
src/
├── config/         # Configuration par environnement (dotenv)
├── database/       # Pool pg, helpers query/transaction, migrate, seed
├── middleware/     # Auth JWT, RBAC, validation, rate limit, erreurs, webhooks
├── routes/         # Définition des routes (1 fichier par module)
├── controllers/    # Couche HTTP (req/res), enveloppes de réponse
├── services/       # Logique métier (Service Layer Pattern)
├── repositories/   # Accès données SQL (Repository Pattern)
├── validators/     # Règles express-validator
├── utils/          # JWT, password, crypto, réponses, constantes, dates...
├── sql/            # schema.sql
├── docs/           # Collection Postman
├── app.js          # Application Express
└── server.js       # Point d'entrée (listen + arrêt gracieux)
```

Principes : séparation des responsabilités, Repository + Service Layer, middleware
global d'erreurs, configuration par environnement, requêtes **toujours
paramétrées** (`$1, $2…`), `ORDER BY` protégé par whitelist.

## Installation

```bash
npm install
cp .env.example .env       # puis éditer les valeurs
```

Créer la base puis appliquer le schéma et les données de démo :

```bash
createdb nuruya_crm        # ou via pgAdmin / psql
npm run migrate            # applique src/sql/schema.sql (idempotent)
npm run seed               # rôles + super admin + produits de démo
```

Démarrer :

```bash
npm run dev                # node --watch
npm start                  # production
```

**Compte super admin de démo :** `admin@nuruya.com` / `Admin@123` (à changer).

## Variables d'environnement

Voir `.env.example`. Principales : `PORT`, `API_PREFIX`, `PG*` (connexion DB),
`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, `BCRYPT_ROUNDS`, `CORS_ORIGIN`,
`RATE_LIMIT_*`, `SHOPIFY_*`, `SHAQ_*`.

## Format des réponses

Succès :
```json
{ "success": true, "message": "…", "data": {}, "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }
```
Erreur :
```json
{ "success": false, "message": "Erreur de validation", "errors": [ { "field": "email", "message": "Email invalide" } ] }
```

## Authentification & rôles (RBAC)

JWT Bearer. `Authorization: Bearer <accessToken>`. Refresh token rotatif (haché
en base). Rôles : `super_admin`, `admin`, `manager`, `agent`, `finance`
(`super_admin` passe partout).

## Endpoints (préfixe `/api/v1`)

### Auth — `/auth`
| Méthode | Route | Accès |
|---|---|---|
| POST | `/login` | public |
| POST | `/refresh` | public |
| POST | `/forgot-password` | public |
| POST | `/reset-password` | public |
| GET | `/me` | authentifié |
| POST | `/logout` | authentifié |
| POST | `/change-password` | authentifié |
| POST | `/register` | admin |

### Utilisateurs — `/users` (admin)
`GET /` (liste + recherche + pagination), `GET /roles`, `GET /:id`,
`PUT /:id` (profil), `PATCH /:id/roles`, `PATCH /:id/active` (activer/désactiver),
`DELETE /:id`. Garde-fous : impossible de se désactiver ou se supprimer soi-même.
La **création** d'utilisateur reste sur `POST /auth/register`.

### Produits — `/products`
CRUD + recherche, pagination, tri, filtres (`category`, `status`, `stockState`).
`PATCH /:id/stock` (`quantity` absolu ou `delta`). Lecture : tous ; écriture :
admin/manager ; suppression : admin.

### Commandes — `/orders`
CRUD, `/:id/archive`, `/:id/restore`, suppression (admin). Recherche, pagination,
tri, filtres statut/région/ville/paiement/archivé et **filtres date dashboard**
(`?period=today|yesterday|week|month|year|custom`, ou `?from=&to=`).
Opérations en masse : `PATCH /bulk/status`, `/bulk/archive`, `/bulk/notes`.

### Dashboard opérationnel — `/dashboard`
`overview`, `kpis`, `revenue-series` (`?granularity=day|week|month|year`),
`status-distribution`, `order-volume`, `delivery-funnel`, `top-products`,
`top-regions`, `cancellation-by-region`. Tous acceptent les filtres de date.

KPIs : total/livrées/en attente/retournées, taux d'annulation, taux de retour,
chiffre d'affaires, panier moyen, délai moyen de livraison, coût logistique
total, coût ShaQ total, marge nette moyenne.

### Dashboard financier — `/finance` (admin, manager, finance)
`summary` (CA total, encaissé, restant, COD en attente, position nette),
`report` (`?granularity=…`, série + totaux).

### Shopify — `/shopify` (admin, manager)
`GET/PUT /settings`, `GET /check-connection`, `POST /sync/products`,
`POST /sync/orders` (sync manuelle / rattrapage), `GET /sync/history`,
`POST /webhooks/register` (enregistre automatiquement les webhooks dans Shopify).

**Synchronisation temps réel (webhooks Shopify)** — endpoints publics signés
HMAC-SHA256 base64 (`X-Shopify-Hmac-Sha256`, secret `SHOPIFY_WEBHOOK_SECRET`) :
- `POST /shopify/webhooks/orders` — topics `orders/create`, `orders/updated`
- `POST /shopify/webhooks/orders/cancelled` — topic `orders/cancelled` (force le statut `cancelled`)
- `POST /shopify/webhooks/fulfillments` — topics `fulfillments/create`, `fulfillments/update` (mappe `shipment_status` → statut de livraison + n° de suivi, voir `src/utils/shopifyFulfillment.js`)
- `POST /shopify/webhooks/products` — topics `products/create`, `products/update`
- `POST /shopify/webhooks/inventory` — topic `inventory_levels/update` (maj du stock par `inventory_item_id`)

Dès qu'une commande est créée/modifiée sur Shopify, elle est *poussée* et
upsert immédiatement (pas de polling). Mise en place : renseigner
`SHOPIFY_WEBHOOK_SECRET` + `APP_PUBLIC_URL`, puis `POST /shopify/webhooks/register`
(ou enregistrer manuellement les URLs dans Shopify Admin → Notifications).

> **Dates & fuseau horaire** : la date de commande (`ordered_at`) **et** la date
> d'insertion (`created_at`) reprennent le `created_at` de Shopify, exprimé dans
> le fuseau **Ghana (`Africa/Accra`, GMT+0)**. Chaque connexion PostgreSQL fait
> `SET TIME ZONE 'Africa/Accra'` (`APP_TIMEZONE`), donc `now()`, l'affichage des
> `TIMESTAMPTZ` et les regroupements `date_trunc` des dashboards sont tous en
> heure du Ghana. La date dans le CRM est ainsi identique à celle de Shopify.

### ShaQ — `/shaq`
`POST /webhook` (public, signé HMAC `x-shaq-signature`), `GET /events`,
`GET /orders/:orderId/events`. Le webhook mappe le statut ShaQ → statut interne,
enregistre l'événement et met à jour la commande automatiquement.

### Audit — `/audit-logs` (admin)
`GET /` avec filtres `userId`, `action`, pagination.

## Statuts de livraison

`pending`, `collection`, `transit`, `dispatch`, `delivered`, `cancelled`,
`returned`, `failed_delivery`, `issue` (alignés sur ShaQ Express, mapping dans
`src/utils/shaqStatus.js`).

## Sécurité

JWT · bcrypt · Helmet · CORS configurable · rate limiting (global + auth) ·
validation des entrées (express-validator) · requêtes paramétrées · vérification
de signature HMAC des webhooks · refresh tokens hachés et rotatifs.

## Collection Postman

`src/docs/nuruya-crm.postman_collection.json`. Importer, définir `{{baseUrl}}`,
exécuter **Login** (enregistre automatiquement les tokens).
