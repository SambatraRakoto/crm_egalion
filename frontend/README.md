# Nuruya CRM — Frontend

React + Vite single-page app for the Nuruya Ghana e-commerce CRM (orders,
products, analytics, finance, Shopify sync). It is built to plug into the
Node/Express/PostgreSQL backend (`/api/v1`), but ships **mock-first** so the UI
is fully functional before the backend is live.

## Quick start

```bash
npm install
cp .env.example .env.local   # adjust if needed
npm run dev
```

Default credentials in mock mode: any email/password is accepted.

## Connecting the real backend

The entire data layer flips with environment variables — **no code change**:

```bash
# .env.local
VITE_API_URL=https://api.nuruya.com   # backend origin
VITE_API_PREFIX=/api/v1               # Express mount point
VITE_USE_MOCK=false                   # ← turn mock OFF to hit the real API
```

When `VITE_USE_MOCK=false`, every service swaps its mock branch for a real
`http` call. If a backend route's response shape differs from what's assumed,
adjust the `normalize*` mappers in `src/services/*.service.js` and/or the paths
in `src/api/endpoints.js` — those are the only touch points.

## Architecture

```
src/
├─ config/env.js          # Centralized config (reads import.meta.env once)
├─ types/                 # TypeScript models matching backend DTOs
├─ api/
│  ├─ httpClient.js       # Fetch wrapper: JWT, refresh-rotation, error normalize, envelope unwrap
│  └─ endpoints.js        # All backend paths in one place
├─ lib/
│  ├─ tokenStorage.js     # JWT access/refresh storage
│  ├─ apiError.js         # Normalized ApiError (status, fieldErrors, …)
│  ├─ queryKeys.js        # React Query key factory
│  ├─ orderStatus.js      # Canonical ↔ display status bridge
│  ├─ analytics.js        # Pure aggregations (work on any orders array)
│  └─ AuthContext.jsx     # JWT auth provider (login/register/logout/refresh)
├─ services/              # Domain services — `useMock ? mock : http`
│  ├─ auth | orders | products | dashboard | finance | shopify | users
│  └─ mock/mockUtils.js   # latency/clone/paginate helpers
├─ hooks/                 # React Query hooks (queries + mutations) per domain
├─ components/feedback/   # LoadingState / ErrorState / EmptyState
└─ pages/                 # Screens (consume hooks, never mock data directly*)
```

Data flow: **page → hook (React Query) → service → (mock | httpClient) → backend**.

- **Auth (JWT):** access + refresh tokens in `tokenStorage`; the HTTP client
  auto-refreshes on 401 (single-flight) and emits `auth:unauthorized` so
  `AuthContext` can drop the session. Routes are guarded by `ProtectedRoute` /
  `PublicOnlyRoute`.
- **State:** server state via TanStack Query (caching, loading, error, refetch);
  invalidation keyed through `queryKeys`.
- **Errors/loading:** every data screen renders `LoadingState` / `ErrorState`.

\* Two product sub-tabs (`pages/products/ProductAnalytics.jsx`,
`ProductDetail.jsx`) still read the mock libs directly for their secondary
aggregations. They follow the same pattern — swap their imports for
`useProducts()` / `useOrders()` when wiring them to the backend.

## Backend coverage

Every `/api/v1` route is reachable from the UI:

| Domain | Endpoints | UI |
| --- | --- | --- |
| Auth | login, refresh, logout, me, forgot/reset-password, change-password | Login / Forgot / Reset screens · "Change password" in the top bar |
| Users (admin) | list, roles, create (register), update, set-roles, set-active, delete | **Users** screen + UserFormModal |
| Products | list, get, create, update, stock, delete | **Products** catalog + form + stock |
| Orders | list, get, create, update, archive, restore, delete, bulk status/archive/notes | **Orders** screen, create/edit modals, bulk bar, delete (admin) |
| Dashboard / Finance | overview, kpis, series, funnel, … | **Analytics** + **Financials** screens |
| Shopify | settings get/put, check-connection, sync products/orders, register-webhooks, history | **Products → Shopify Sync** tab |
| ShaQ | events, order events | **Delivery** screen |
| Audit (admin) | list (filter by action) | **Audit Log** screen |

Notes:
- `register` is admin-only (creates a user) — there is no public self-signup.
- The backend stores a single monetary amount per order; the UI treats it as the
  USD base and derives GHS via `VITE_USD_TO_GHS`.
- Display statuses ↔ canonical delivery statuses are bridged in `lib/orderStatus.js`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc` over annotated JS/TS |
