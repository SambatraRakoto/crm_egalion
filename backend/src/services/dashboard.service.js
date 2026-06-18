'use strict';

const dashRepo = require('../repositories/dashboard.repository');
const { resolveDateRange } = require('../utils/dateRange');

// FR : Convertit une valeur en nombre fini (0 sinon).
// EN : Coerce a value to a finite number (0 otherwise).
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Format and enrich the raw KPI row with derived rates and margin. */
// FR : Enrichit les KPI bruts (taux et marge dérivés).
// EN : Enrich raw KPIs with derived rates/margin.
function formatKpis(raw) {
  const total = toNum(raw.total_orders);
  const delivered = toNum(raw.delivered_orders);
  const returned = toNum(raw.returned_orders);
  const cancelled = toNum(raw.cancelled_orders);
  const revenue = toNum(raw.revenue);
  const deliveryCost = toNum(raw.total_delivery_cost);
  const shaqCost = toNum(raw.total_shaq_cost);
  const logisticsCost = deliveryCost + shaqCost;

  return {
    totalOrders: total,
    deliveredOrders: delivered,
    pendingOrders: toNum(raw.pending_orders),
    returnedOrders: returned,
    cancelledOrders: cancelled,
    revenue: Number(revenue.toFixed(2)),
    avgOrderValue: Number(toNum(raw.avg_order_value).toFixed(2)),
    avgDeliveryDays: Number(toNum(raw.avg_delivery_days).toFixed(2)),
    totalDeliveryCost: Number(deliveryCost.toFixed(2)),
    totalShaqCost: Number(shaqCost.toFixed(2)),
    totalLogisticsCost: Number(logisticsCost.toFixed(2)),
    cancellationRate: total ? Number(((cancelled / total) * 100).toFixed(2)) : 0,
    returnRate: total ? Number(((returned / total) * 100).toFixed(2)) : 0,
    avgNetMargin: delivered ? Number(((revenue - logisticsCost) / delivered).toFixed(2)) : 0,
  };
}

// FR : KPI du tableau de bord pour une période.
// EN : Dashboard KPIs for a period.
async function kpis(query) {
  const { from, to } = resolveDateRange(query);
  const raw = await dashRepo.kpis(from, to);
  return formatKpis(raw);
}

// FR : Série de CA/commandes par granularité.
// EN : Revenue/orders series by granularity.
async function revenueSeries(query) {
  const { from, to } = resolveDateRange(query);
  const rows = await dashRepo.revenueSeries(from, to, query.granularity || 'day');
  return rows.map((r) => ({
    bucket: r.bucket,
    orders: toNum(r.orders),
    revenue: Number(toNum(r.revenue).toFixed(2)),
    totalAmount: Number(toNum(r.total_amount).toFixed(2)),
  }));
}

// FR : Répartition des commandes par statut.
// EN : Order distribution by status.
async function statusDistribution(query) {
  const { from, to } = resolveDateRange(query);
  return dashRepo.statusDistribution(from, to);
}

// FR : Volume de commandes par jour.
// EN : Daily order volume.
async function orderVolume(query) {
  // Volume = daily order counts (revenue series at day granularity).
  const { from, to } = resolveDateRange(query);
  const rows = await dashRepo.revenueSeries(from, to, 'day');
  return rows.map((r) => ({ bucket: r.bucket, orders: toNum(r.orders) }));
}

// FR : Entonnoir de livraison.
// EN : Delivery funnel.
async function deliveryFunnel(query) {
  const { from, to } = resolveDateRange(query);
  const f = await dashRepo.deliveryFunnel(from, to);
  return {
    received: toNum(f.received),
    collected: toNum(f.collected),
    inTransit: toNum(f.in_transit),
    delivered: toNum(f.delivered),
    returned: toNum(f.returned),
  };
}

// FR : Produits les plus vendus.
// EN : Top-selling products.
async function topProducts(query) {
  const { from, to } = resolveDateRange(query);
  return dashRepo.topProducts(from, to, Number(query.limit) || 10);
}

// FR : Régions les plus actives.
// EN : Top regions.
async function topRegions(query) {
  const { from, to } = resolveDateRange(query);
  return dashRepo.topRegions(from, to, Number(query.limit) || 10);
}

// FR : Taux d'annulation par région.
// EN : Cancellation rate per region.
async function cancellationByRegion(query) {
  const { from, to } = resolveDateRange(query);
  return dashRepo.cancellationByRegion(from, to);
}

/** One-shot overview combining the most-used widgets. */
// FR : Vue d'ensemble combinant les widgets principaux.
// EN : Overview combining the main widgets.
async function overview(query) {
  const { from, to } = resolveDateRange(query);
  const [k, dist, funnel, products, regions] = await Promise.all([
    dashRepo.kpis(from, to),
    dashRepo.statusDistribution(from, to),
    dashRepo.deliveryFunnel(from, to),
    dashRepo.topProducts(from, to, 5),
    dashRepo.topRegions(from, to, 5),
  ]);
  return {
    kpis: formatKpis(k),
    statusDistribution: dist,
    deliveryFunnel: {
      received: toNum(funnel.received),
      collected: toNum(funnel.collected),
      inTransit: toNum(funnel.in_transit),
      delivered: toNum(funnel.delivered),
      returned: toNum(funnel.returned),
    },
    topProducts: products,
    topRegions: regions,
  };
}

module.exports = {
  kpis,
  revenueSeries,
  statusDistribution,
  orderVolume,
  deliveryFunnel,
  topProducts,
  topRegions,
  cancellationByRegion,
  overview,
};
