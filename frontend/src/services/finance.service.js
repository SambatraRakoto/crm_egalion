/**
 * Finance service.
 *
 * Mock mode derives everything from the order dataset via the shared pure
 * aggregations. Real mode keeps the monthly series client-side (from /orders)
 * but takes the authoritative ShaQ economics (frais de livraison, commission
 * ShaQ, coût fournisseur, marge nette) from the backend `/finance/summary`,
 * which has the per-item supplier costs the order payload doesn't carry.
 */
import { ordersService } from '@/services/orders.service';
import { http } from '@/api/httpClient';
import { endpoints } from '@/api/endpoints';
import * as analytics from '@/lib/analytics';
import { config } from '@/config/env';

// Backend finance figures are in GHS (base currency); USD is derived.
const money = (x) => ({ ghs: Number(x || 0), usd: Number((Number(x || 0) / config.usdToGhs).toFixed(2)) });

/**
 * @param {{ period?: string, from?: string, to?: string }} [params]
 * @returns {Promise<import('@/types').FinanceData>}
 */
export async function getFinanceData(params = {}) {
  const { period = 'all', from, to } = params;
  const all = (await ordersService.getAll()).filter((o) => !o.archived);

  // Scope to the selected period so amounts are exact for that period.
  let orders = analytics.filterByPeriod(all, period);
  if (period === 'custom' && (from || to)) {
    orders = all.filter((o) => (!from || o.date >= from) && (!to || o.date <= to));
  }

  const base = {
    period,
    ...analytics.financeSummary(orders),
    byMonth: analytics.financialByMonth(orders),
    usdToGhs: config.usdToGhs,
  };

  if (config.useMock) return base;

  // Real mode: take the authoritative, period-scoped settled figures from the
  // backend (it has per-item supplier costs and applies the same date range).
  try {
    const s = await http.get(endpoints.finance.summary, { params: { period, from, to } });
    return {
      ...base,
      deliveredOrders: s.deliveredOrders ?? base.deliveredOrders,
      collected: money(s.collected),
      outstanding: money(s.outstanding),
      cod: money(s.codCollected),
      fraisLivraison: money(s.fraisLivraison),
      commissionShaq: money(s.commissionShaq),
      coutFournisseur: money(s.coutFournisseur),
      margeNette: money(s.margeNette),
      margeNettePct: s.margeNettePct ?? base.margeNettePct,
    };
  } catch {
    // If the finance endpoint is unavailable, fall back to client-side estimates.
    return base;
  }
}

export const financeService = { getFinanceData };
export default financeService;
