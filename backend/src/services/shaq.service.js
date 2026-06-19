'use strict';

const orderRepo = require('../repositories/order.repository');
const eventRepo = require('../repositories/deliveryEvent.repository');
const { mapShaqStatus } = require('../utils/shaqStatus');
const { parsePagination } = require('../utils/queryParams');
const shaqClient = require('../utils/shaqClient');
const tariff = require('../utils/shaqTariff');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const pick = (obj, ...keys) => keys.map((k) => obj && obj[k]).find((v) => v !== undefined && v !== null);

/** The ShaQ partner_ref for an order: its order_number, or a generated "#NA-…". */
// FR : Calcule le partner_ref ShaQ d'une commande (#NA-…).
// EN : Compute the ShaQ partner_ref for an order (#NA-…).
function partnerRefFor(order) {
  const prefix = config.shaq.orderRefPrefix;
  if (order.order_number && String(order.order_number).startsWith(prefix)) return order.order_number;
  if (order.order_number) return order.order_number; // keep an existing ref as-is
  return `${prefix}${String(order.id).replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

/**
 * Extract the relevant fields from a ShaQ webhook payload. ShaQ payload shapes
 * vary, so we look in a few likely locations.
 */
// FR : Extrait tracking/statut/date d'un payload webhook ShaQ.
// EN : Extract tracking/status/date from a ShaQ webhook payload.
function parsePayload(body) {
  const trackingId =
    body.tracking_id || body.trackingId || body.waybill || body.reference || (body.data && body.data.tracking_id);
  const rawStatus =
    body.status || body.event || body.state || (body.data && (body.data.status || body.data.state));
  const description = body.description || body.message || body.note || null;
  const occurredAt = body.timestamp || body.occurred_at || body.updated_at || null;
  return { trackingId, rawStatus, description, occurredAt };
}

/**
 * Process an inbound ShaQ delivery update: record the event and, when the status
 * maps to a known internal status, update the matching order automatically.
 */
// FR : Traite un événement de livraison ShaQ (journalise + maj commande).
// EN : Process a ShaQ delivery event (log + update order).
async function handleWebhook(body) {
  const { trackingId, rawStatus, description, occurredAt } = parsePayload(body);
  if (!rawStatus) throw ApiError.badRequest('Statut ShaQ manquant dans le payload');

  const mapped = mapShaqStatus(rawStatus);
  const order = trackingId ? await orderRepo.findByTracking(trackingId) : null;

  // Keep the event log faithful: store the mapped status, or the normalized raw
  // term when unknown (capped to the column width) — never a misleading sentinel.
  const eventStatus = mapped || String(rawStatus).trim().toLowerCase().replace(/[\s-]+/g, '_').slice(0, 30);

  await eventRepo.insert({
    orderId: order ? order.id : null,
    trackingId,
    status: eventStatus,
    rawStatus,
    description,
    payload: body,
    occurredAt: occurredAt ? new Date(occurredAt) : null,
  });

  let updated = false;
  if (order && mapped && mapped !== order.delivery_status) {
    await orderRepo.update(order.id, { deliveryStatus: mapped });
    updated = true;
  } else if (!order) {
    logger.warn(`ShaQ webhook: no order found for tracking ${trackingId}`);
  } else if (!mapped) {
    logger.warn(`ShaQ webhook: unmapped status "${rawStatus}"`);
  }

  // The order's business date comes from ShaQ: align ordered_at with the
  // earliest ShaQ event timestamp for this order (Ghana time via the pool).
  let orderedAt = null;
  if (order) {
    orderedAt = await orderRepo.setOrderedAtFromEvents(order.id);
  }

  return {
    matchedOrder: order ? order.id : null,
    mappedStatus: mapped,
    orderUpdated: updated,
    orderedAt,
  };
}

// FR : Liste paginée des événements de livraison.
// EN : Paginated list of delivery events.
async function listEvents(query) {
  const { page, limit, offset } = parsePagination(query);
  const { total, rows } = await eventRepo.list({
    limit,
    offset,
    trackingId: query.trackingId,
    status: query.status,
  });
  return { rows, page, limit, total };
}

// FR : Événements de livraison d'une commande.
// EN : Delivery events for a single order.
async function eventsForOrder(orderId) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw ApiError.notFound('Commande introuvable');
  return eventRepo.listForOrder(orderId);
}

// ───────────────────────────────────────────────────────────────────────────
// Outbound ShaQ flows (push / pull / poll)
// ───────────────────────────────────────────────────────────────────────────

/**
 * (1) Send a Shopify/CRM order to ShaQ as a new package.
 * Dedup: refuses to send an order that already has a tracking number, and uses
 * the order reference ("#NA-…") as ShaQ's unique `partner_ref`.
 */
// FR : Envoie une commande à ShaQ comme nouveau colis (anti-doublon).
// EN : Send an order to ShaQ as a new package (dedup-safe).
async function sendOrderToShaq(orderId) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw ApiError.notFound('Commande introuvable');
  if (order.shaq_tracking_id) {
    throw ApiError.badRequest(`Commande déjà envoyée à ShaQ (suivi ${order.shaq_tracking_id})`);
  }

  const items = await orderRepo.findItems(orderId);
  const partnerRef = partnerRefFor(order);
  const units = items.reduce((s, it) => s + (Number(it.quantity) || 1), 0) || 1;

  const payload = {
    partner_ref: partnerRef,
    customer_name: order.customer_name || 'Client',
    customer_phone_1: order.customer_phone || '',
    source_country_iso2: config.shaq.sourceCountryIso2,
    source_address_line_1: config.shaq.sourceAddress,
    destination_country_iso2: config.shaq.destCountryIso2,
    destination_region: order.region || '',
    destination_city: order.city || '',
    destination_address_line_1: order.delivery_address || order.city || order.region || partnerRef,
    description: items.map((i) => i.product_name).filter(Boolean).join(', ') || `Commande ${partnerRef}`,
    units,
    type: 'parcel',
    handling: 'normal',
    value: Number(order.order_amount) || 0,
    items: items.map((i) => ({
      name: i.product_name || 'Article',
      quantity: Number(i.quantity) || 1,
      value: Number(i.unit_price) || 0,
    })),
  };

  const resp = await shaqClient.createPackage(payload);
  const data = resp?.data || resp || {};
  const trackingNumber = pick(data, 'trackingNumber', 'tracking_number', 'tracking');
  const status = mapShaqStatus(pick(data, 'status') || 'pending') || 'pending';
  if (!trackingNumber) throw ApiError.internal('ShaQ n\'a pas renvoyé de numéro de suivi');

  await orderRepo.setShaqTracking(orderId, { trackingId: trackingNumber, status, orderNumber: partnerRef });
  logger.info(`ShaQ: order ${partnerRef} sent -> tracking ${trackingNumber}`);
  return { orderId, partnerRef, trackingNumber, status };
}

/** Map a ShaQ package payload (list or detail) to our upsert shape. */
// FR : Mappe un colis ShaQ vers notre forme d'upsert.
// EN : Map a ShaQ package to our upsert shape.
function mapPackage(pkg) {
  const partnerRef = pick(pkg, 'partnerRef', 'partner_ref');
  const trackingNumber = pick(pkg, 'trackingNumber', 'tracking_number', 'tracking');
  const customer = pkg.customer || {};
  return {
    orderNumber: partnerRef,
    shaqTrackingId: trackingNumber,
    customerName: pick(pkg, 'customer_name') || pick(customer, 'name'),
    customerPhone: pick(pkg, 'customer_phone_1', 'customer_phone') || pick(customer, 'phone'),
    customerEmail: pick(pkg, 'customer_email') || pick(customer, 'email'),
    region: pick(pkg, 'destination_region', 'region'),
    city: pick(pkg, 'destination_city', 'city'),
    deliveryAddress: pick(pkg, 'destination_address_line_1', 'destination_address', 'address'),
    orderAmount: Number(pick(pkg, 'value', 'order_amount') || 0),
    // frais_livraison from the ShaQ regional tariff grid.
    deliveryCost: tariff.deliveryFee(pick(pkg, 'destination_region', 'region')),
    deliveryStatus: mapShaqStatus(pick(pkg, 'status') || 'pending') || 'pending',
    orderedAt: pick(pkg, 'created_at', 'createdAt'),
  };
}

/**
 * (2) Import packages from ShaQ into the CRM, keyed by partner_ref ("#NA-…").
 * Upsert guarantees no order is created twice. Walks the paginated endpoint.
 */
// FR : Importe les colis ShaQ dans le CRM (upsert par partner_ref).
// EN : Import ShaQ packages into the CRM (upsert by partner_ref).
async function importPackages({ maxPages = 50, limit = 100 } = {}) {
  if (!shaqClient.configured()) {
    throw ApiError.badRequest('Identifiants ShaQ non configurés');
  }
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (let page = 1; page <= maxPages; page++) {
    const resp = await shaqClient.getPackages({ page, limit });
    const body = resp?.data || resp || {};
    const list = body.list || body.packages || body.items || (Array.isArray(body) ? body : []);
    const meta = body.meta || {};
    if (!list.length) break;

    for (const pkg of list) {
      const mapped = mapPackage(pkg);
      if (!mapped.orderNumber) { skipped++; continue; } // no partner_ref → can't dedup
      const row = await orderRepo.upsertByOrderNumber(mapped);
      if (row && row.inserted) created++;
      else updated++;
    }

    const lastPage = meta.lastPage || meta.last_page;
    if (lastPage && page >= lastPage) break;
    if (list.length < limit && !lastPage) break;
  }
  logger.info(`ShaQ import: ${created} créée(s), ${updated} mise(s) à jour, ${skipped} ignorée(s)`);
  return { created, updated, skipped, imported: created + updated };
}

/**
 * (3) Poll ShaQ for the current status of each tracked order and update the CRM
 * when it changed. A delivery event is recorded only on an actual change, so no
 * duplicate events are produced.
 */
// FR : Sonde ShaQ et met à jour les statuts changés.
// EN : Poll ShaQ and update changed statuses.
async function syncStatuses({ limit = 1000 } = {}) {
  if (!shaqClient.configured()) {
    throw ApiError.badRequest('Identifiants ShaQ non configurés');
  }
  const tracked = await orderRepo.listTracked(limit);
  let checked = 0;
  let changed = 0;
  const errors = [];

  for (const o of tracked) {
    checked++;
    try {
      const resp = await shaqClient.track(o.shaq_tracking_id);
      const data = resp?.data || resp || {};
      const mapped = mapShaqStatus(pick(data, 'status'));
      if (!mapped || mapped === o.delivery_status) continue; // no change → no duplicate event

      await orderRepo.update(o.id, { deliveryStatus: mapped });
      await eventRepo.insert({
        orderId: o.id,
        trackingId: o.shaq_tracking_id,
        status: mapped,
        rawStatus: pick(data, 'status'),
        description: 'Mise à jour via synchronisation ShaQ',
        payload: data,
        occurredAt: pick(data, 'updated_at', 'updatedAt') ? new Date(pick(data, 'updated_at', 'updatedAt')) : null,
      });
      await orderRepo.setOrderedAtFromEvents(o.id);
      changed++;
    } catch (err) {
      errors.push({ order: o.order_number || o.id, error: err.message });
    }
  }
  logger.info(`ShaQ sync statuses: ${checked} vérifiée(s), ${changed} mise(s) à jour`);
  return { checked, changed, errors };
}

/**
 * Catch-up: ship every Pending order that has no tracking yet.
 * Used by the periodic job and the manual endpoint. Each order is shipped with
 * sendOrderToShaq's own dedup guard; failures are isolated (one bad order does
 * not stop the batch).
 */
// FR : Rattrapage — envoie à ShaQ toutes les commandes Pending non expédiées.
// EN : Catch-up — ship every Pending order not yet sent to ShaQ.
async function shipPendingOrders({ limit = 200 } = {}) {
  const pending = await orderRepo.listUnshipped(limit);
  let shipped = 0;
  let failed = 0;
  for (const o of pending) {
    try {
      await sendOrderToShaq(o.id);
      shipped++;
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      // "already sent" shouldn't appear here (filtered by listUnshipped), but stay safe.
      if (/déjà envoyée|already/i.test(msg)) continue;
      failed++;
      logger.warn(`Catch-up ShaQ: order ${o.order_number || o.id} failed: ${msg}`);
    }
  }
  if (pending.length) {
    logger.info(`Catch-up ShaQ: ${shipped} expédiée(s), ${failed} échec(s) sur ${pending.length} en attente`);
  }
  return { attempted: pending.length, shipped, failed };
}

module.exports = {
  handleWebhook,
  listEvents,
  eventsForOrder,
  sendOrderToShaq,
  importPackages,
  syncStatuses,
  shipPendingOrders,
};
