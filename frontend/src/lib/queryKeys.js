/**
 * Centralized React Query key factory.
 *
 * Using one factory keeps cache keys consistent and makes invalidation precise
 * (e.g. `queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })`).
 */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'],
  },
  orders: {
    all: ['orders'],
    list: (params) => ['orders', 'list', params ?? {}],
    detail: (id) => ['orders', 'detail', id],
  },
  products: {
    all: ['products'],
    list: (params) => ['products', 'list', params ?? {}],
    detail: (id) => ['products', 'detail', id],
    kpis: ['products', 'kpis'],
  },
  dashboard: {
    all: ['dashboard'],
    data: (period, status) => ['dashboard', 'data', period ?? 'all', status ?? 'all'],
  },
  finance: {
    all: ['finance'],
    data: (params) => ['finance', 'data', params ?? {}],
  },
  users: {
    all: ['users'],
    list: (params) => ['users', 'list', params ?? {}],
    roles: ['users', 'roles'],
  },
  shopify: {
    settings: ['shopify', 'settings'],
    history: (type) => ['shopify', 'history', type ?? 'all'],
    connection: ['shopify', 'connection'],
  },
  shaq: {
    all: ['shaq'],
    events: (params) => ['shaq', 'events', params ?? {}],
    orderEvents: (orderId) => ['shaq', 'order-events', orderId],
  },
  audit: {
    all: ['audit'],
    list: (params) => ['audit', 'list', params ?? {}],
  },
};

export default queryKeys;
