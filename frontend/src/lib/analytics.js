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
  CATEGORY, DELIVERED_LABELS, IN_TRANSIT_LABELS, COLLECTED_LABELS,
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
  // GHS is the SHOP'S BASE CURRENCY (order_amount = Shopify total_price stored in
  // GHS). Every money KPI is therefore aggregated in NATIVE GHS — the exact value,
  // identical to Shopify to the cent, with NO exchange-rate involved. The 15.4
  // USD↔GHS rate is a fixed reference used ONLY to derive a secondary USD display,
  // applied ONCE on each final GHS total (`toUsd` below) so it never accumulates
  // per-order rounding drift. All placed orders are counted (parity with Shopify
  // total sales): ShaQ delivery returns/cancellations are NOT Shopify refunds.
  const toUsd = (g) => round2(g / config.usdToGhs);
  const revenueGhs = orders.reduce((s, o) => s + (o.amountGHS ?? 0), 0);
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
  const dUnits = deliveredOrders.reduce((s, o) => s + unitsOf(o), 0);

  // ShaQ economics on DELIVERED orders only (no delivery fee is incurred on
  // undelivered leads), so the logistics KPI, the handling fee and the net margin
  // all share one perimeter. Everything is computed in NATIVE GHS (exact).
  const dLogisticsGhs = deliveredOrders.reduce((s, o) => s + (o.deliveryCostGHS ?? 0), 0);
  // Handling fee (commission ShaQ) = 5% of (revenue − delivery fee), NOT 5% of the
  // full revenue: the delivery fee is removed FIRST, then 5% on the remainder.
  const handlingBaseGhs = Math.max(0, dRevenueGhs - dLogisticsGhs);
  const commissionGhs = round2(handlingBaseGhs * 0.05);
  // Total ShaQ take = delivery fee + handling fee. Net margin = revenue − that total.
  const shaqFeesGhs = round2(dLogisticsGhs + commissionGhs);

  return {
    totalOrders: count,
    revenue: { ghs: round2(revenueGhs), usd: toUsd(revenueGhs) },
    // Logistics cost on DELIVERED orders only (coherent with commission & margin).
    totalLogistics: { ghs: round2(dLogisticsGhs), usd: toUsd(dLogisticsGhs) },
    commissionShaq: { ghs: commissionGhs, usd: toUsd(commissionGhs) },
    totalShaq: { ghs: shaqFeesGhs, usd: toUsd(shaqFeesGhs) },
    // Avg. order value (panier moyen): native GHS revenue ÷ count (= Revenue GHS ÷
    // orders, parity with Shopify AOV); USD derived once from that exact GHS.
    avgOrderValue: count
      ? { ghs: round2(revenueGhs / count), usd: toUsd(revenueGhs / count) }
      : { usd: 0, ghs: 0 },
    avgDeliveryTime: avgDeliveryDays,
    basketSize: count ? round2(totalUnits / count) : 0,
    // Delivered-only perimeter (explicit population). Leads figures above stay
    // primary (Shopify parity); these describe real fulfilled orders.
    deliveredOrders: dCount,
    deliveredRevenue: { ghs: round2(dRevenueGhs), usd: toUsd(dRevenueGhs) },
    avgOrderValueDelivered: dCount
      ? { ghs: round2(dRevenueGhs / dCount), usd: toUsd(dRevenueGhs / dCount) }
      : { usd: 0, ghs: 0 },
    basketSizeDelivered: dCount ? round2(dUnits / dCount) : 0,
    deliveryRate: count ? ((delivered / count) * 100).toFixed(1) : '0.0',
    returnRate: count ? ((returned / count) * 100).toFixed(1) : '0.0',
    cancellationRate: count ? ((issues / count) * 100).toFixed(1) : '0.0',
    // Net margin % is a ratio (rate-independent) — computed on exact native GHS.
    netMargin: dRevenueGhs ? (((dRevenueGhs - shaqFeesGhs) / dRevenueGhs) * 100).toFixed(1) : '0.0',
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
  return Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

// FR : Commandes LIVRÉES par produit (top N) — ne compte que les commandes dont
// le statut est « Delivered ». Même forme de sortie que bestSellingProducts
// ([nom, nb]) pour réutiliser le même graphique. Tri par nb livrées puis nom.
// EN : DELIVERED orders per product (top N) — counts only orders whose status is
// "Delivered". Same output shape as bestSellingProducts ([name, count]) so the
// chart is reused as-is. Sorted by delivered count then name (deterministic).
export function deliveredByProduct(orders, limit = 8) {
  const map = {};
  orders.forEach((o) => {
    if (!DELIVERED.includes(o.status)) return;
    const names = Array.isArray(o.items) && o.items.length
      ? [...new Set(o.items.map((it) => it.name).filter(Boolean))]
      : (o.product ? [o.product] : []);
    names.forEach((n) => { map[n] = (map[n] || 0) + 1; });
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
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
    .sort((a, b) => b.total - a.total || a.product.localeCompare(b.product))
    .slice(0, limit);
}

// FR : Régions avec le plus de commandes (top N). Tri par commandes puis nom
// (départage déterministe → classement stable même en bas). Région vide = Inconnu.
// EN : Top regions by order count, with a deterministic name tie-break and empty
// regions grouped as "Inconnu" (stable ranking, including the lower ranks).
export function topRegions(orders, limit = 8) {
  const map = {};
  orders.forEach((o) => {
    const r = (o.region && String(o.region).trim()) || 'Inconnu';
    map[r] = (map[r] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

// FR : Commandes et CA par région (top N), trié PAR REVENU (conforme au libellé
// « by revenue »), départage déterministe par nom, région vide = Inconnu.
// EN : Orders and revenue per region (top N), sorted BY REVENUE (matching the
// "by revenue" label), deterministic name tie-break, empty region = "Inconnu".
export function regionRevenue(orders, limit = 10) {
  const map = {};
  orders.forEach((o) => {
    const r = (o.region && String(o.region).trim()) || 'Inconnu';
    if (!map[r]) map[r] = { orders: 0, revenueUSD: 0, revenueGHS: 0 };
    map[r].orders++;
    map[r].revenueUSD += o.amountUSD;
    // Native GHS (Shopify base currency) — summed directly to avoid the
    // USD→GHS round-trip drift, so per-region revenue matches Shopify.
    map[r].revenueGHS += (o.amountGHS ?? 0);
  });
  return Object.entries(map)
    .map(([region, v]) => ({
      region, orders: v.orders, revenueUSD: round2(v.revenueUSD), revenueGHS: round2(v.revenueGHS),
    }))
    .sort((a, b) => b.revenueGHS - a.revenueGHS || a.region.localeCompare(b.region))
    .slice(0, limit);
}

// FR : Répartition des commandes par catégorie de statut (avec %), ordonnée selon
// le flux métier canonique (Pending → Transit → Outcomes → Issues → Returns) pour
// une lecture stable, indépendamment de l'ordre d'apparition dans les données.
// EN : Order distribution by status category (with %), sorted by the canonical
// business flow (Pending → Transit → Outcomes → Issues → Returns) for a stable,
// data-order-independent reading.
const CATEGORY_ORDER = Object.values(CATEGORY);
export function statusDistribution(orders) {
  const map = bucketCount(orders, (o) => o.category);
  const total = orders.length || 1;
  const rank = (label) => {
    const i = CATEGORY_ORDER.indexOf(label);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return Object.entries(map)
    .map(([label, count]) => ({
      label,
      count,
      pct: ((count / total) * 100).toFixed(1),
    }))
    .sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label));
}

// FR : Entonnoir de livraison MONOTONE (chaque étape est un sur-ensemble de la
// suivante) : Reçu ⊇ Collecté ⊇ En transit ⊇ Livré. « Retourné » est un résultat
// négatif distinct, affiché à part. Les bornes utilisent les groupes de statuts
// métiers (orderStatus) pour rester cohérentes avec le filtre de statut.
// EN : MONOTONIC delivery funnel (each step is a superset of the next):
// Received ⊇ Collected ⊇ In Transit ⊇ Delivered. "Returned" is a distinct
// negative outcome, shown separately. Bounds use the business status groups.
export function deliveryFunnel(orders) {
  const received = orders.length;
  const collected = orders.filter((o) => COLLECTED_LABELS.includes(o.status)).length;
  const inTransit = orders.filter((o) => IN_TRANSIT_LABELS.includes(o.status)).length;
  const delivered = orders.filter((o) => DELIVERED.includes(o.status)).length;
  const returned = orders.filter((o) => o.category === CATEGORY.RETURNS).length;
  return [
    { label: 'Orders Received', value: received, color: 'bg-indigo-500' },
    { label: 'Collected', value: collected, color: 'bg-blue-500' },
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
    .sort((a, b) => b.rate - a.rate || a.region.localeCompare(b.region))
    .slice(0, limit);
}

// ─── Finance ────────────────────────────────────────────────────────────────
// FR : Tableau financier mensuel (CA, encaissé, restant, logistique). EN : Monthly financial table (revenue, collected, outstanding, logistics).
export function financialByMonth(orders) {
  // Aggregated in NATIVE GHS (exact); USD derived once per cell from the GHS total.
  const toUsd = (g) => round2(g / config.usdToGhs);
  const rev = {};
  const ord = {};
  const log = {};
  orders.forEach((o) => {
    const k = o.date.slice(0, 7);
    rev[k] = (rev[k] || 0) + (o.amountGHS ?? 0);
    ord[k] = (ord[k] || 0) + 1;
    log[k] = (log[k] || 0) + (o.deliveryCostGHS ?? 0);
  });
  return Object.keys(rev)
    .sort()
    .map((k) => {
      const revGhs = rev[k];
      const collectedGhs = orders
        .filter((o) => o.date.slice(0, 7) === k && DELIVERED.includes(o.status))
        .reduce((s, o) => s + (o.amountGHS ?? 0), 0);
      const outstandingGhs = Math.max(0, revGhs - collectedGhs);
      return {
        month: monthLabel(k),
        revenueUSD: toUsd(revGhs),
        revenueGHS: round2(revGhs),
        collectedUSD: toUsd(collectedGhs),
        collectedGHS: round2(collectedGhs),
        outstandingUSD: toUsd(outstandingGhs),
        outstandingGHS: round2(outstandingGhs),
        logisticsUSD: toUsd(log[k]),
        logisticsGHS: round2(log[k]),
        orders: ord[k],
        avgUSD: toUsd(revGhs / ord[k]),
        avgGHS: round2(revGhs / ord[k]),
      };
    });
}

// FR : Synthèse financière (encaissé, restant, COD, commission, marge nette). EN : Financial summary (collected, outstanding, COD, commission, net margin).
export function financeSummary(orders) {
  // Aggregated in NATIVE GHS (the shop's base currency = exact, Shopify parity).
  // USD is derived once per total via `toUsd` (the 15.4 reference rate is never
  // round-tripped per order, so no rounding drift accumulates).
  const toUsd = (g) => round2(g / config.usdToGhs);
  const deliveredOrders = orders.filter((o) => DELIVERED.includes(o.status));
  const revenueGhs = orders.reduce((s, o) => s + (o.amountGHS ?? 0), 0);
  const collectedGhs = deliveredOrders.reduce((s, o) => s + (o.amountGHS ?? 0), 0);
  const outstandingGhs = Math.max(0, revenueGhs - collectedGhs);
  const codGhs = deliveredOrders
    .slice(0, Math.floor(deliveredOrders.length * 0.7))
    .reduce((s, o) => s + (o.amountGHS ?? 0), 0);
  const count = orders.length || 1;

  // ShaQ economics on delivered orders (commission & delivery fee kept separate).
  // frais_livraison = stored delivery cost; handling fee = 5% × (revenue − delivery
  // fee), i.e. the delivery fee is removed first, then 5% on the remainder.
  // Supplier cost isn't on the order payload here (mock), so we use a 40% COGS
  // proxy; in real mode finance.service overrides these with backend values.
  const fraisLivraisonGhs = deliveredOrders.reduce((s, o) => s + (o.deliveryCostGHS ?? 0), 0);
  const commissionGhs = Math.max(0, collectedGhs - fraisLivraisonGhs) * 0.05;
  const supplierGhs = deliveredOrders.reduce((s, o) => s + (o.amountGHS ?? 0) * 0.4, 0);
  const margeNetteGhs = collectedGhs - fraisLivraisonGhs - commissionGhs - supplierGhs;

  return {
    deliveredOrders: deliveredOrders.length,
    totalRevenue: { ghs: round2(revenueGhs), usd: toUsd(revenueGhs) },
    avgOrderValue: { ghs: round2(revenueGhs / count), usd: toUsd(revenueGhs / count) },
    collected: { ghs: round2(collectedGhs), usd: toUsd(collectedGhs) },
    outstanding: { ghs: round2(outstandingGhs), usd: toUsd(outstandingGhs) },
    cod: { ghs: round2(codGhs), usd: toUsd(codGhs) },
    fraisLivraison: { ghs: round2(fraisLivraisonGhs), usd: toUsd(fraisLivraisonGhs) },
    commissionShaq: { ghs: round2(commissionGhs), usd: toUsd(commissionGhs) },
    coutFournisseur: { ghs: round2(supplierGhs), usd: toUsd(supplierGhs) },
    margeNette: { ghs: round2(margeNetteGhs), usd: toUsd(margeNetteGhs) },
    margeNettePct: collectedGhs > 0 ? round2((margeNetteGhs / collectedGhs) * 100) : 0,
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
