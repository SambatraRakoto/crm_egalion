/**
 * Pure analytics aggregations.
 *
 * Every function takes an `orders` array (UI `Order` shape) and returns
 * chart/table-ready data. Because they are pure, the dashboard/finance services
 * can feed them either the mock dataset or orders fetched from the live API —
 * the computation is identical.
 */
import { config } from '@/config/env';
import {
  CATEGORY, DELIVERED_LABELS, IN_TRANSIT_LABELS, UNASSIGNED_LABELS,
} from '@/lib/orderStatus';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DELIVERED = DELIVERED_LABELS;

const round2 = (n) => parseFloat(n.toFixed(2));
const ghs = (usd) => round2(usd * config.usdToGhs);
const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return `${MONTHS[+m - 1]} ${y.slice(2)}`;
};

// FR : Calcule les indicateurs clés (CA, livraison, marge, taux) pour un jeu de commandes.
// EN : Compute the key KPIs (revenue, logistics, margin, rates) for a set of orders.
export function kpis(orders) {
  const count = orders.length;
  const revenueUsd = orders.reduce((s, o) => s + o.amountUSD, 0);
  const logisticsUsd = orders.reduce((s, o) => s + o.deliveryCostUSD, 0);
  const shaqUsd = orders.reduce((s, o) => s + o.shaqCostUSD, 0);
  const delivered = orders.filter((o) => DELIVERED.includes(o.status)).length;
  const returned = orders.filter((o) => o.category === CATEGORY.RETURNS).length;
  const issues = orders.filter((o) => o.category === CATEGORY.ISSUES_EXCEPTIONS).length;

  const deliveredOrders = orders.filter((o) => DELIVERED.includes(o.status));
  const avgDeliveryDays = deliveredOrders.length
    ? round2(
        deliveredOrders.reduce(
          (s, o) => s + Math.max(0, (new Date(o.updatedAt) - new Date(o.date)) / 86400000),
          0,
        ) / deliveredOrders.length,
      )
    : 0;

  return {
    totalOrders: count,
    revenue: { usd: round2(revenueUsd), ghs: ghs(revenueUsd) },
    totalLogistics: { usd: round2(logisticsUsd), ghs: ghs(logisticsUsd) },
    totalShaq: { usd: round2(shaqUsd), ghs: ghs(shaqUsd) },
    avgOrderValue: count
      ? { usd: round2(revenueUsd / count), ghs: ghs(revenueUsd / count) }
      : { usd: 0, ghs: 0 },
    avgDeliveryTime: avgDeliveryDays,
    basketSize: 1.8,
    deliveryRate: count ? ((delivered / count) * 100).toFixed(1) : '0.0',
    returnRate: count ? ((returned / count) * 100).toFixed(1) : '0.0',
    cancellationRate: count ? ((issues / count) * 100).toFixed(1) : '0.0',
    netMargin: revenueUsd ? (((revenueUsd - shaqUsd) / revenueUsd) * 100).toFixed(1) : '0.0',
  };
}

// FR : Compte les commandes par clé (regroupement générique). EN : Count orders per key (generic grouping).
function bucketCount(orders, keyFn) {
  const map = {};
  orders.forEach((o) => {
    const k = keyFn(o);
    map[k] = (map[k] || 0) + 1;
  });
  return map;
}

// FR : Série du nombre de commandes par mois. EN : Series of order counts per month.
export function ordersByMonth(orders) {
  const map = bucketCount(orders, (o) => o.date.slice(0, 7));
  const sorted = Object.keys(map).sort();
  return { labels: sorted.map(monthLabel), data: sorted.map((k) => map[k]) };
}

// FR : Série du nombre de commandes par semaine (20 dernières). EN : Order counts per week (last 20).
export function ordersByWeek(orders) {
  const map = bucketCount(orders, (o) => {
    const d = new Date(o.date);
    const soY = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - soY) / 86400000 + soY.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  });
  const sorted = Object.keys(map).sort().slice(-20);
  return { labels: sorted, data: sorted.map((k) => map[k]) };
}

// FR : Série du nombre de commandes par jour (30 derniers). EN : Order counts per day (last 30).
export function ordersByDate(orders) {
  const map = bucketCount(orders, (o) => o.date);
  const sorted = Object.keys(map).sort().slice(-30);
  return { labels: sorted.map((d) => d.slice(5)), data: sorted.map((k) => map[k]) };
}

// FR : CA mensuel en USD et GHS. EN : Monthly revenue in USD and GHS.
export function revenueByMonth(orders) {
  const map = {};
  orders.forEach((o) => {
    const k = o.date.slice(0, 7);
    map[k] = (map[k] || 0) + o.amountUSD;
  });
  const sorted = Object.keys(map).sort();
  return {
    labels: sorted.map(monthLabel),
    dataUSD: sorted.map((k) => round2(map[k])),
    dataGHS: sorted.map((k) => ghs(map[k])),
  };
}

// FR : Produits les plus commandés (top N). EN : Best-selling products (top N).
export function bestSellingProducts(orders, limit = 8) {
  const map = bucketCount(orders, (o) => o.product);
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

// FR : Régions avec le plus de commandes (top N). EN : Regions with the most orders (top N).
export function topRegions(orders, limit = 8) {
  const map = bucketCount(orders, (o) => o.region);
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

// FR : Commandes et CA par région (top N). EN : Orders and revenue per region (top N).
export function regionRevenue(orders, limit = 10) {
  const map = {};
  orders.forEach((o) => {
    if (!map[o.region]) map[o.region] = { orders: 0, revenueUSD: 0 };
    map[o.region].orders++;
    map[o.region].revenueUSD += o.amountUSD;
  });
  return Object.entries(map)
    .map(([region, v]) => ({ region, orders: v.orders, revenueUSD: round2(v.revenueUSD) }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, limit);
}

// FR : Répartition des commandes par catégorie de statut (avec %). EN : Order distribution by status category (with %).
export function statusDistribution(orders) {
  const map = bucketCount(orders, (o) => o.category);
  const total = orders.length || 1;
  return Object.entries(map).map(([label, count]) => ({
    label,
    count,
    pct: ((count / total) * 100).toFixed(1),
  }));
}

// FR : Entonnoir de livraison (reçu → collecté → transit → livré → retourné). EN : Delivery funnel (received → collected → transit → delivered → returned).
export function deliveryFunnel(orders) {
  const received = orders.length;
  const assigned = orders.filter((o) => !UNASSIGNED_LABELS.includes(o.status)).length;
  const inTransit = orders.filter((o) => IN_TRANSIT_LABELS.includes(o.status)).length;
  const delivered = orders.filter((o) => DELIVERED.includes(o.status)).length;
  const returned = orders.filter((o) => o.category === CATEGORY.RETURNS).length;
  return [
    { label: 'Orders Received', value: received, color: 'bg-indigo-500' },
    { label: 'Orders Assigned', value: assigned, color: 'bg-blue-500' },
    { label: 'In Transit', value: inTransit, color: 'bg-violet-500' },
    { label: 'Delivered', value: delivered, color: 'bg-emerald-500' },
    { label: 'Returned', value: returned, color: 'bg-rose-500' },
  ];
}

// FR : Taux d'annulation/incidents par région. EN : Cancellation/issue rate per region.
export function cancellationByRegion(orders, limit = 10) {
  const map = {};
  orders.forEach((o) => {
    if (!map[o.region]) map[o.region] = { total: 0, cancelled: 0 };
    map[o.region].total++;
    if (o.category === CATEGORY.ISSUES_EXCEPTIONS) map[o.region].cancelled++;
  });
  return Object.entries(map)
    .map(([region, v]) => ({
      region,
      rate: round2((v.cancelled / v.total) * 100),
      total: v.total,
      cancelled: v.cancelled,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, limit);
}

// ─── Finance ────────────────────────────────────────────────────────────────
// FR : Tableau financier mensuel (CA, encaissé, restant, logistique). EN : Monthly financial table (revenue, collected, outstanding, logistics).
export function financialByMonth(orders) {
  const rev = {};
  const ord = {};
  const log = {};
  orders.forEach((o) => {
    const k = o.date.slice(0, 7);
    rev[k] = (rev[k] || 0) + o.amountUSD;
    ord[k] = (ord[k] || 0) + 1;
    log[k] = (log[k] || 0) + o.deliveryCostUSD;
  });
  return Object.keys(rev)
    .sort()
    .map((k) => {
      const revUsd = rev[k];
      const collected = orders
        .filter((o) => o.date.slice(0, 7) === k && DELIVERED.includes(o.status))
        .reduce((s, o) => s + o.amountUSD, 0);
      const outstanding = Math.max(0, revUsd - collected);
      return {
        month: monthLabel(k),
        revenueUSD: round2(revUsd),
        revenueGHS: ghs(revUsd),
        collectedUSD: round2(collected),
        collectedGHS: ghs(collected),
        outstandingUSD: round2(outstanding),
        outstandingGHS: ghs(outstanding),
        logisticsUSD: round2(log[k]),
        logisticsGHS: ghs(log[k]),
        orders: ord[k],
        avgUSD: round2(revUsd / ord[k]),
        avgGHS: ghs(revUsd / ord[k]),
      };
    });
}

// FR : Synthèse financière (encaissé, restant, COD, commission, marge nette). EN : Financial summary (collected, outstanding, COD, commission, net margin).
export function financeSummary(orders) {
  const revenueUsd = orders.reduce((s, o) => s + o.amountUSD, 0);
  const collectedUsd = orders
    .filter((o) => DELIVERED.includes(o.status))
    .reduce((s, o) => s + o.amountUSD, 0);
  const outstandingUsd = Math.max(0, revenueUsd - collectedUsd);
  const deliveredOrders = orders.filter((o) => DELIVERED.includes(o.status));
  const codUsd = deliveredOrders
    .slice(0, Math.floor(deliveredOrders.length * 0.7))
    .reduce((s, o) => s + o.amountUSD, 0);
  const count = orders.length || 1;

  // ShaQ economics on delivered orders (commission & delivery fee kept separate).
  // frais_livraison = stored delivery cost; commission_shaq = 5% × price.
  // Supplier cost isn't on the order payload here (mock), so we use a 40% COGS
  // proxy; in real mode finance.service overrides these with backend values.
  const fraisLivraisonUsd = deliveredOrders.reduce((s, o) => s + (o.deliveryCostUSD || 0), 0);
  const commissionUsd = collectedUsd * 0.05;
  const supplierUsd = deliveredOrders.reduce((s, o) => s + o.amountUSD * 0.4, 0);
  const margeNetteUsd = collectedUsd - fraisLivraisonUsd - commissionUsd - supplierUsd;

  return {
    deliveredOrders: deliveredOrders.length,
    totalRevenue: { usd: round2(revenueUsd), ghs: ghs(revenueUsd) },
    avgOrderValue: { usd: round2(revenueUsd / count), ghs: ghs(revenueUsd / count) },
    collected: { usd: round2(collectedUsd), ghs: ghs(collectedUsd) },
    outstanding: { usd: round2(outstandingUsd), ghs: ghs(outstandingUsd) },
    cod: { usd: round2(codUsd), ghs: ghs(codUsd) },
    fraisLivraison: { usd: round2(fraisLivraisonUsd), ghs: ghs(fraisLivraisonUsd) },
    commissionShaq: { usd: round2(commissionUsd), ghs: ghs(commissionUsd) },
    coutFournisseur: { usd: round2(supplierUsd), ghs: ghs(supplierUsd) },
    margeNette: { usd: round2(margeNetteUsd), ghs: ghs(margeNetteUsd) },
    margeNettePct: collectedUsd > 0 ? round2((margeNetteUsd / collectedUsd) * 100) : 0,
    returnRate: ((orders.filter((o) => o.category === CATEGORY.RETURNS).length / count) * 100).toFixed(1),
    deliveryRate: ((deliveredOrders.length / count) * 100).toFixed(1),
  };
}

/** Filter orders by a dashboard period preset. */
// FR : Filtre les commandes par période (today|yesterday|week|month|year|all). EN : Filter orders by a period (today|yesterday|week|month|year|all).
export function filterByPeriod(orders, period) {
  if (!period || period === 'all' || period === 'All Time') return orders;
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let from = startOfDay(now);
  let to = null; // exclusive upper bound; null = up to now

  switch (period) {
    case 'today': case 'Today':
      from = startOfDay(now);
      break;
    case 'yesterday': case 'Yesterday': {
      const y = new Date(now); y.setDate(now.getDate() - 1);
      from = startOfDay(y);
      to = startOfDay(now); // strictly before today
      break;
    }
    case 'week': case 'This Week': {
      const since = (now.getDay() + 6) % 7; // days since Monday (ISO week)
      from = startOfDay(now); from.setDate(now.getDate() - since);
      break;
    }
    case 'month': case 'This Month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year': case 'This Year':
      from = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return orders;
  }

  return orders.filter((o) => {
    const d = new Date(o.date);
    if (Number.isNaN(d.getTime())) return false;
    if (d < from) return false;
    if (to && d >= to) return false;
    return true;
  });
}
