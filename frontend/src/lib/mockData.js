// ─── Constants ────────────────────────────────────────────────────────────────
// Delivery status taxonomy lives in lib/orderStatus.js (ShaQ-aligned, single
// source of truth). Re-exported here for backward compatibility.
import { STATUS_CATEGORIES, STATUS_COLORS, ALL_STATUSES } from "@/lib/orderStatus";
export { STATUS_CATEGORIES, STATUS_COLORS, ALL_STATUSES };

export const USD_TO_GHS = 15.4;

export const REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Eastern", "Central",
  "Northern", "Volta", "Upper East", "Upper West", "Brong-Ahafo",
  "Oti", "Savannah", "North East", "Western North", "Ahafo",
];

export const PRODUCTS = [
  "Ankara Fabric (6 yards)", "LED Smart TV 43\"", "Jollof Rice Cooker",
  "African Print Dress", "Bluetooth Speaker", "Mobile Phone Case",
  "Shea Butter Cream", "Kente Cloth Roll", "Solar Lantern",
  "Moringa Powder 500g", "Waist Beads Set", "Leather Sandals",
  "Coconut Oil 1L", "Batik Shirt (Men)", "Baby Carrier Wrap",
  "Adinkra Wall Art", "Hair Relaxer Kit", "Groundnut Paste 500g",
  "Wax Print Skirt", "Power Bank 20000mAh",
];

export const CUSTOMER_NAMES = [
  "Abena Mensah", "Kwame Asante", "Ama Boateng", "Kofi Ofori",
  "Akosua Darko", "Yaw Acheampong", "Adjoa Frimpong", "Kweku Antwi",
  "Efua Owusu", "Nana Agyei", "Abiba Seidu", "Kofi Larbi",
  "Adwoa Asare", "Kwabena Osei", "Akua Amponsah", "Fiifi Quaye",
  "Maame Sarpong", "Kojo Bonsu", "Araba Acquah", "Yaa Asante",
  "Dela Agbeko", "Selorm Dzikunu", "Elikplim Ametefe", "Kafui Tetteh",
  "Mawuli Gbadago", "Abla Dzobo", "Sedem Nutakor", "Dziffa Attipoe",
  "Paa Kwesi", "Esi Ampah",
];

// ─── Seeded RNG ────────────────────────────────────────────────────────────────
function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Order Generator ──────────────────────────────────────────────────────────
export function generateOrders(count = 500) {
  const rand = seededRand(42);
  const orders = [];
  const startDate = new Date("2024-01-01");

  for (let i = 0; i < count; i++) {
    const r = () => rand();
    const statusCatKeys = Object.keys(STATUS_CATEGORIES);
    const cat = statusCatKeys[Math.floor(r() * statusCatKeys.length)];
    const statuses = STATUS_CATEGORIES[cat];
    const status = statuses[Math.floor(r() * statuses.length)];

    const daysOffset = Math.floor(r() * 530);
    const date = new Date(startDate);
    date.setDate(date.getDate() + daysOffset);

    // updatedAt is 0-10 days after order date
    const updatedDate = new Date(date);
    updatedDate.setDate(updatedDate.getDate() + Math.floor(r() * 10));

    const amountUSD = parseFloat((r() * 280 + 8).toFixed(2));
    const deliveryCostUSD = parseFloat((r() * 12 + 3).toFixed(2));
    const shaqCostUSD = parseFloat((deliveryCostUSD * 0.65).toFixed(2));
    const phone = `+233 ${Math.floor(r() * 9 + 1)}${String(Math.floor(r() * 100000000)).padStart(8, "0")}`;

    orders.push({
      id: `ORD-${String(10000 + i).padStart(5, "0")}`,
      customer: CUSTOMER_NAMES[Math.floor(r() * CUSTOMER_NAMES.length)],
      phone,
      region: REGIONS[Math.floor(r() * REGIONS.length)],
      product: PRODUCTS[Math.floor(r() * PRODUCTS.length)],
      status,
      category: cat,
      amountUSD,
      amountGHS: parseFloat((amountUSD * USD_TO_GHS).toFixed(2)),
      deliveryCostUSD,
      deliveryCostGHS: parseFloat((deliveryCostUSD * USD_TO_GHS).toFixed(2)),
      shaqCostUSD,
      shaqCostGHS: parseFloat((shaqCostUSD * USD_TO_GHS).toFixed(2)),
      date: date.toISOString().split("T")[0],
      updatedAt: updatedDate.toISOString().split("T")[0],
      shopifyId: `SHP-${String(Math.floor(r() * 900000 + 100000))}`,
      notes: "",
      archived: false,
    });
  }

  return orders.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// FR : Aucune commande de démo — démarrage à vide (vraies données seules).
// EN : No demo orders — start empty (real data only).
export const ORDERS = [];

// ─── Analytics Aggregations ───────────────────────────────────────────────────
export function getOrdersByMonth() {
  const map = {};
  ORDERS.forEach((o) => {
    const key = o.date.slice(0, 7);
    map[key] = (map[key] || 0) + 1;
  });
  const sorted = Object.keys(map).sort();
  return {
    labels: sorted.map((k) => {
      const [y, m] = k.split("-");
      return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m-1]} ${y.slice(2)}`;
    }),
    data: sorted.map((k) => map[k]),
  };
}

export function getOrdersByWeek() {
  const map = {};
  ORDERS.forEach((o) => {
    const d = new Date(o.date);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
    map[key] = (map[key] || 0) + 1;
  });
  const sorted = Object.keys(map).sort().slice(-20);
  return { labels: sorted, data: sorted.map((k) => map[k]) };
}

export function getOrdersByDate() {
  const map = {};
  ORDERS.forEach((o) => { map[o.date] = (map[o.date] || 0) + 1; });
  const sorted = Object.keys(map).sort().slice(-30);
  return { labels: sorted.map((d) => d.slice(5)), data: sorted.map((k) => map[k]) };
}

export function getRevenueByMonth() {
  const map = {};
  ORDERS.forEach((o) => {
    const key = o.date.slice(0, 7);
    map[key] = (map[key] || 0) + o.amountUSD;
  });
  const sorted = Object.keys(map).sort();
  return {
    labels: sorted.map((k) => {
      const [y, m] = k.split("-");
      return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m-1]} ${y.slice(2)}`;
    }),
    dataUSD: sorted.map((k) => parseFloat(map[k].toFixed(2))),
    dataGHS: sorted.map((k) => parseFloat((map[k] * USD_TO_GHS).toFixed(2))),
  };
}

export function getBestSellingProducts() {
  const map = {};
  ORDERS.forEach((o) => { map[o.product] = (map[o.product] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

export function getTopRegions() {
  const map = {};
  ORDERS.forEach((o) => { map[o.region] = (map[o.region] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

export function getRegionRevenue() {
  const map = {};
  ORDERS.forEach((o) => {
    if (!map[o.region]) map[o.region] = { orders: 0, revenueUSD: 0 };
    map[o.region].orders++;
    map[o.region].revenueUSD += o.amountUSD;
  });
  return Object.entries(map)
    .map(([region, v]) => ({ region, orders: v.orders, revenueUSD: parseFloat(v.revenueUSD.toFixed(2)) }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);
}

export function getStatusDistribution() {
  const catMap = {};
  ORDERS.forEach((o) => { catMap[o.category] = (catMap[o.category] || 0) + 1; });
  return Object.entries(catMap).map(([cat, count]) => ({
    label: cat,
    count,
    pct: ((count / ORDERS.length) * 100).toFixed(1),
  }));
}

export function getDeliverySuccessRate() {
  const delivered = ORDERS.filter((o) =>
    ["Delivered", "Delivered (Partial)", "Confirmed"].includes(o.status)
  ).length;
  return ((delivered / ORDERS.length) * 100).toFixed(1);
}

export function getReturnRate() {
  const returned = ORDERS.filter((o) => o.category === "Returns").length;
  return ((returned / ORDERS.length) * 100).toFixed(1);
}

export function getCancellationRate() {
  const cancelled = ORDERS.filter((o) => o.category === "Issues & Exceptions").length;
  return ((cancelled / ORDERS.length) * 100).toFixed(1);
}

export function getTotalRevenue() {
  const total = ORDERS.reduce((s, o) => s + o.amountUSD, 0);
  return { usd: parseFloat(total.toFixed(2)), ghs: parseFloat((total * USD_TO_GHS).toFixed(2)) };
}

export function getTotalLogisticsCost() {
  const total = ORDERS.reduce((s, o) => s + o.deliveryCostUSD, 0);
  return { usd: parseFloat(total.toFixed(2)), ghs: parseFloat((total * USD_TO_GHS).toFixed(2)) };
}

export function getTotalShaqCost() {
  const total = ORDERS.reduce((s, o) => s + o.shaqCostUSD, 0);
  return { usd: parseFloat(total.toFixed(2)), ghs: parseFloat((total * USD_TO_GHS).toFixed(2)) };
}

export function getAvgOrderValue() {
  const rev = getTotalRevenue();
  return {
    usd: parseFloat((rev.usd / ORDERS.length).toFixed(2)),
    ghs: parseFloat((rev.ghs / ORDERS.length).toFixed(2)),
  };
}

export function getAvgDeliveryTime() {
  // Simulated: avg days between date and updatedAt for delivered orders
  const delivered = ORDERS.filter((o) =>
    ["Delivered", "Confirmed"].includes(o.status)
  );
  if (!delivered.length) return 0;
  const totalDays = delivered.reduce((s, o) => {
    const diff = (new Date(o.updatedAt) - new Date(o.date)) / 86400000;
    return s + Math.max(0, diff);
  }, 0);
  return parseFloat((totalDays / delivered.length).toFixed(1));
}

export function getAvgNetMargin() {
  const totalRev = ORDERS.reduce((s, o) => s + o.amountUSD, 0);
  const totalCost = ORDERS.reduce((s, o) => s + o.shaqCostUSD, 0);
  return parseFloat((((totalRev - totalCost) / totalRev) * 100).toFixed(1));
}

export function getAvgBasketSize() {
  // Simulated: 1 to 3 items per order
  return 1.8;
}

export function getDeliveryFunnel() {
  const received = ORDERS.length;
  const assigned = ORDERS.filter((o) =>
    !["Pending", "Awaiting Collection"].includes(o.status)
  ).length;
  const inTransit = ORDERS.filter((o) =>
    ["In Transit", "Out for Delivery", "Dispatched"].includes(o.status)
  ).length;
  const delivered = ORDERS.filter((o) =>
    ["Delivered", "Delivered (Partial)", "Confirmed"].includes(o.status)
  ).length;
  const returned = ORDERS.filter((o) => o.category === "Returns").length;
  return [
    { label: "Orders Received", value: received, color: "bg-indigo-500" },
    { label: "Orders Assigned", value: assigned, color: "bg-blue-500" },
    { label: "In Transit", value: inTransit, color: "bg-violet-500" },
    { label: "Delivered", value: delivered, color: "bg-emerald-500" },
    { label: "Returned", value: returned, color: "bg-rose-500" },
  ];
}

export function getCancellationByRegion() {
  const map = {};
  ORDERS.forEach((o) => {
    if (!map[o.region]) map[o.region] = { total: 0, cancelled: 0 };
    map[o.region].total++;
    if (o.category === "Issues & Exceptions") map[o.region].cancelled++;
  });
  return Object.entries(map)
    .map(([region, v]) => ({
      region,
      rate: parseFloat(((v.cancelled / v.total) * 100).toFixed(1)),
      total: v.total,
      cancelled: v.cancelled,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);
}

export function getFinancialByMonth() {
  const revenueMap = {};
  const ordersMap = {};
  const logisticsMap = {};
  ORDERS.forEach((o) => {
    const key = o.date.slice(0, 7);
    revenueMap[key] = (revenueMap[key] || 0) + o.amountUSD;
    ordersMap[key] = (ordersMap[key] || 0) + 1;
    logisticsMap[key] = (logisticsMap[key] || 0) + o.deliveryCostUSD;
  });
  const sorted = Object.keys(revenueMap).sort();
  return sorted.map((k) => {
    const revUSD = revenueMap[k];
    const logUSD = logisticsMap[k];
    const deliveredOrders = ORDERS.filter(
      (o) => o.date.slice(0, 7) === k && ["Delivered", "Confirmed"].includes(o.status)
    );
    const collected = deliveredOrders.reduce((s, o) => s + o.amountUSD, 0);
    const outstanding = revUSD - collected;
    return {
      month: (() => {
        const [y, m] = k.split("-");
        return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m-1]} ${y.slice(2)}`;
      })(),
      revenueUSD: parseFloat(revUSD.toFixed(2)),
      revenueGHS: parseFloat((revUSD * USD_TO_GHS).toFixed(2)),
      collectedUSD: parseFloat(collected.toFixed(2)),
      collectedGHS: parseFloat((collected * USD_TO_GHS).toFixed(2)),
      outstandingUSD: parseFloat(Math.max(0, outstanding).toFixed(2)),
      outstandingGHS: parseFloat((Math.max(0, outstanding) * USD_TO_GHS).toFixed(2)),
      logisticsUSD: parseFloat(logUSD.toFixed(2)),
      logisticsGHS: parseFloat((logUSD * USD_TO_GHS).toFixed(2)),
      orders: ordersMap[k],
      avgUSD: parseFloat((revUSD / ordersMap[k]).toFixed(2)),
      avgGHS: parseFloat((revUSD * USD_TO_GHS / ordersMap[k]).toFixed(2)),
    };
  });
}

// ─── Financial summary helpers ────────────────────────────────────────────────
export function getTotalCollected() {
  const total = ORDERS
    .filter((o) => ["Delivered", "Confirmed"].includes(o.status))
    .reduce((s, o) => s + o.amountUSD, 0);
  return { usd: parseFloat(total.toFixed(2)), ghs: parseFloat((total * USD_TO_GHS).toFixed(2)) };
}

export function getTotalOutstanding() {
  const collected = getTotalCollected();
  const total = getTotalRevenue();
  const diff = total.usd - collected.usd;
  return { usd: parseFloat(Math.max(0, diff).toFixed(2)), ghs: parseFloat((Math.max(0, diff) * USD_TO_GHS).toFixed(2)) };
}

export function getCODRemittances() {
  // Simulated: 70% of delivered orders paid via COD
  const delivered = ORDERS.filter((o) => ["Delivered", "Confirmed"].includes(o.status));
  const cod = delivered.slice(0, Math.floor(delivered.length * 0.7));
  const total = cod.reduce((s, o) => s + o.amountUSD, 0);
  return { usd: parseFloat(total.toFixed(2)), ghs: parseFloat((total * USD_TO_GHS).toFixed(2)) };
}