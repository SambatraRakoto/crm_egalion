'use strict';
// Test API (describe/it/expect/vi) is global — see vitest.config.mjs (globals:true).

// Patch pool.query BEFORE requiring the repo: order.repository destructures
// `query` from the pool module at load time, so it captures this stub (the same
// cached pool object). vi.mock does not intercept CommonJS requires here, and
// loading the pool never connects (the pg Pool connects lazily), so no DB is hit.
const pool = require('../database/pool');
const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: 'o1' }] });
pool.query = (...args) => queryMock(...args);

const orderRepo = require('./order.repository');

beforeEach(() => {
  queryMock.mockClear();
  queryMock.mockResolvedValue({ rows: [{ id: 'o1' }] });
});

describe('order.repository update() — delivered_at stamping', () => {
  it('uses an explicit deliveredAt with correct parameter indexing', async () => {
    const when = new Date('2026-06-20T10:00:00.000Z');
    await orderRepo.update('order-id', { deliveryStatus: 'delivered', deliveredAt: when });
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/delivery_status = \$1/);
    expect(sql).toMatch(/delivered_at = \$2/);
    expect(sql).toMatch(/WHERE id = \$3/);
    expect(params).toEqual(['delivered', when, 'order-id']);
  });

  it('falls back to COALESCE(delivered_at, now()) when no deliveredAt is given', async () => {
    await orderRepo.update('order-id', { deliveryStatus: 'delivered' });
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/delivered_at = COALESCE\(delivered_at, now\(\)\)/);
    expect(sql).toMatch(/WHERE id = \$2/);
    expect(params).toEqual(['delivered', 'order-id']);
  });

  it('coerces a string deliveredAt to a Date', async () => {
    await orderRepo.update('order-id', { deliveryStatus: 'delivered', deliveredAt: '2026-06-20T10:00:00.000Z' });
    const [, params] = queryMock.mock.calls[0];
    expect(params[1]).toBeInstanceOf(Date);
    expect(params[1].getTime()).toBe(new Date('2026-06-20T10:00:00.000Z').getTime());
  });

  it('does not stamp delivered_at for a non-delivered status', async () => {
    await orderRepo.update('order-id', { deliveryStatus: 'dispatched' });
    const [sql] = queryMock.mock.calls[0];
    // delivered_at appears in RETURNING (it's a column) — assert it is never ASSIGNED.
    expect(sql).not.toMatch(/delivered_at\s*=/);
  });
});
