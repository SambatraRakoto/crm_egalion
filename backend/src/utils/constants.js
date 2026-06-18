'use strict';

// Role slugs — must match the `roles.slug` column in the database.
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  FINANCE: 'finance',
};

// Delivery statuses — use ShaQ Express package status terms verbatim (1:1) so
// inbound webhook data is received and stored at 100%, with no lossy translation.
// Reference: https://public-api.shaqexpress.com (Package Statuses).
// `cancelled` is the only non-ShaQ term: it comes from the Shopify
// orders/cancelled webhook (ShaQ has no cancellation status).
const DELIVERY_STATUS = {
  // 📦 Pending & Collection
  PENDING: 'pending',
  RECEIVED: 'received',
  WAREHOUSE_RECEIVED: 'warehouse_received',
  COLLECTED: 'collected',
  READY_FOR_PICKUP: 'ready_for_pickup',
  // 🚚 Transit & Dispatch
  SHIPPED: 'shipped',
  ASSIGNED: 'assigned',
  IN_TRANSIT: 'in_transit',
  DISPATCHED: 'dispatched',
  // ✅ Delivery Outcomes
  CONFIRMED: 'confirmed',
  DELIVERED: 'delivered',
  // ⚠️ Issues & Exceptions
  NOT_DELIVERED: 'not_delivered',
  RESCHEDULED: 'rescheduled',
  CUSTOMER_HOLD: 'customer_hold',
  CUSTOMER_UNREACHABLE: 'customer_unreachable',
  SUSPECTED_SCAM: 'suspected_scam',
  // 🔙 Returns
  RETURN_PICKED: 'return_picked',
  RETURN_IN_PROGRESS: 'return_in_progress',
  RETURNED_TO_SENDER: 'returned_to_sender',
  RETURN_TO_CENTRAL: 'return_to_central',
  // Non-ShaQ (Shopify-origin cancellation)
  CANCELLED: 'cancelled',
};

// ShaQ status groups — used for funnels, badges and filters.
const DELIVERY_STATUS_GROUPS = {
  pending_collection: ['pending', 'received', 'warehouse_received', 'collected', 'ready_for_pickup'],
  transit_dispatch: ['shipped', 'assigned', 'in_transit', 'dispatched'],
  delivery_outcomes: ['confirmed', 'delivered'],
  issues_exceptions: ['not_delivered', 'rescheduled', 'customer_hold', 'customer_unreachable', 'suspected_scam', 'cancelled'],
  returns: ['return_picked', 'return_in_progress', 'returned_to_sender', 'return_to_central'],
};

const PRODUCT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft',
};

const STOCK_STATE = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
};

const SYNC_STATUS = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  PARTIAL: 'partial',
};

const AUDIT_ACTION = {
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  ORDER_CREATE: 'order.create',
  ORDER_UPDATE: 'order.update',
  ORDER_DELETE: 'order.delete',
  ORDER_ARCHIVE: 'order.archive',
  ORDER_RESTORE: 'order.restore',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',
  SYNC_RUN: 'sync.run',
};

module.exports = {
  ROLES,
  ROLE_LIST: Object.values(ROLES),
  DELIVERY_STATUS,
  DELIVERY_STATUS_LIST: Object.values(DELIVERY_STATUS),
  DELIVERY_STATUS_GROUPS,
  PRODUCT_STATUS,
  PRODUCT_STATUS_LIST: Object.values(PRODUCT_STATUS),
  STOCK_STATE,
  SYNC_STATUS,
  AUDIT_ACTION,
};
