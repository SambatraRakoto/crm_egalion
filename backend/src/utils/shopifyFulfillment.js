'use strict';

const { DELIVERY_STATUS } = require('./constants');

/**
 * Map a Shopify fulfillment to the internal delivery_status.
 * Prefers `shipment_status` (carrier progress); falls back to `status`
 * (fulfillment lifecycle). Returns null if nothing maps.
 * Refs: Shopify Fulfillment.shipment_status / Fulfillment.status.
 */
const SHIPMENT_MAP = {
  label_printed: DELIVERY_STATUS.DISPATCHED,
  label_purchased: DELIVERY_STATUS.DISPATCHED,
  confirmed: DELIVERY_STATUS.CONFIRMED,
  ready_for_pickup: DELIVERY_STATUS.READY_FOR_PICKUP,
  picked_up: DELIVERY_STATUS.COLLECTED,
  in_transit: DELIVERY_STATUS.IN_TRANSIT,
  out_for_delivery: DELIVERY_STATUS.DISPATCHED,
  attempted_delivery: DELIVERY_STATUS.NOT_DELIVERED,
  delivered: DELIVERY_STATUS.DELIVERED,
  failure: DELIVERY_STATUS.NOT_DELIVERED,
};

const STATUS_MAP = {
  pending: DELIVERY_STATUS.PENDING,
  open: DELIVERY_STATUS.IN_TRANSIT,
  success: DELIVERY_STATUS.DELIVERED,
  cancelled: DELIVERY_STATUS.CANCELLED,
  canceled: DELIVERY_STATUS.CANCELLED,
  error: DELIVERY_STATUS.CUSTOMER_HOLD,
  failure: DELIVERY_STATUS.NOT_DELIVERED,
};

// FR : Normalise une valeur de statut (casse/format).
// EN : Normalize a status value (case/format).
function normalize(v) {
  return String(v || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

// FR : Mappe un fulfillment Shopify vers notre statut de livraison.
// EN : Map a Shopify fulfillment to our delivery status.
function mapFulfillment({ shipmentStatus, status } = {}) {
  return SHIPMENT_MAP[normalize(shipmentStatus)] || STATUS_MAP[normalize(status)] || null;
}

module.exports = { mapFulfillment };
