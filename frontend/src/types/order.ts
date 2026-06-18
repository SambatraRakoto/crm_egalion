/** Order & delivery types. */

import type { Money } from './common';

/**
 * Canonical delivery status emitted by the backend (aligned with ShaQ):
 *   pending | collection | transit | dispatch | delivered | cancelled |
 *   returned | failed_delivery | issue
 * The service layer maps these to the richer display labels the UI uses
 * (see `lib/orderStatus`). The `Order.status` below is the *display* label.
 */
export type DeliveryStatus =
  // 📦 Pending & Collection
  | 'pending' | 'received' | 'warehouse_received' | 'collected' | 'ready_for_pickup'
  // 🚚 Transit & Dispatch
  | 'shipped' | 'assigned' | 'in_transit' | 'dispatched'
  // ✅ Delivery Outcomes
  | 'confirmed' | 'delivered'
  // ⚠️ Issues & Exceptions
  | 'not_delivered' | 'rescheduled' | 'customer_hold' | 'customer_unreachable' | 'suspected_scam'
  // 🔙 Returns
  | 'return_picked' | 'return_in_progress' | 'returned_to_sender' | 'return_to_central'
  // Non-ShaQ (Shopify-origin)
  | 'cancelled';

export interface OrderItem {
  id: number;
  productId: number | null;
  name: string;
  sku?: string;
  quantity: number;
  unitPriceUSD: number;
}

/**
 * An order as consumed by the UI. The service layer normalizes the backend
 * payload (snake_case, canonical status) into this exact shape, so pages and
 * components never deal with raw API rows.
 */
export interface Order {
  id: string;
  shopifyId: string | null;
  /** ShaQ tracking number (set once the order is shipped to ShaQ). */
  shaqTrackingId: string | null;
  /** Order reference == ShaQ partner_ref (e.g. "#NA-…"). */
  orderNumber: string | null;
  customer: string;
  phone: string;
  region: string;
  /** Primary product label (first line item) for compact tables. */
  product: string;
  /** First line item's quantity (total quantity also available via items). */
  quantity: number;
  unitPriceUSD: number;
  unitPriceGHS: number;
  items?: OrderItem[];
  /** Display status label (e.g. "In Transit"), derived from the canonical status. */
  status: string;
  /** UI display category (e.g. "Transit & Dispatch"), derived from status. */
  category: string;
  amountUSD: number;
  amountGHS: number;
  deliveryCostUSD: number;
  deliveryCostGHS: number;
  /** Commission ShaQ = order amount × 5% (dynamic). */
  commissionShaqUSD: number;
  commissionShaqGHS: number;
  shaqCostUSD: number;
  shaqCostGHS: number;
  /** ISO order date (YYYY-MM-DD), sourced from ShaQ when available. */
  date: string;
  updatedAt: string;
  /** ISO delivery date (YYYY-MM-DD) — set when status becomes delivered. */
  deliveredAt: string;
  notes: string;
  archived: boolean;
}

/** Filters accepted by `GET /orders`. */
export interface OrderListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  status?: string;
  archived?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Editable fields for `PUT /orders/:id`. */
export interface OrderUpdatePayload {
  customer?: string;
  phone?: string;
  region?: string;
  status?: string;
  notes?: string;
}

/** Body for bulk operations `PATCH /orders/bulk`. */
export interface OrderBulkPayload {
  ids: string[];
  status?: string;
  notes?: string;
  archived?: boolean;
}

export interface OrderTotals {
  revenue: Money;
  logistics: Money;
  shaq: Money;
  count: number;
}
