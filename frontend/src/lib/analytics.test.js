import { describe, it, expect } from 'vitest';
import { kpis, topRegions, regionRevenue } from '@/lib/analytics';

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

describe('kpis() — AOV & Basket Size: leads vs delivered perimeters', () => {
  // Money is aggregated in native GHS; delivered orders carry a GHS delivery cost
  // so the handling fee can be checked on (revenue − delivery).
  const orders = [
    mkOrder({ status: 'Delivered', amountGHS: 300, deliveryCostGHS: 50, items: [{ name: 'A', quantity: 1 }, { name: 'B', quantity: 1 }] }),
    mkOrder({ status: 'Delivered', amountGHS: 200, deliveryCostGHS: 50, items: [{ name: 'A', quantity: 1 }] }),
    mkOrder({ status: 'Pending', amountGHS: 100, items: [{ name: 'A', quantity: 1 }] }),
  ];
  const k = kpis(orders);

  it('AOV (all leads) = total GHS / all orders', () => {
    expect(k.avgOrderValue.ghs).toBe(200); // 600 / 3
  });
  it('AOV (delivered) = delivered GHS / delivered orders', () => {
    expect(k.avgOrderValueDelivered.ghs).toBe(250); // 500 / 2
  });
  it('Basket size (all leads) = all units / all orders', () => {
    expect(k.basketSize).toBe(1.33); // 4 / 3
  });
  it('Basket size (delivered) = delivered units / delivered orders', () => {
    expect(k.basketSizeDelivered).toBe(1.5); // 3 / 2
  });
  it('ShaQ handling fee = 5% of (delivered revenue − delivery fee), native GHS', () => {
    // delivered GHS = 300 + 200 = 500; delivered delivery fee = 50 + 50 = 100.
    // base = 500 − 100 = 400 -> 5% = 20 GHS (5% of full revenue would be 25).
    expect(k.commissionShaq.ghs).toBe(20);
  });
  it('Delivered Revenue = sum of delivered native GHS', () => {
    expect(k.deliveredRevenue.ghs).toBe(500); // 300 + 200
  });
});

describe('topRegions — deterministic ranking (C.11)', () => {
  it('sorts by order count desc, breaks ties by name, groups empty as "Inconnu"', () => {
    const orders = [
      { region: 'Ashanti' }, { region: 'Ashanti' }, // 2
      { region: '' }, { region: null },             // 2 -> Inconnu
      { region: 'Volta' },                          // 1
      { region: 'Bono' },                           // 1
    ];
    expect(topRegions(orders)).toEqual([
      ['Ashanti', 2], ['Inconnu', 2], // tie at 2 -> name A→I
      ['Bono', 1], ['Volta', 1],      // tie at 1 -> name B→V
    ]);
  });

  it('respects the limit', () => {
    const orders = [{ region: 'A' }, { region: 'B' }, { region: 'C' }];
    expect(topRegions(orders, 2)).toHaveLength(2);
  });
});

describe('regionRevenue — sorted by revenue, not order count (C.12)', () => {
  // Revenue is summed from native GHS (Shopify base currency); USD stays derived.
  const orders = [
    { region: 'A', amountUSD: 10, amountGHS: 100 },                                  // 1 order, rev 100
    { region: 'B', amountUSD: 4, amountGHS: 40 }, { region: 'B', amountUSD: 4, amountGHS: 40 }, // 2 orders, rev 80
    { region: 'Zeta', amountUSD: 5, amountGHS: 50 }, { region: 'Alpha', amountUSD: 5, amountGHS: 50 }, // tie rev 50
    { region: '', amountUSD: 3, amountGHS: 30 },                                     // Inconnu
  ];
  const res = regionRevenue(orders);

  it('ranks higher-revenue region above a region with more orders', () => {
    expect(res[0]).toEqual({ region: 'A', orders: 1, revenueUSD: 10, revenueGHS: 100 });
    expect(res[1]).toEqual({ region: 'B', orders: 2, revenueUSD: 8, revenueGHS: 80 });
  });
  it('breaks revenue ties by name (Alpha before Zeta)', () => {
    const names = res.map((r) => r.region);
    expect(names.indexOf('Alpha')).toBeLessThan(names.indexOf('Zeta'));
  });
  it('groups empty region as "Inconnu"', () => {
    expect(res.some((r) => r.region === 'Inconnu')).toBe(true);
  });
});
