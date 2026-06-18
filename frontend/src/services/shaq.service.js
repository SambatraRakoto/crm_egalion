/**
 * ShaQ delivery-events service (read-only history of carrier status updates).
 */
import { config } from '@/config/env';
import { http } from '@/api/httpClient';
import { endpoints } from '@/api/endpoints';
import { simulate } from '@/services/mock/mockUtils';
import { displayForCanonical } from '@/lib/orderStatus';

const MOCK_EVENTS = Array.from({ length: 24 }).map((_, i) => {
  const statuses = ['pending', 'received', 'collected', 'in_transit', 'dispatched', 'confirmed', 'delivered', 'not_delivered', 'rescheduled', 'returned_to_sender'];
  const status = statuses[i % statuses.length];
  const d = new Date('2026-06-14T08:00:00');
  d.setHours(d.getHours() - i * 5);
  return {
    id: `EVT-${1000 + i}`,
    orderId: `ORD-${10000 + (i % 30)}`,
    trackingId: `SHAQ-${900000 + i}`,
    status,
    rawStatus: status.toUpperCase(),
    description: `Colis ${status.replace('_', ' ')}`,
    occurredAt: d.toISOString(),
    createdAt: d.toISOString(),
  };
});

function normalizeEvent(row = {}) {
  const status = row.status ?? row.delivery_status ?? '';
  return {
    id: row.id,
    orderId: row.orderId ?? row.order_id ?? null,
    trackingId: row.trackingId ?? row.tracking_id ?? '',
    status,
    statusLabel: displayForCanonical(status),
    rawStatus: row.rawStatus ?? row.raw_status ?? '',
    description: row.description ?? '',
    occurredAt: row.occurredAt ?? row.occurred_at ?? row.created_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
  };
}

export const shaqService = {
  /** List delivery events with pagination meta. */
  async listEvents(params = {}) {
    if (config.useMock) {
      return simulate(() => {
        let rows = MOCK_EVENTS;
        if (params.status) rows = rows.filter((e) => e.status === params.status);
        if (params.trackingId) rows = rows.filter((e) => e.trackingId.includes(params.trackingId));
        return { items: rows.map(normalizeEvent), meta: { page: 1, limit: rows.length, total: rows.length, totalPages: 1, hasNext: false, hasPrev: false } };
      });
    }
    const { data, meta } = await http.getRaw(endpoints.shaq.events, { params });
    const rows = Array.isArray(data) ? data : data?.items ?? [];
    return { items: rows.map(normalizeEvent), meta };
  },

  /** Delivery events for a single order. */
  async eventsForOrder(orderId) {
    if (config.useMock) {
      return simulate(() => MOCK_EVENTS.filter((e) => e.orderId === orderId).map(normalizeEvent));
    }
    const data = await http.get(endpoints.shaq.orderEvents(orderId));
    return (Array.isArray(data) ? data : []).map(normalizeEvent);
  },

  /** (1) Send a CRM order to ShaQ as a new package. */
  async shipOrder(orderId) {
    if (config.useMock) {
      return simulate({ orderId, partnerRef: `#NA-${orderId}`, trackingNumber: `SHAQ-${Date.now()}`, status: 'pending' });
    }
    return http.post(endpoints.shaq.ship(orderId));
  },

  /** (2) Import packages present in ShaQ into the CRM (deduped by partner_ref). */
  async importPackages() {
    if (config.useMock) return simulate({ created: 3, updated: 5, skipped: 0, imported: 8 });
    return http.post(endpoints.shaq.import);
  },

  /** (3) Poll ShaQ and update CRM statuses that changed. */
  async syncStatuses() {
    if (config.useMock) return simulate({ checked: 12, changed: 4, errors: [] });
    return http.post(endpoints.shaq.syncStatuses);
  },
};

export default shaqService;
