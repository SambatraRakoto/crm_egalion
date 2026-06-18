// ─── Seeded random (self-contained) ──────────────────────────────────────────
function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
// FR : La boutique ne vend que des marques de beauté → une seule catégorie.
// EN : The shop only sells beauty brands → a single category.
export const PRODUCT_CATEGORIES = ["Beauty"];

export const PRODUCT_STATUS = ["Active", "Draft", "Archived"];

export const STATUS_BADGE = {
  Active: "bg-emerald-100 text-emerald-700",
  Draft: "bg-amber-100 text-amber-700",
  Archived: "bg-slate-100 text-slate-500",
};

const UNSPLASH_IMAGES = [
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1587304334369-2a6e6e8a43a1?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1585621386284-b4f7f0e5be6a?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1567538096621-38d2284b23ff?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=300&fit=crop",
];

const EXTRA_IMAGES = [
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600&h=400&fit=crop",
];

const PRODUCT_NAMES_BY_CAT = {
  "Beauty": [
    "Shea Butter Cream 200g", "Coconut Oil 1L", "Black Soap Bar 150g", "Hair Relaxer Kit",
    "Facial Serum 30ml", "Body Lotion 400ml", "Lip Balm", "Makeup Foundation",
    "Perfume 50ml", "Hair Oil 100ml", "Face Mask Pack", "Moisturizing Toner 250ml",
  ],
};

// FR : Beauté : pas de tailles; variantes par contenance et par teinte.
// EN : Beauty: no sizes; variants by volume and by shade.
const SIZE_VARIANTS = ["30ml", "50ml", "100ml", "200ml"];
const COLOR_VARIANTS = ["Natural", "Light", "Medium", "Deep", "Rose", "Nude", "Cocoa"];

function generateVariants(rand, category) {
  const hasSize = category === "Beauty"; // volume options
  const hasColor = category === "Beauty"; // shade options
  const variants = [];
  const sizes = hasSize ? SIZE_VARIANTS.slice(0, 2 + Math.floor(rand() * 3)) : ["Standard"];
  const colors = hasColor ? COLOR_VARIANTS.slice(0, 2 + Math.floor(rand() * 3)) : ["Default"];
  for (const size of sizes.slice(0, 3)) {
    for (const color of colors.slice(0, 2)) {
      const stock = Math.floor(rand() * 80);
      variants.push({ size, color, sku: `SKU-${String(Math.floor(rand() * 90000 + 10000))}`, stock, price: null });
    }
  }
  return variants;
}

function generateInventoryHistory(rand) {
  const history = [];
  const now = new Date("2025-06-01");
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    history.push({
      month: d.toISOString().slice(0, 7),
      added: Math.floor(rand() * 60 + 10),
      sold: Math.floor(rand() * 50 + 5),
    });
  }
  return history;
}

export function generateProducts(count = 80) {
  const rand = seededRand(99);
  const products = [];
  const startDate = new Date("2023-06-01");
  let idxByCategory = {};

  for (let i = 0; i < count; i++) {
    const category = PRODUCT_CATEGORIES[Math.floor(rand() * PRODUCT_CATEGORIES.length)];
    const names = PRODUCT_NAMES_BY_CAT[category];
    const catIdx = idxByCategory[category] || 0;
    const name = names[catIdx % names.length];
    idxByCategory[category] = catIdx + 1;

    const daysOffset = Math.floor(rand() * 900);
    const createdDate = new Date(startDate);
    createdDate.setDate(createdDate.getDate() + daysOffset);

    const priceUSD = parseFloat((rand() * 240 + 8).toFixed(2));
    const costUSD = parseFloat((priceUSD * (0.35 + rand() * 0.3)).toFixed(2));
    const inventory = Math.floor(rand() * 200);
    const sold = Math.floor(rand() * 150 + 5);
    const statusRoll = rand();
    const status = statusRoll > 0.75 ? "Active" : statusRoll > 0.88 ? "Draft" : statusRoll > 0.95 ? "Archived" : "Active";

    const salesByMonth = [];
    for (let m = 0; m < 12; m++) {
      salesByMonth.push({ month: m, units: Math.floor(rand() * 20), revenue: parseFloat((rand() * 400 + 20).toFixed(2)) });
    }

    products.push({
      id: `PROD-${String(1000 + i).padStart(4, "0")}`,
      shopifyId: `SHP-PROD-${String(Math.floor(rand() * 9000000 + 1000000))}`,
      name,
      sku: `SKU-GH-${String(1000 + i)}`,
      category,
      priceUSD,
      priceGHS: parseFloat((priceUSD * 15.4).toFixed(2)),
      costUSD,
      inventory,
      sold,
      status: statusRoll > 0.85 ? (statusRoll > 0.93 ? "Archived" : "Draft") : "Active",
      image: UNSPLASH_IMAGES[i % UNSPLASH_IMAGES.length],
      gallery: [UNSPLASH_IMAGES[i % UNSPLASH_IMAGES.length], ...EXTRA_IMAGES.slice(0, 3)],
      createdDate: createdDate.toISOString().split("T")[0],
      variants: generateVariants(rand, category),
      salesByMonth,
      inventoryHistory: generateInventoryHistory(rand),
      description: `Premium quality ${name.toLowerCase()} sourced directly from Ghanaian artisans and manufacturers. Ideal for the local and export market.`,
      weight: `${(rand() * 4 + 0.1).toFixed(1)} kg`,
      tags: [category.split(" ")[0], "Ghana", "Shopify"],
    });
  }

  return products;
}

// FR : Aucune donnée de démo — l'application démarre vide (vraies données seules).
// EN : No demo data — the app starts empty (real data only).
export const PRODUCTS_DATA = [];

// ─── Aggregations ─────────────────────────────────────────────────────────────
// FR : Chaque agrégation accepte un tableau de produits (défaut : vide).
// EN : Each aggregation takes a products array (defaults to empty).

// FR : KPI produits (total, actifs, stock bas/épuisé, valeur, CA).
// EN : Product KPIs (total, active, low/out of stock, value, revenue).
export function getProductKPIs(products = PRODUCTS_DATA) {
  const total = products.length;
  const active = products.filter((p) => p.status === "Active").length;
  const lowStock = products.filter((p) => p.inventory > 0 && p.inventory <= (p.lowStockThreshold ?? 15)).length;
  const outOfStock = products.filter((p) => p.inventory === 0).length;
  const totalInventoryValueUSD = products.reduce((s, p) => s + p.priceUSD * p.inventory, 0);
  const totalRevUSD = products.reduce((s, p) => s + p.priceUSD * (p.sold || 0), 0);
  return { total, active, lowStock, outOfStock, totalInventoryValueUSD: parseFloat(totalInventoryValueUSD.toFixed(2)), totalRevUSD: parseFloat(totalRevUSD.toFixed(2)) };
}

// FR : Meilleures ventes (top 10 par unités vendues).
// EN : Best sellers (top 10 by units sold).
export function getBestSellingProductsData(products = PRODUCTS_DATA) {
  return [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 10);
}

// FR : CA par produit (top 8).
// EN : Revenue per product (top 8).
export function getRevenuePerProduct(products = PRODUCTS_DATA) {
  return [...products]
    .map((p) => ({ name: p.name, revenueUSD: parseFloat((p.priceUSD * (p.sold || 0)).toFixed(2)) }))
    .sort((a, b) => b.revenueUSD - a.revenueUSD)
    .slice(0, 8);
}

// FR : Performance par catégorie (unités, CA, nb produits).
// EN : Category performance (units, revenue, product count).
export function getCategoryPerformance(products = PRODUCTS_DATA) {
  const map = {};
  products.forEach((p) => {
    if (!map[p.category]) map[p.category] = { sold: 0, revenue: 0, count: 0 };
    map[p.category].sold += p.sold || 0;
    map[p.category].revenue += p.priceUSD * (p.sold || 0);
    map[p.category].count++;
  });
  return Object.entries(map).map(([cat, v]) => ({ cat, sold: v.sold, revenue: parseFloat(v.revenue.toFixed(2)), count: v.count })).sort((a, b) => b.revenue - a.revenue);
}

// FR : Tendance des ventes par mois.
// EN : Monthly sales trend.
export function getSalesTrendData(products = PRODUCTS_DATA) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const totals = months.map((_, i) => products.reduce((s, p) => s + (p.salesByMonth?.[i]?.revenue || 0), 0));
  return { labels: months, data: totals.map((v) => parseFloat(v.toFixed(2))) };
}

// FR : Historique de synchro — vide au démarrage (vient du backend en réel).
// EN : Sync history — empty at start (comes from the backend in real mode).
export const SYNC_HISTORY = [];