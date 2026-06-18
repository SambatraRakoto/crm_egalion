/**
 * Single source of truth for backend endpoint paths.
 *
 * Paths are relative to `config.apiBaseUrl` (e.g. http://localhost:4000/api/v1)
 * and mirror the Express routes exactly. If the backend renames a route, change
 * it here only.
 */
export const endpoints = {
  health: '/health',

  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    logout: '/auth/logout',
    me: '/auth/me',
    changePassword: '/auth/change-password',
    register: '/auth/register', // admin-only: creates a user
  },

  products: {
    root: '/products',
    byId: (id) => `/products/${id}`,
    stock: (id) => `/products/${id}/stock`,
  },

  orders: {
    root: '/orders',
    byId: (id) => `/orders/${id}`,
    archive: (id) => `/orders/${id}/archive`,
    restore: (id) => `/orders/${id}/restore`,
    bulkStatus: '/orders/bulk/status',
    bulkArchive: '/orders/bulk/archive',
    bulkNotes: '/orders/bulk/notes',
  },

  dashboard: {
    overview: '/dashboard/overview',
    kpis: '/dashboard/kpis',
    revenueSeries: '/dashboard/revenue-series', // ?granularity=day|week|month|year
    statusDistribution: '/dashboard/status-distribution',
    orderVolume: '/dashboard/order-volume',
    deliveryFunnel: '/dashboard/delivery-funnel',
    topProducts: '/dashboard/top-products', // ?limit
    topRegions: '/dashboard/top-regions', // ?limit
    cancellationByRegion: '/dashboard/cancellation-by-region',
  },

  finance: {
    summary: '/finance/summary',
    report: '/finance/report', // ?period=&granularity=
  },

  users: {
    root: '/users',
    byId: (id) => `/users/${id}`,
    roles: '/users/roles',
    setRoles: (id) => `/users/${id}/roles`,
    setActive: (id) => `/users/${id}/active`,
  },

  shopify: {
    settings: '/shopify/settings',
    checkConnection: '/shopify/check-connection',
    syncProducts: '/shopify/sync/products',
    syncOrders: '/shopify/sync/orders',
    registerWebhooks: '/shopify/webhooks/register',
    syncHistory: '/shopify/sync/history', // ?type=products|orders
  },

  shaq: {
    events: '/shaq/events', // ?trackingId=&status=&page=&limit=
    orderEvents: (orderId) => `/shaq/orders/${orderId}/events`,
    ship: (orderId) => `/shaq/orders/${orderId}/ship`, // push order → ShaQ
    import: '/shaq/import', // pull packages → CRM
    syncStatuses: '/shaq/sync-statuses', // poll & update statuses
  },

  auditLogs: {
    root: '/audit-logs', // ?userId=&action=&page=&limit=
  },
};

export default endpoints;
