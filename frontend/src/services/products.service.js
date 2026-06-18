/**
 * Products service.
 *
 * Mock mode keeps an in-memory catalog so create/edit/delete persist for the
 * session. Real mode calls `/products` (paginated) and normalizes snake_case
 * rows into the UI `Product` shape. KPIs are computed client-side (the backend
 * has no dedicated KPI endpoint).
 */
import { config } from '@/config/env';
import { http } from '@/api/httpClient';
import { endpoints } from '@/api/endpoints';
import { simulate } from '@/services/mock/mockUtils';
import { PRODUCTS_DATA, getProductKPIs } from '@/lib/mockProducts';
import { productStatusToUi, productStatusToApi } from '@/lib/orderStatus';

/** @typedef {import('@/types').Product} Product */

let mockProducts = PRODUCTS_DATA.map((p) => ({ ...p }));

// GHS is the base currency; USD is derived = GHS / rate.
const ghsToUsd = (ghsVal) => Number((Number(ghsVal || 0) / config.usdToGhs).toFixed(2));

/**
 * Normalize a raw backend product row into the UI `Product` shape.
 * @param {any} row
 * @returns {Product}
 */
export function normalizeProduct(row) {
  if (!row) return row;
  // Already in UI shape (mock store) — pass through.
  if (row.priceUSD !== undefined && row.inventory !== undefined) return row;

  const priceGHS = Number(row.price ?? 0);
  const costGHS = Number(row.supplier_cost ?? 0);
  return {
    id: row.id,
    shopifyId: row.shopify_product_id ?? null,
    name: row.name ?? '',
    sku: row.sku ?? '',
    category: row.category ?? '',
    priceGHS,
    priceUSD: ghsToUsd(priceGHS),
    costGHS,
    costUSD: ghsToUsd(costGHS),
    inventory: Number(row.stock_quantity ?? 0),
    lowStockThreshold: Number(row.low_stock_threshold ?? 5),
    sold: Number(row.sold ?? 0),
    status: productStatusToUi(row.product_status),
    stockState: row.stock_state,
    image: row.image_url ?? '',
    gallery: row.image_url ? [row.image_url] : [],
    createdDate: row.created_at ? String(row.created_at).slice(0, 10) : '',
    variants: [],
    salesByMonth: [],
    inventoryHistory: [],
    description: row.description ?? '',
    weight: '',
    tags: [],
  };
}

/** Map a UI product form payload to the backend body. */
function toApiPayload(payload = {}) {
  const body = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.sku !== undefined) body.sku = payload.sku;
  if (payload.category !== undefined) body.category = payload.category;
  if (payload.description !== undefined) body.description = payload.description;
  // Price/cost are entered/stored in GHS (base currency).
  if (payload.priceGHS !== undefined) body.price = Number(payload.priceGHS);
  else if (payload.priceUSD !== undefined) body.price = Number(payload.priceUSD);
  if (payload.costGHS !== undefined) body.supplierCost = Number(payload.costGHS);
  else if (payload.costUSD !== undefined) body.supplierCost = Number(payload.costUSD);
  if (payload.inventory !== undefined) body.stockQuantity = Number(payload.inventory);
  if (payload.lowStockThreshold !== undefined) body.lowStockThreshold = Number(payload.lowStockThreshold);
  if (payload.status !== undefined) body.productStatus = productStatusToApi(payload.status);
  if (payload.imageUrl !== undefined) body.imageUrl = payload.imageUrl;
  return body;
}

async function fetchAllProducts(params = {}) {
  const all = [];
  const limit = 100;
  for (let page = 1; page <= 100; page++) {
    const { data, meta } = await http.getRaw(endpoints.products.root, { params: { ...params, page, limit } });
    const rows = Array.isArray(data) ? data : data?.items ?? [];
    all.push(...rows.map(normalizeProduct));
    if (!meta || !meta.hasNext) break;
  }
  return all;
}

export const productsService = {
  /**
   * @param {import('@/types').ProductListParams} [params]
   * @returns {Promise<Product[]>}
   */
  async getAll(params) {
    if (config.useMock) return simulate(() => mockProducts.map((p) => ({ ...p })));
    return fetchAllProducts(params);
  },

  /** @returns {Promise<Product>} */
  async getById(id) {
    if (config.useMock) {
      return simulate(() => {
        const found = mockProducts.find((p) => p.id === id);
        return found ? { ...found } : null;
      });
    }
    return normalizeProduct(await http.get(endpoints.products.byId(id)));
  },

  /**
   * KPIs are derived client-side from the full catalog (no backend endpoint).
   * @returns {Promise<import('@/types').ProductKpis>}
   */
  async getKpis() {
    if (config.useMock) return simulate(() => getProductKPIs());
    const products = await fetchAllProducts();
    const active = products.filter((p) => p.status === 'Active').length;
    const lowStock = products.filter((p) => p.inventory > 0 && p.inventory <= (p.lowStockThreshold ?? 15)).length;
    const outOfStock = products.filter((p) => p.inventory === 0).length;
    return {
      total: products.length,
      active,
      lowStock,
      outOfStock,
      totalInventoryValueUSD: Number(products.reduce((s, p) => s + p.priceUSD * p.inventory, 0).toFixed(2)),
      totalRevUSD: Number(products.reduce((s, p) => s + p.priceUSD * p.sold, 0).toFixed(2)),
    };
  },

  /**
   * @param {import('@/types').ProductPayload} payload
   * @returns {Promise<Product>}
   */
  async create(payload) {
    if (config.useMock) {
      return simulate(() => {
        const id = `PROD-${String(1000 + mockProducts.length).padStart(4, '0')}`;
        const product = {
          id,
          shopifyId: null,
          name: payload.name,
          sku: payload.sku,
          category: payload.category,
          priceGHS: Number(payload.priceGHS ?? payload.priceUSD) || 0,
          priceUSD: ghsToUsd(payload.priceGHS ?? payload.priceUSD),
          costGHS: 0,
          costUSD: 0,
          inventory: Number(payload.inventory) || 0,
          lowStockThreshold: 15,
          sold: 0,
          status: payload.status || 'Active',
          image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=300&fit=crop',
          gallery: [],
          createdDate: new Date().toISOString().slice(0, 10),
          variants: [],
          salesByMonth: [],
          inventoryHistory: [],
          description: payload.description || '',
          weight: payload.weight || '',
          tags: payload.tags || [],
        };
        mockProducts = [product, ...mockProducts];
        return { ...product };
      });
    }
    return normalizeProduct(await http.post(endpoints.products.root, toApiPayload(payload)));
  },

  /**
   * @param {string} id
   * @param {Partial<import('@/types').ProductPayload>} payload
   * @returns {Promise<Product>}
   */
  async update(id, payload) {
    if (config.useMock) {
      return simulate(() => {
        mockProducts = mockProducts.map((p) =>
          p.id === id
            ? {
                ...p,
                ...payload,
                priceGHS: (payload.priceGHS ?? payload.priceUSD) !== undefined ? Number(payload.priceGHS ?? payload.priceUSD) : p.priceGHS,
                priceUSD: (payload.priceGHS ?? payload.priceUSD) !== undefined ? ghsToUsd(payload.priceGHS ?? payload.priceUSD) : p.priceUSD,
              }
            : p,
        );
        return { ...mockProducts.find((p) => p.id === id) };
      });
    }
    return normalizeProduct(await http.put(endpoints.products.byId(id), toApiPayload(payload)));
  },

  /** @returns {Promise<void>} */
  async remove(id) {
    if (config.useMock) {
      return simulate(() => {
        mockProducts = mockProducts.filter((p) => p.id !== id);
      });
    }
    await http.delete(endpoints.products.byId(id));
  },

  /**
   * Absolute (`quantity`) or relative (`delta`) stock change.
   * @param {string} id
   * @param {import('@/types').StockAdjustment} adjustment
   * @returns {Promise<Product>}
   */
  async adjustStock(id, adjustment) {
    if (config.useMock) {
      return simulate(() => {
        mockProducts = mockProducts.map((p) => {
          if (p.id !== id) return p;
          const inventory =
            adjustment.quantity !== undefined ? adjustment.quantity : p.inventory + (adjustment.delta || 0);
          return { ...p, inventory: Math.max(0, inventory) };
        });
        return { ...mockProducts.find((p) => p.id === id) };
      });
    }
    return normalizeProduct(await http.patch(endpoints.products.stock(id), adjustment));
  },
};

export default productsService;
