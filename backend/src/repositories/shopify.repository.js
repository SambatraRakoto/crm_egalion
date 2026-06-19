'use strict';

const { query, transaction } = require('../database/pool');

// ---- Settings (singleton row id = 1) ----
// FR : Renvoie le singleton de paramètres (sans token).
// EN : Return the settings singleton (no token).
async function getSettings() {
  const { rows } = await query(
    `SELECT id, store_domain, api_version, is_connected, last_synced_at, updated_at,
            (access_token IS NOT NULL AND access_token <> '') AS has_token
     FROM shopify_settings WHERE id = 1`
  );
  return rows[0] || null;
}

// FR : Renvoie les identifiants stockés.
// EN : Return stored credentials.
async function getCredentials() {
  const { rows } = await query(
    `SELECT store_domain, access_token, api_version FROM shopify_settings WHERE id = 1`
  );
  return rows[0] || null;
}

// FR : Insère/maj les paramètres (singleton).
// EN : Insert/update settings (singleton).
async function upsertSettings({ storeDomain, accessToken, apiVersion }) {
  const { rows } = await query(
    `INSERT INTO shopify_settings (id, store_domain, access_token, api_version, updated_at)
     VALUES (1, $1, $2, COALESCE($3, '2024-10'), now())
     ON CONFLICT (id) DO UPDATE SET
       store_domain = COALESCE($1, shopify_settings.store_domain),
       access_token = COALESCE($2, shopify_settings.access_token),
       api_version  = COALESCE($3, shopify_settings.api_version),
       updated_at   = now()
     RETURNING id`,
    [storeDomain || null, accessToken || null, apiVersion || null]
  );
  return rows[0];
}

// FR : Marque l'état de connexion.
// EN : Mark the connection state.
async function setConnected(isConnected) {
  await query('UPDATE shopify_settings SET is_connected = $1, updated_at = now() WHERE id = 1', [isConnected]);
}

// FR : Met à jour l'horodatage de dernière synchro.
// EN : Update the last-synced timestamp.
async function touchLastSynced() {
  await query('UPDATE shopify_settings SET last_synced_at = now() WHERE id = 1');
}

// ---- Sync logs ----
// FR : Crée une entrée de journal de synchro.
// EN : Create a sync-log entry.
async function startLog(syncType) {
  const { rows } = await query(
    `INSERT INTO sync_logs (sync_type, status) VALUES ($1, 'running') RETURNING *`,
    [syncType]
  );
  return rows[0];
}

// FR : Clôture une entrée de journal de synchro.
// EN : Complete a sync-log entry.
async function completeLog(id, { status, recordsProcessed, errorMessage }) {
  const { rows } = await query(
    `UPDATE sync_logs SET status = $1, records_processed = $2, error_message = $3, completed_at = now()
     WHERE id = $4 RETURNING *`,
    [status, recordsProcessed || 0, errorMessage || null, id]
  );
  return rows[0];
}

// FR : Liste paginée des journaux de synchro.
// EN : Paginated sync-log list.
async function listLogs({ limit, offset, syncType }) {
  const params = [];
  let where = '';
  if (syncType) { where = 'WHERE sync_type = $1'; params.push(syncType); }
  const totalRes = await query(`SELECT COUNT(*)::int AS n FROM sync_logs ${where}`, params);
  const rowsRes = await query(
    `SELECT * FROM sync_logs ${where} ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { total: totalRes.rows[0].n, rows: rowsRes.rows };
}

// ---- Upserts from Shopify payloads ----
// FR : Upsert d'un produit Shopify (par shopify_product_id).
// EN : Upsert a Shopify product (by shopify_product_id).
async function upsertProduct(p) {
  await query(
    `INSERT INTO products (shopify_product_id, sku, name, description, category, price,
       stock_quantity, image_url, shopify_inventory_item_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (shopify_product_id) DO UPDATE SET
       sku = EXCLUDED.sku, name = EXCLUDED.name, description = EXCLUDED.description,
       category = EXCLUDED.category, price = EXCLUDED.price,
       stock_quantity = EXCLUDED.stock_quantity, image_url = EXCLUDED.image_url,
       shopify_inventory_item_id = COALESCE(EXCLUDED.shopify_inventory_item_id, products.shopify_inventory_item_id)`,
    [p.shopifyProductId, p.sku, p.name, p.description, p.category, p.price, p.stockQuantity, p.imageUrl,
     p.shopifyInventoryItemId || null]
  );
}

/** Real-time stock update from inventory_levels/update. Returns affected count. */
// FR : Maj du stock par inventory_item_id.
// EN : Update stock by inventory_item_id.
async function setStockByInventoryItem(inventoryItemId, available) {
  const { rowCount } = await query(
    `UPDATE products SET stock_quantity = GREATEST(0, $1) WHERE shopify_inventory_item_id = $2`,
    [available, inventoryItemId]
  );
  return rowCount;
}

/** Update an order's delivery status (and optional tracking) by Shopify order id. */
// FR : Maj statut/tracking par shopify_order_id.
// EN : Update status/tracking by shopify_order_id.
async function setOrderDeliveryByShopifyId(shopifyOrderId, { status, trackingId } = {}) {
  const sets = [];
  const params = [];
  let i = 1;
  if (status) {
    sets.push(`delivery_status = $${i++}`);
    params.push(status);
    sets.push(`delivered_at = CASE WHEN $${i - 1} = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END`);
  }
  if (trackingId) { sets.push(`shaq_tracking_id = COALESCE($${i++}, shaq_tracking_id)`); params.push(trackingId); }
  if (!sets.length) return 0;
  params.push(shopifyOrderId);
  const { rowCount } = await query(
    `UPDATE orders SET ${sets.join(', ')} WHERE shopify_order_id = $${i}`,
    params
  );
  return rowCount;
}

// FR : Upsert d'une commande Shopify (préserve les dates).
// EN : Upsert a Shopify order (preserves dates).
async function upsertOrder(o) {
  // The order's business date and the row's created_at both take Shopify's
  // created_at (in Ghana time, thanks to the per-connection timezone), so the
  // CRM date is identical to Shopify's and analytics buckets stay accurate.
  // On conflict we preserve the original created_at/ordered_at.
  // Order + its line items are written atomically in a single transaction.
  // Returns the order id (used by the webhook to auto-ship to ShaQ).
  return transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO orders (shopify_order_id, order_number, customer_name, customer_phone, customer_email,
         region, city, delivery_address, order_amount, delivery_cost, payment_method, delivery_status,
         ordered_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,'pending'),
               COALESCE($13::timestamptz, now()), COALESCE($13::timestamptz, now()))
       ON CONFLICT (shopify_order_id) DO UPDATE SET
         order_number = EXCLUDED.order_number, customer_name = EXCLUDED.customer_name,
         customer_phone = EXCLUDED.customer_phone, customer_email = EXCLUDED.customer_email,
         region = EXCLUDED.region, city = EXCLUDED.city, delivery_address = EXCLUDED.delivery_address,
         order_amount = EXCLUDED.order_amount, delivery_cost = EXCLUDED.delivery_cost,
         payment_method = EXCLUDED.payment_method
       RETURNING id`,
      [o.shopifyOrderId, o.orderNumber, o.customerName, o.customerPhone, o.customerEmail,
       o.region, o.city, o.deliveryAddress, o.orderAmount, o.deliveryCost ?? 0, o.paymentMethod,
       o.deliveryStatus || null, o.orderedAt || null]
    );
    const orderId = rows[0].id;

    // Replace the line items (idempotent re-sync): drop and re-insert.
    if (Array.isArray(o.items)) {
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      for (const it of o.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price)
           VALUES ($1,
                   (SELECT id FROM products WHERE shopify_product_id = $2),
                   $3, $4, $5, $6)`,
          [orderId, it.shopifyProductId || null, it.productName || null, it.sku || null,
           it.quantity ?? 1, it.unitPrice ?? 0]
        );
      }
    }
    return orderId;
  });
}

module.exports = {
  getSettings,
  getCredentials,
  upsertSettings,
  setConnected,
  touchLastSynced,
  startLog,
  completeLog,
  listLogs,
  upsertProduct,
  upsertOrder,
  setStockByInventoryItem,
  setOrderDeliveryByShopifyId,
};
