'use strict';

const { DELIVERY_STATUS_LIST } = require('./constants');

/**
 * Map a ShaQ Express package status to the internal delivery_status.
 *
 * The internal vocabulary now mirrors ShaQ's terms 1:1, so this is essentially a
 * pass-through: we normalize the raw value (case/format-insensitive) and accept
 * it if it is a known status. A small alias table absorbs spelling variants and
 * a few legacy/synonym terms so nothing is silently dropped.
 * Reference: https://public-api.shaqexpress.com (Package Statuses).
 */
const VALID = new Set(DELIVERY_STATUS_LIST);

const ALIASES = {
  // spelling / formatting variants
  canceled: 'cancelled',
  // legacy internal terms (pre-ShaQ-alignment)
  collection: 'collected',
  transit: 'in_transit',
  dispatch: 'dispatched',
  failed_delivery: 'not_delivered',
  delivery_failed: 'not_delivered',
  failed: 'not_delivered',
  returned: 'returned_to_sender',
  // common ShaQ synonyms
  out_for_delivery: 'dispatched',
  picked_up: 'collected',
  unreachable: 'customer_unreachable',
  on_hold: 'customer_hold',
};

// FR : Normalise un statut brut (casse/format).
// EN : Normalize a raw status (case/format).
function normalize(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/** Returns the internal (ShaQ) status, or null if the raw status is unknown. */
// FR : Mappe un statut ShaQ vers notre enum (sinon null).
// EN : Map a ShaQ status to our enum (else null).
function mapShaqStatus(raw) {
  const key = normalize(raw);
  if (VALID.has(key)) return key;
  return ALIASES[key] || null;
}

module.exports = { mapShaqStatus };
