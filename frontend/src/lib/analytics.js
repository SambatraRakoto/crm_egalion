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
  // Revenue (CA) is summed from the NATIVE GHS amounts (order_amount = Shopify
  // total_price), so the displayed GHS total matches Shopify exactly. Summing the
  // per-order USD values (each rounded to 2 decimals) and converting back to GHS
  // introduced a cumulative rounding drift — that round-trip is avoided here.
  // USD stays derived from the per-order USD values (USD is a secondary display;
  // the shop currency is GHS). All placed orders are counted (parity with Shopify
  // total sales): ShaQ delivery returns/cancellations are NOT Shopify refunds.
  const revenueGhs = orders.reduce((s, o) => s + (o.amountGHS ?? 0), 0);
  const revenueUsd = orders.reduce((s, o) => s + o.amountUSD, 0);
  const logisticsUsd = orders.reduce((s, o) => s + o.deliveryCostUSD, 0);
  // Commission ShaQ = 5% of order amount (dynamic, never read from the dead
  // shaq_cost column). Total ShaQ fees = delivery fee + commission.
  const commissionUsd = round2(revenueUsd * 0.05);
  const shaqFeesUsd = round2(logisticsUsd + commissionUsd);
  const deliveredOrders = orders.filter((o) => DELIVERED.includes(o.status));
  const delivered = deliveredOrders.length;
  const returned = orders.filter((o) => o.category === CATEGORY.RETURNS).length;
  const issues = orders.filter((o) => o.category === CATEGORY.ISSUES_EXCEPTIONS).length;

  // Real lead time: only delivered orders that have BOTH a real delivery
  // timestamp and an order timestamp. Full-precision (hours kept), negative
  // anomalies excluded rather than clamped to 0.
  const leadTimes = orders
    .filter((o) => DELIVERED.includes(o.status) && (o.deliveredAtRaw || o.deliveredAt) && (o.orderedAtRaw || o.date))
    .map((o) => (new Date(o.deliveredAtRaw || o.deliveredAt) - new Date(o.orderedAtRaw || o.date)) / 86400000)
    .filter((d) => d >= 0);
  const avgDeliveryDays = leadTimes.length
    ? round2(leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length)
    : 0;

  // Units per order across ALL line items (multi-product orders fully counted;
  // falls back to totalQuantity/quantity for rows without itemized lines).
  const unitsOf = (o) => (Array.isArray(o.items) && o.items.length
    ? o.items.reduce((q, it) => q + (Number(it.quantity) || 0), 0)
    : (Number(o.totalQuantity ?? o.quantity) || 0));
  const totalUnits = orders.reduce((s, o) => s + unitsOf(o), 0);

  // Delivered-only perimeter (real fulfilled orders). Shown alongside the
  // all-leads figures so each KPI states its population explicitly. The leads
  // (all orders) figures stay primary — they match Shopify "Total sales" AOV.
  const dCount = deliveredOrders.length;
  const dRevenueGhs = deliveredOrders.reduce((s, o) => s + (o.amountGHS ?? 0), 0);
  const dRevenueUsd = deliveredOrders.reduce((s, o) => s + o.amountUSD, 0);
  const dUnits = deliveredOrders.reduce((s, o) => s + unitsOf(o), 0);

  return {
    totalOrders: count,
    revenue: { usd: round2(revenueUsd), ghs: round2(revenueGhs) },
    totalLogistics: { usd: round2(logisticsUsd), ghs: ghs(logisticsUsd) },
    commissionShaq: { usd: commissionUsd, ghs: ghs(commissionUsd) },
    totalShaq: { usd: shaqFeesUsd, ghs: ghs(shaqFeesUsd) },
    // Avg. order value (panier moyen): GHS from the NATIVE GHS revenue ÷ count
    // (= Revenue GHS ÷ orders, parity with Shopify AOV), not the USD round-trip.
    avgOrderValue: count
      ? { usd: round2(revenueUsd / count), ghs: round2(revenueGhs / count) }
      : { usd: 0, ghs: 0 },
    avgDeliveryTime: avgDeliveryDays,
    basketSize: count ? round2(totalUnits / count) : 0,
    // Delivered-only perimeter (explicit population). Leads figures above stay
    // primary (Shopify parity); these describe real fulfilled orders.
    deliveredOrders: dCount,
    avgOrderValueDelivered: dCount
      ? { usd: round2(dRevenueUsd / dCount), ghs: round2(dRevenueGhs / dCount) }
      : { usd: 0, ghs: 0 },
    basketSizeDelivered: dCount ? round2(dUnits / dCount) : 0,
    deliveryRate: count ? ((delivered / count) * 100).toFixed(1) : '0.0',
    returnRate: count ? ((returned / count) * 100).toFixed(1) : '0.0',
    cancellationRate: count ? ((issues / count) * 100).toFixed(1) : '0.0',
    netMargin: revenueUsd ? (((revenueUsd - shaqFeesUsd) / revenueUsd) * 100).toFixed(1) : '0.0',
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

// FR : Produits les plus commandés (top N) — compte chaque produit présent dans
// la commande (multi-produits inclus), pas seulement le premier article.
// EN : Best-selling products (top N) — counts every product in the order
// (multi-product orders included), not just the first line item.
export function bestSellingProducts(orders, limit = 8) {
  const map = {};
  orders.forEach((o) => {
    // Distinct product names in the order: count one "order volume" per product.
    const names = Array.isArray(o.items) && o.items.length
      ? [...new Set(o.items.map((it) => it.name).filter(Boolean))]
      : (o.product ? [o.product] : []);
    names.forEach((n) => { map[n] = (map[n] || 0) + 1; });
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

// FR : Taux de livraison (%) par produit — part des commandes contenant le
// produit qui sont livrées. Trié par volume (produits les plus présents).
// EN : Delivery rate (%) per product — share of orders containing the product
// that are delivered. Sorted by volume (most-present products first).
export function deliveryRateByProduct(orders, limit = 8) {
  const map = {};
  orders.forEach((o) => {
    const names = Array.isArray(o.items) && o.items.length
      ? [...new Set(o.items.map((it) => it.name).filter(Boolean))]
      : (o.product ? [o.product] : []);
    const isDelivered = DELIVERED.includes(o.status);
    names.forEach((n) => {
      if (!map[n]) map[n] = { total: 0, delivered: 0 };
      map[n].total += 1;
      if (isDelivered) map[n].delivered += 1;
    });
  });
  return Object.entries(map)
    .map(([product, v]) => ({
      product,
      total: v.total,
      delivered: v.delivered,
      rate: round2((v.delivered / v.total) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
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
export function filterByPeriod(orders, period, custom) {
  if (!period || period === 'all' || period === 'All Time') return orders;
  // Custom [from, to] range (YYYY-MM-DD strings, inclusive, timezone-safe).
  if (period === 'custom' || period === 'Custom') {
    const from = custom && custom.from;
    const to = custom && custom.to;
    if (!from || !to) return orders;
    return orders.filter((o) => {
      const d = String(o.date).slice(0, 10);
      return d >= from && d <= to;
    });
  }
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
