/** Product & inventory types. */

export type ProductStatus = 'Active' | 'Draft' | 'Archived';

/** Computed stock state from the backend (`stock_state`). */
export type StockState = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface ProductVariant {
  size: string;
  color: string;
  sku: string;
  stock: number;
  price: number | null;
}

/**
 * A product as consumed by the UI. The service layer normalizes the backend
 * payload into this shape (field names match the catalog/detail components).
 */
export interface Product {
  id: string;
  shopifyId: string | null;
  name: string;
  sku: string;
  category: string;
  priceUSD: number;
  priceGHS: number;
  costUSD: number;
  inventory: number;
  sold: number;
  status: ProductStatus;
  stockState?: StockState;
  image: string;
  gallery: string[];
  createdDate: string;
  variants: ProductVariant[];
  salesByMonth: { month: number; units: number; revenue: number }[];
  inventoryHistory: { month: string; added: number; sold: number }[];
  description: string;
  weight: string;
  tags: string[];
}

/** Filters for `GET /products`. */
export interface ProductListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  status?: ProductStatus;
  stockState?: StockState;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Create/update payload for `POST|PUT /products`. */
export interface ProductPayload {
  name: string;
  sku: string;
  category: string;
  priceUSD: number;
  inventory: number;
  status: ProductStatus;
  description?: string;
  weight?: string;
  tags?: string[];
}

/** Stock adjustment for `PATCH /products/:id/stock` (absolute or delta). */
export interface StockAdjustment {
  quantity?: number;
  delta?: number;
}

export interface ProductKpis {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
  totalInventoryValueUSD: number;
  totalRevUSD: number;
}
