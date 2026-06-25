import { describe, it, expect } from 'vitest';
import { kpis } from '@/lib/analytics';

// Minimal valid order; override only what each case needs. status 'Delivered'
// is the single value in DELIVERED_LABELS, so these count as delivered.
const mkOrder = (overrides = {}) => ({
  amountUSD: 100,
  deliveryCostUSD: 5,
  status: 'Delivered',
  category: '',
  ...overrides,
});

const avg = (orders) => kpis(orders).avgDeliveryTime;

describe('kpis().avgDeliveryTime — real delivery lead time', () => {
  it('keeps hour precision from raw timestamps (2.5 days, not rounded to 2 or 3)', () => {
    const orders = [
      mkOrder({
        orderedAtRaw: '2026-06-01T00:00:00.000Z',
        deliveredAtRaw: '2026-06-03T12:00:00.000Z',
      }),
    ];
    expect(avg(orders)).toBe(2.5);
  });

  it('averages several valid orders', () => {
    const orders = [
      mkOrder({ orderedAtRaw: '2026-06-01T00:00:00.000Z', deliveredAtRaw: '2026-06-03T00:00:00.000Z' }), // 2d
      mkOrder({ orderedAtRaw: '2026-06-01T00:00:00.000Z', deliveredAtRaw: '2026-06-05T00:00:00.000Z' }), // 4d
    ];
    expect(avg(orders)).toBe(3); // (2 + 4) / 2
  });

  it('excludes delivered orders that have no real delivery timestamp (no more updatedAt fallback)', () => {
    const orders = [
      mkOrder({ orderedAtRaw: '2026-06-01T00:00:00.000Z', deliveredAtRaw: '2026-06-03T00:00:00.000Z' }), // 2d, counted
      mkOrder({ orderedAtRaw: '2026-06-01T00:00:00.000Z', deliveredAtRaw: null, deliveredAt: '' }),       // excluded
    ];
    expect(avg(orders)).toBe(2); // denominator is 1, not 2
  });

  it('excludes negative lead times (delivered before ordered) instead of clamping to 0', () => {
    const orders = [
      mkOrder({ orderedAtRaw: '2026-06-05T00:00:00.000Z', deliveredAtRaw: '2026-06-01T00:00:00.000Z' }), // -4d, excluded
    ];
    expect(avg(orders)).toBe(0); // no valid sample
  });

  it('ignores non-delivered orders', () => {
    const orders = [
      mkOrder({ status: 'In Transit', orderedAtRaw: '2026-06-01T00:00:00.000Z', deliveredAtRaw: '2026-06-10T00:00:00.000Z' }),
    ];
    expect(avg(orders)).toBe(0);
  });

  it('falls back to date-only fields when raw timestamps are absent (mock-data safety)', () => {
    const orders = [
      mkOrder({ date: '2026-06-01', deliveredAt: '2026-06-05' }), // 4 whole days
    ];
    expect(avg(orders)).toBe(4);
  });

  it('returns 0 for an empty order set', () => {
    expect(avg([])).toBe(0);
  });
});
