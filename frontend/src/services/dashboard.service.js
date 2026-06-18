/**
 * Dashboard analytics service.
 *
 * Computes the full dashboard bundle from the order dataset using the shared
 * pure aggregations in `lib/analytics`. Because it sources orders through
 * `ordersService.getAll()`, it works identically in mock mode and against the
 * live `/orders` API. (A dedicated `/dashboard/*` path exists on the backend and
 * can be wired here later for efficiency — see endpoints.dashboard.)
 */
import { ordersService } from '@/services/orders.service';
import * as analytics from '@/lib/analytics';
import { config } from '@/config/env';

/**
 * FR : Construit le bundle du tableau de bord, filtré par période et par statut.
 * EN : Build the dashboard bundle, filtered by period and by delivery status.
 * @param {{ period?: string, status?: string }} [opts]
 * @returns {Promise<object>} bundle consumed by the Dashboard page
 */
export async function getDashboardData({ period = 'all', status = 'all' } = {}) {
  const orders = await ordersService.getAll();
  let active = orders.filter((o) => !o.archived);
  // FR : Filtre par statut de livraison (libellé affiché). EN : Filter by delivery status (display label).
  if (status && status !== 'all') active = active.filter((o) => o.status === status);
  const periodOrders = analytics.filterByPeriod(active, period);

  return {
    period,
    status,
    usdToGhs: config.usdToGhs,
    totalOrdersInPeriod: periodOrders.length,
    kpis: analytics.kpis(periodOrders),
    // Trend/series use the full history regardless of the KPI period.
    ordersByMonth: analytics.ordersByMonth(active),
    ordersByWeek: analytics.ordersByWeek(active),
    ordersByDate: analytics.ordersByDate(active),
    revenueByMonth: analytics.revenueByMonth(active),
    bestSellingProducts: analytics.bestSellingProducts(active),
    topRegions: analytics.topRegions(active),
    regionRevenue: analytics.regionRevenue(active),
    statusDistribution: analytics.statusDistribution(active),
    deliveryFunnel: analytics.deliveryFunnel(active),
    cancellationByRegion: analytics.cancellationByRegion(active),
  };
}

export const dashboardService = { getDashboardData };
export default dashboardService;
