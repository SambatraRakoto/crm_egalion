/**
 * Order / delivery status — single source of truth (frontend).
 *
 * The vocabulary mirrors ShaQ Express package statuses 1:1 (see
 * https://public-api.shaqexpress.com) so backend ↔ frontend communication is
 * lossless. `cancelled` is the only non-ShaQ term (Shopify-origin).
 *
 * - canonical status  = the ShaQ slug stored by the backend (e.g. "in_transit")
 * - display label      = human-readable text shown in the UI (e.g. "In Transit")
 * - category           = ShaQ status group (e.g. "Transit & Dispatch")
 */

/** Category (ShaQ group) → ordered list of canonical statuses. */
export const STATUS_GROUPS = {
  'Pending & Collection': ['pending', 'received', 'warehouse_received', 'collected', 'ready_for_pickup'],
  'Transit & Dispatch': ['shipped', 'assigned', 'in_transit', 'dispatched'],
  'Delivery Outcomes': ['confirmed', 'delivered'],
  'Issues & Exceptions': ['not_delivered', 'rescheduled', 'customer_hold', 'customer_unreachable', 'suspected_scam', 'cancelled'],
  Returns: ['return_picked', 'return_in_progress', 'returned_to_sender', 'return_to_central'],
};

/** Canonical status → display label. */
export const CANONICAL_TO_DISPLAY = {
  pending: 'Pending',
  received: 'Received',
  warehouse_received: 'Warehouse Received',
  collected: 'Collected',
  ready_for_pickup: 'Ready for Pickup',
  shipped: 'Shipped',
  assigned: 'Assigned',
  in_transit: 'In Transit',
  dispatched: 'Dispatched',
  confirmed: 'Confirmed',
  delivered: 'Delivered',
  not_delivered: 'Not Delivered',
  rescheduled: 'Rescheduled',
  customer_hold: 'Customer Hold',
  customer_unreachable: 'Customer Unreachable',
  suspected_scam: 'Suspected Scam',
  return_picked: 'Return Picked',
  return_in_progress: 'Return In Progress',
  returned_to_sender: 'Returned to Sender',
  return_to_central: 'Return to Central',
  cancelled: 'Cancelled',
};

/** Display label → canonical status (sent to the API). 1:1 inverse. */
export const DISPLAY_TO_CANONICAL = Object.entries(CANONICAL_TO_DISPLAY).reduce((acc, [slug, label]) => {
  acc[label] = slug;
  return acc;
}, /** @type {Record<string,string>} */ ({}));

/** All canonical statuses (ShaQ + cancelled). */
export const CANONICAL_STATUSES = Object.keys(CANONICAL_TO_DISPLAY);

/** Category name → display labels (used by selects, tabs, bulk menus). */
export const STATUS_CATEGORIES = Object.entries(STATUS_GROUPS).reduce((acc, [cat, slugs]) => {
  acc[cat] = slugs.map((s) => CANONICAL_TO_DISPLAY[s]);
  return acc;
}, /** @type {Record<string,string[]>} */ ({}));

/** Flat list of every display label. */
export const ALL_STATUSES = Object.values(STATUS_CATEGORIES).flat();

/** Display label → category name. */
const STATUS_TO_CATEGORY = Object.entries(STATUS_CATEGORIES).reduce((acc, [cat, labels]) => {
  labels.forEach((l) => {
    acc[l] = cat;
  });
  return acc;
}, /** @type {Record<string,string>} */ ({}));

/** Display label → Tailwind badge classes. */
export const STATUS_COLORS = {
  Pending: 'bg-amber-100 text-amber-700',
  Received: 'bg-amber-100 text-amber-700',
  'Warehouse Received': 'bg-amber-100 text-amber-700',
  Collected: 'bg-sky-100 text-sky-700',
  'Ready for Pickup': 'bg-sky-100 text-sky-700',
  Shipped: 'bg-blue-100 text-blue-700',
  Assigned: 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-blue-100 text-blue-700',
  Dispatched: 'bg-violet-100 text-violet-700',
  Confirmed: 'bg-green-100 text-green-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  'Not Delivered': 'bg-rose-100 text-rose-700',
  Rescheduled: 'bg-orange-100 text-orange-700',
  'Customer Hold': 'bg-orange-100 text-orange-700',
  'Customer Unreachable': 'bg-orange-100 text-orange-700',
  'Suspected Scam': 'bg-red-200 text-red-800',
  Cancelled: 'bg-slate-200 text-slate-700',
  'Return Picked': 'bg-pink-100 text-pink-700',
  'Return In Progress': 'bg-pink-100 text-pink-700',
  'Returned to Sender': 'bg-purple-100 text-purple-700',
  'Return to Central': 'bg-purple-200 text-purple-800',
};

// ─── Category constants + label groups (used by analytics) ────────────────────
export const CATEGORY = {
  PENDING_COLLECTION: 'Pending & Collection',
  TRANSIT_DISPATCH: 'Transit & Dispatch',
  DELIVERY_OUTCOMES: 'Delivery Outcomes',
  ISSUES_EXCEPTIONS: 'Issues & Exceptions',
  RETURNS: 'Returns',
};

/** Labels counted as "successfully delivered" (revenue/collected parity with backend). */
export const DELIVERED_LABELS = ['Delivered'];
/** Labels counted as "in transit or beyond" for the funnel. */
export const IN_TRANSIT_LABELS = ['Shipped', 'Assigned', 'In Transit', 'Dispatched', 'Confirmed', 'Delivered'];
/** Labels counted as "collected or beyond" for the funnel. */
export const COLLECTED_LABELS = ['Collected', 'Ready for Pickup', ...IN_TRANSIT_LABELS];
/** Labels NOT yet assigned (still at intake). */
export const UNASSIGNED_LABELS = ['Pending', 'Received', 'Warehouse Received'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** FR : Libellé affiché → nom de catégorie. EN : Display label → category name. */
export function categoryForStatus(status) {
  return STATUS_TO_CATEGORY[status] || CATEGORY.PENDING_COLLECTION;
}

/** FR : Statut canonique backend → libellé affiché. EN : Backend canonical slug → display label. */
export function displayForCanonical(canonical) {
  return CANONICAL_TO_DISPLAY[canonical] || canonical;
}

/** FR : Libellé affiché → statut canonique envoyé à l'API. EN : Display label → canonical slug sent to the API. */
export function canonicalForDisplay(display) {
  return DISPLAY_TO_CANONICAL[display] || String(display || '').toLowerCase().replace(/[\s-]+/g, '_');
}

/** FR : Classes Tailwind du badge pour un statut affiché. EN : Tailwind badge classes for a display status. */
export function colorForStatus(status) {
  return STATUS_COLORS[status] || 'bg-slate-100 text-slate-600';
}

// ─── Product status (UI label ↔ backend slug) ─────────────────────────────────
export const PRODUCT_STATUS_TO_UI = { active: 'Active', draft: 'Draft', inactive: 'Archived' };
export const PRODUCT_STATUS_TO_API = { Active: 'active', Draft: 'draft', Archived: 'inactive' };

/** FR : Slug statut produit backend → libellé UI. EN : Backend product-status slug → UI label. */
export function productStatusToUi(slug) {
  return PRODUCT_STATUS_TO_UI[slug] || 'Active';
}
/** FR : Libellé UI → slug statut produit backend. EN : UI label → backend product-status slug. */
export function productStatusToApi(label) {
  return PRODUCT_STATUS_TO_API[label] || 'active';
}
