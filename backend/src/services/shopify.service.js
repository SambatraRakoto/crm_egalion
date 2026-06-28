'use strict';

const shopifyRepo = require('../repositories/shopify.repository');
const { createClient } = require('../utils/shopifyClient');
const { mapFulfillment } = require('../utils/shopifyFulfillment');
const { SYNC_STATUS } = require('../utils/constants');
const { deliveryFee } = require('../utils/shaqTariff');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const logger = require('../utils/logger');

// FR : Convertit du HTML (body_html Shopify) en texte brut lisible.
// EN : Convert HTML (Shopify body_html) into readable plain text.
function stripHtml(html) {
  if (!html) return null;
  const text = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    // Numeric HTML entities (e.g. &#9989; → ✅, &#x2705; → ✅).
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}

/** Resolve credentials: DB settings first, env as fallback. */
// FR : Résout les identifiants Shopify (DB puis env).
// EN : Resolve Shopify credentials (DB first, then env).
async function resolveCredentials() {
  const db = await shopifyRepo.getCredentials();
  return {
    storeDomain: (db && db.store_domain) || config.shopify.storeDomain,
    accessToken: (db && db.access_token) || config.shopify.accessToken,
    apiVersion: (db && db.api_version) || config.shopify.apiVersion,
  };
}

// FR : Renvoie les paramètres Shopify (token jamais en clair).
// EN : Return Shopify settings (token never in clear).
async function getSettings() {
  return shopifyRepo.getSettings();
}

// FR : Enregistre les paramètres Shopify.
// EN : Persist Shopify settings.
async function updateSettings(data) {
  await shopifyRepo.upsertSettings(data);
  return shopifyRepo.getSettings();
}

// FR : Teste la connexion à la boutique Shopify.
// EN : Test the connection to the Shopify store.
async function checkConnection() {
  const creds = await resolveCredentials();
  const client = createClient(creds);
  try {
    const { shop } = await client.getShop();
    await shopifyRepo.setConnected(true);
    return { connected: true, shop: { name: shop.name, domain: shop.domain, email: shop.email } };
  } catch (err) {
    await shopifyRepo.setConnected(false);
    throw err;
  }
}

// ---- Mappers from Shopify payloads to our schema ----
// FR : Mappe un produit Shopify vers notre schéma.
// EN : Map a Shopify product to our schema.
function mapProduct(p) {
  const variant = (p.variants && p.variants[0]) || {};
  return {
    shopifyProductId: p.id,
    sku: variant.sku || null,
    name: p.title,
    description: stripHtml(p.body_html),
    category: p.product_type || null,
    price: variant.price ? Number(variant.price) : 0,
    stockQuantity: variant.inventory_quantity != null ? variant.inventory_quantity : 0,
    imageUrl: p.image ? p.image.src : null,
    shopifyInventoryItemId: variant.inventory_item_id || null,
  };
}

// FR : Mappe une commande Shopify vers notre schéma.
// EN : Map a Shopify order to our schema.
function mapOrder(o) {
  const ship = o.shipping_address || o.billing_address || {};
  const customer = o.customer || {};
  const region = ship.province || null;

  // FR : Lignes de commande (produit, quantité, prix unitaire).
  // EN : Order line items (product, quantity, unit price).
  const items = (o.line_items || []).map((li) => ({
    shopifyProductId: li.product_id || null,
    productName: li.title || li.name || null,
    sku: li.sku || null,
    quantity: li.quantity != null ? Number(li.quantity) : 1,
    unitPrice: li.price != null ? Number(li.price) : 0,
  }));

  // FR : Frais de livraison : expédition Shopify si payée, sinon grille ShaQ par région.
  // EN : Delivery fee: Shopify shipping if charged, else ShaQ regional tariff.
  const shopifyShipping = Number(
    (o.total_shipping_price_set && o.total_shipping_price_set.shop_money
      && o.total_shipping_price_set.shop_money.amount)
    ?? (o.shipping_lines || []).reduce((s, l) => s + Number(l.price || 0), 0)
  ) || 0;
  const deliveryCost = shopifyShipping > 0 ? shopifyShipping : deliveryFee(region);

  return {
    shopifyOrderId: o.id,
    orderNumber: o.name || String(o.order_number || ''),
    customerName: ship.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || null,
    customerPhone: ship.phone || o.phone || customer.phone || null,
    customerEmail: o.email || customer.email || null,
    region,
    city: ship.city || null,
    deliveryAddress: [ship.address1, ship.address2].filter(Boolean).join(', ') || null,
    // Net of refunds: current_total_price reflects refunds/edits, so order_amount
    // matches Shopify "Total sales". Falls back to total_price (unrefunded / older
    // payloads). A fully-refunded order yields 0; the Shopify upsert writes it
    // directly so the refund is reflected (orders/updated fires on refund).
    orderAmount: Number(o.current_total_price ?? o.total_price ?? 0) || 0,
    deliveryCost,
    items,
    paymentMethod: (o.payment_gateway_names && o.payment_gateway_names[0]) || o.financial_status || null,
    orderedAt: o.created_at || null,
    // A cancelled order carries cancelled_at; reflect it in the delivery status.
    deliveryStatus: o.cancelled_at ? 'cancelled' : null,
  };
}

// FR : Exécute une synchro générique (fetch → map → upsert) avec journal.
// EN : Run a generic sync (fetch → map → upsert) with logging.
async function runSync(syncType, fetcher, mapper, upsert) {
  const log = await shopifyRepo.startLog(syncType);
  let processed = 0;
  try {
    const creds = await resolveCredentials();
    const client = createClient(creds);
    const items = await fetcher(client);
    for (const item of items) {
      await upsert(mapper(item));
      processed++;
    }
    await shopifyRepo.touchLastSynced();
    return shopifyRepo.completeLog(log.id, { status: SYNC_STATUS.SUCCESS, recordsProcessed: processed });
  } catch (err) {
    logger.error(`Shopify ${syncType} sync failed`, err);
    await shopifyRepo.completeLog(log.id, {
      status: SYNC_STATUS.FAILED,
      recordsProcessed: processed,
      errorMessage: err.message,
    });
    throw err instanceof ApiError ? err : ApiError.internal(`Échec de la synchronisation ${syncType}: ${err.message}`);
  }
}

// FR : Synchronise les produits depuis Shopify.
// EN : Sync products from Shopify.
async function syncProducts() {
  return runSync(
    'products',
    async (c) => (await c.getProducts()).products || [],
    mapProduct,
    (p) => shopifyRepo.upsertProduct(p)
  );
}

// FR : Synchronise les commandes depuis Shopify.
// EN : Sync orders from Shopify.
async function syncOrders() {
  return runSync(
    'orders',
    async (c) => (await c.getOrders()).orders || [],
    mapOrder,
    (o) => shopifyRepo.upsertOrder(o)
  );
}

/**
 * Register the real-time webhooks in Shopify so events are pushed to this API.
 * Idempotent: skips topics already pointing at our endpoints.
 */
// FR : Enregistre les webhooks temps réel chez Shopify (idempotent).
// EN : Register the real-time webhooks in Shopify (idempotent).
async function registerWebhooks() {
  if (!config.publicUrl) {
    throw ApiError.badRequest('APP_PUBLIC_URL non configuré: impossible d\'enregistrer les webhooks Shopify');
  }
  const base = `${config.publicUrl}${config.apiPrefix}/shopify/webhooks`;
  const topics = [
    { topic: 'orders/create', address: `${base}/orders` },
    { topic: 'orders/updated', address: `${base}/orders` },
    { topic: 'orders/cancelled', address: `${base}/orders/cancelled` },
    { topic: 'fulfillments/create', address: `${base}/fulfillments` },
    { topic: 'fulfillments/update', address: `${base}/fulfillments` },
    { topic: 'products/create', address: `${base}/products` },
    { topic: 'products/update', address: `${base}/products` },
    { topic: 'inventory_levels/update', address: `${base}/inventory` },
  ];

  const creds = await resolveCredentials();
  const client = createClient(creds);
  const existing = ((await client.listWebhooks()).webhooks || []).map((w) => `${w.topic}|${w.address}`);

  const results = [];
  for (const t of topics) {
    if (existing.includes(`${t.topic}|${t.address}`)) {
      results.push({ ...t, status: 'already_registered' });
      continue;
    }
    await client.createWebhook(t.topic, t.address);
    results.push({ ...t, status: 'created' });
  }
  logger.info(`Shopify webhooks registered: ${results.map((r) => `${r.topic}=${r.status}`).join(', ')}`);
  return results;
}

// ---- Real-time webhooks (pushed by Shopify on each event) ----

/**
 * Auto-ship an order to ShaQ right after it lands from Shopify.
 * Never throws: a ShaQ failure must NOT make the webhook fail (Shopify would
 * retry endlessly). The order stays un-shipped and can be retried later.
 * Required lazily to avoid a circular dependency (shaq.service ↔ shopify.service).
 */
// FR : Envoie automatiquement une commande à ShaQ (sans jamais faire échouer le webhook).
// EN : Auto-ship an order to ShaQ (never fails the webhook).
async function autoShipToShaq(orderId, mapped) {
  if (!config.shaq.autoShip) return;            // disabled
  if (mapped.deliveryStatus === 'cancelled') return; // never ship a cancelled order
  try {
    const shaqService = require('./shaq.service');
    const res = await shaqService.sendOrderToShaq(orderId);
    logger.info(`Auto-ship ShaQ: order ${mapped.orderNumber} -> tracking ${res.trackingNumber}`);
  } catch (err) {
    // "already sent" (has tracking) is expected on orders/updated re-fires — quiet.
    const msg = err && err.message ? err.message : String(err);
    if (/déjà envoyée|already/i.test(msg)) return;
    logger.warn(`Auto-ship ShaQ failed for order ${mapped.orderNumber}: ${msg}`);
  }
}

/** Upsert a single order received from a Shopify orders/create|updated webhook. */
// FR : Traite un webhook commande create/updated (upsert + envoi auto ShaQ).
// EN : Handle an order create/updated webhook (upsert + auto-ship to ShaQ).
async function handleOrderWebhook(payload) {
  if (!payload || !payload.id) throw ApiError.badRequest('Payload commande Shopify invalide');
  const mapped = mapOrder(payload);
  const orderId = await shopifyRepo.upsertOrder(mapped);
  await shopifyRepo.touchLastSynced();
  logger.info(`Shopify webhook: order ${mapped.shopifyOrderId} (${mapped.orderNumber}) upserted`);
  // Automatic forward to ShaQ (Shopify → CRM → ShaQ). Non-blocking on failure.
  await autoShipToShaq(orderId, mapped);
  return { shopifyOrderId: mapped.shopifyOrderId, orderedAt: mapped.orderedAt };
}

/** Upsert a single product received from a Shopify products/create|update webhook. */
// FR : Traite un webhook produit create/update (upsert).
// EN : Handle a product create/update webhook (upsert).
async function handleProductWebhook(payload) {
  if (!payload || !payload.id) throw ApiError.badRequest('Payload produit Shopify invalide');
  const mapped = mapProduct(payload);
  await shopifyRepo.upsertProduct(mapped);
  await shopifyRepo.touchLastSynced();
  logger.info(`Shopify webhook: product ${mapped.shopifyProductId} (${mapped.name}) upserted`);
  return { shopifyProductId: mapped.shopifyProductId };
}

/**
 * orders/cancelled webhook. Upsert the order, then force its delivery status to
 * 'cancelled' (overrides ShaQ/fulfillment status, since the source order is gone).
 */
// FR : Traite un webhook commande annulée (statut cancelled).
// EN : Handle an order-cancelled webhook (status cancelled).
async function handleOrderCancelled(payload) {
  if (!payload || !payload.id) throw ApiError.badRequest('Payload commande Shopify invalide');
  const mapped = mapOrder(payload);
  await shopifyRepo.upsertOrder(mapped);
  await shopifyRepo.setOrderDeliveryByShopifyId(mapped.shopifyOrderId, { status: 'cancelled' });
  logger.info(`Shopify webhook: order ${mapped.shopifyOrderId} cancelled`);
  // Best-effort: cancel the ShaQ package too (no-op + warning if not shipped or
  // SHAQ_CANCEL_PATH not configured). Never fails the webhook.
  try {
    await require('./shaq.service').cancelShipment(mapped.orderNumber);
  } catch (err) {
    logger.warn(`ShaQ cancel (cancelled webhook) failed: ${err && err.message ? err.message : err}`);
  }
  return { shopifyOrderId: mapped.shopifyOrderId, deliveryStatus: 'cancelled' };
}

/**
 * fulfillments/create|update webhook. Map the carrier shipment status to our
 * delivery status and update the matching order (plus tracking number).
 */
// FR : Traite un webhook fulfillment (statut + tracking).
// EN : Handle a fulfillment webhook (status + tracking).
async function handleFulfillmentWebhook(payload) {
  const shopifyOrderId = payload && (payload.order_id || (payload.fulfillment && payload.fulfillment.order_id));
  if (!shopifyOrderId) throw ApiError.badRequest('order_id manquant dans le payload fulfillment');

  const f = payload.fulfillment || payload;
  const status = mapFulfillment({ shipmentStatus: f.shipment_status, status: f.status });
  const trackingId = f.tracking_number || (Array.isArray(f.tracking_numbers) ? f.tracking_numbers[0] : null);

  const affected = await shopifyRepo.setOrderDeliveryByShopifyId(shopifyOrderId, { status, trackingId });
  logger.info(`Shopify webhook: fulfillment for order ${shopifyOrderId} -> ${status || 'no-map'} (${affected} maj)`);
  return { shopifyOrderId, mappedStatus: status, trackingId, orderUpdated: affected > 0 };
}

/**
 * inventory_levels/update webhook. Update product stock by inventory_item_id.
 * Requires the product to have been synced first (so the item id is known).
 */
// FR : Traite un webhook stock (maj par inventory_item_id).
// EN : Handle an inventory webhook (update by inventory_item_id).
async function handleInventoryWebhook(payload) {
  const inventoryItemId = payload && payload.inventory_item_id;
  const available = payload && payload.available;
  if (!inventoryItemId) throw ApiError.badRequest('inventory_item_id manquant');

  const affected = await shopifyRepo.setStockByInventoryItem(inventoryItemId, Number(available) || 0);
  if (!affected) logger.warn(`Shopify webhook: no product for inventory_item_id ${inventoryItemId}`);
  return { inventoryItemId, available: Number(available) || 0, productUpdated: affected > 0 };
}

// FR : Historique paginé des synchronisations.
// EN : Paginated sync history.
async function history(query) {
  const { parsePagination } = require('../utils/queryParams');
  const { page, limit, offset } = parsePagination(query);
  const { total, rows } = await shopifyRepo.listLogs({ limit, offset, syncType: query.type });
  return { rows, page, limit, total };
}

module.exports = {
  getSettings,
  updateSettings,
  checkConnection,
  syncProducts,
  syncOrders,
  handleOrderWebhook,
  handleOrderCancelled,
  handleFulfillmentWebhook,
  handleInventoryWebhook,
  handleProductWebhook,
  registerWebhooks,
  history,
};
