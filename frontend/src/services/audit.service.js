/**
 * Audit-log service (admin, read-only).
 */
import { config } from '@/config/env';
import { http } from '@/api/httpClient';
import { endpoints } from '@/api/endpoints';
import { simulate } from '@/services/mock/mockUtils';

/** All audit action slugs the backend emits (utils/constants AUDIT_ACTION). */
export const AUDIT_ACTIONS = [
  'user.login', 'user.logout', 'user.create', 'user.update', 'user.delete',
  'order.create', 'order.update', 'order.delete', 'order.archive', 'order.restore',
  'product.create', 'product.update', 'product.delete', 'sync.run',
];

const MOCK_LOGS = Array.from({ length: 30 }).map((_, i) => {
  const d = new Date('2026-06-15T09:00:00');
  d.setMinutes(d.getMinutes() - i * 37);
  const action = AUDIT_ACTIONS[i % AUDIT_ACTIONS.length];
  return {
    id: `LOG-${2000 + i}`,
    userId: String((i % 4) + 1),
    userName: ['Ops Admin', 'Kwame Mensah', 'Ama Boateng', 'Yaw Acheampong'][i % 4],
    action,
    entityType: action.split('.')[0],
    entityId: `${action.split('.')[0]}-${100 + i}`,
    metadata: {},
    ip: `41.66.${i % 255}.${(i * 7) % 255}`,
    userAgent: 'Mozilla/5.0',
    createdAt: d.toISOString(),
  };
});

function normalizeLog(row = {}) {
  return {
    id: row.id,
    userId: row.userId ?? row.user_id ?? null,
    userName: row.userName ?? row.user_name ?? row.full_name ?? null,
    action: row.action ?? '',
    entityType: row.entityType ?? row.entity_type ?? '',
    entityId: row.entityId ?? row.entity_id ?? '',
    metadata: row.metadata ?? {},
    ip: row.ip ?? null,
    userAgent: row.userAgent ?? row.user_agent ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
  };
}

export const auditService = {
  /** @returns {Promise<{items:any[], meta:any}>} */
  async list(params = {}) {
    if (config.useMock) {
      return simulate(() => {
        let rows = MOCK_LOGS;
        if (params.action) rows = rows.filter((l) => l.action === params.action);
        if (params.userId) rows = rows.filter((l) => String(l.userId) === String(params.userId));
        return { items: rows.map(normalizeLog), meta: { page: 1, limit: rows.length, total: rows.length, totalPages: 1, hasNext: false, hasPrev: false } };
      });
    }
    const { data, meta } = await http.getRaw(endpoints.auditLogs.root, { params });
    const rows = Array.isArray(data) ? data : data?.items ?? [];
    return { items: rows.map(normalizeLog), meta };
  },
};

export default auditService;
