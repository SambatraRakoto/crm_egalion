/**
 * Shopify integration service: settings, connection check, manual sync, webhook
 * registration and sync history.
 */
import { config } from '@/config/env';
import { http } from '@/api/httpClient';
import { endpoints } from '@/api/endpoints';
import { simulate } from '@/services/mock/mockUtils';
import { SYNC_HISTORY } from '@/lib/mockProducts';

let mockHistory = SYNC_HISTORY.map((h) => ({ ...h }));
let mockSettings = {
  storeDomain: 'nuruya-ghana.myshopify.com',
  apiVersion: '2024-10',
  connected: true,
  autoSync: true,
  hasToken: true,
};

/** Normalize a backend settings payload (shape may vary) into the UI shape. */
function normalizeSettings(row = {}) {
  return {
    storeDomain: row.storeDomain ?? row.store_domain ?? mockSettings.storeDomain,
    apiVersion: row.apiVersion ?? row.api_version ?? '2024-10',
    connected: row.connected ?? row.is_connected ?? false,
    lastSyncedAt: row.lastSyncedAt ?? row.last_synced_at ?? null,
    hasToken: row.hasToken ?? Boolean(row.access_token || row.accessToken) ?? false,
    autoSync: row.autoSync ?? row.auto_sync ?? false,
  };
}

/** Normalize a sync_logs row into the UI SyncLog shape. */
function normalizeLog(row = {}) {
  const start = row.started_at || row.startedAt;
  const end = row.completed_at || row.completedAt;
  let duration = '—';
  if (start && end) {
    const s = Math.max(0, (new Date(end) - new Date(start)) / 1000);
    duration = `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, '0')}s`;
  }
  const type = row.sync_type || row.syncType || '';
  const records = Number(row.records_processed ?? row.recordsProcessed ?? 0);
  return {
    id: row.id,
    date: start || end || row.created_at || new Date().toISOString(),
    status: row.status === 'success' ? 'success' : row.status === 'failed' ? 'error' : row.status || 'warning',
    products: type === 'products' ? records : 0,
    orders: type === 'orders' ? records : 0,
    duration,
    note: row.error_message || row.errorMessage || `${type} sync`,
    type,
  };
}

export const shopifyService = {
  /** @returns {Promise<object>} */
  async getSettings() {
    if (config.useMock) return simulate(() => ({ ...mockSettings }));
    return normalizeSettings(await http.get(endpoints.shopify.settings));
  },

  /** @param {{storeDomain?:string, accessToken?:string, apiVersion?:string}} payload */
  async updateSettings(payload) {
    if (config.useMock) {
      return simulate(() => {
        mockSettings = {
          ...mockSettings,
          storeDomain: payload.storeDomain ?? mockSettings.storeDomain,
          apiVersion: payload.apiVersion ?? mockSettings.apiVersion,
          hasToken: payload.accessToken ? true : mockSettings.hasToken,
        };
        return { ...mockSettings };
      });
    }
    return normalizeSettings(await http.put(endpoints.shopify.settings, payload));
  },

  /** @returns {Promise<{connected:boolean, shop?:object}>} */
  async checkConnection() {
    if (config.useMock) {
      return simulate({ connected: true, shop: { name: 'Nuruya Ghana', domain: mockSettings.storeDomain, email: 'shop@nuruya.com' } });
    }
    return http.get(endpoints.shopify.checkConnection);
  },

  /** @returns {Promise<import('@/types').SyncLog[]>} */
  async getHistory(type) {
    if (config.useMock) {
      return simulate(() => mockHistory.filter((h) => !type || h.type === type || h.type === undefined).map((h) => ({ ...h })));
    }
    const { data } = await http.getRaw(endpoints.shopify.syncHistory, { params: { type, limit: 50 } });
    const rows = Array.isArray(data) ? data : data?.items ?? [];
    return rows.map(normalizeLog);
  },

  /** Trigger a manual sync. `kind` is 'products' | 'orders'. */
  async sync(kind = 'products') {
    if (config.useMock) {
      return simulate(() => {
        const entry = {
          id: mockHistory.length + 1,
          date: new Date().toISOString(),
          status: 'success',
          products: kind === 'products' ? 80 : 0,
          orders: kind === 'orders' ? 500 : 0,
          duration: '1m 42s',
          note: `Manual ${kind} sync`,
          type: kind,
        };
        mockHistory = [entry, ...mockHistory];
        return entry;
      });
    }
    const path = kind === 'orders' ? endpoints.shopify.syncOrders : endpoints.shopify.syncProducts;
    return normalizeLog(await http.post(path));
  },

  /** Register the real-time webhooks in Shopify. */
  async registerWebhooks() {
    if (config.useMock) {
      return simulate(() => [
        { topic: 'orders/create', status: 'created' },
        { topic: 'products/update', status: 'created' },
        { topic: 'fulfillments/update', status: 'already_registered' },
      ]);
    }
    return http.post(endpoints.shopify.registerWebhooks);
  },
};

export default shopifyService;
