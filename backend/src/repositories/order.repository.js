'use strict';

const { query, transaction } = require('../database/pool');

const COLUMNS = `id, shopify_order_id, order_number, customer_name, customer_phone,
  customer_email, region, city, delivery_address, order_amount, delivery_cost,
  shaq_cost, payment_method, delivery_status, shaq_tracking_id, notes, archived,
  ordered_at, delivered_at, created_at, updated_at`;

const UPDATABLE = {
  customerName: 'customer_name',
  customerPhone: 'customer_phone',
  customerEmail: 'customer_email',
  region: 'region',
  city: 'city',
  deliveryAddress: 'delivery_address',
  orderAmount: 'order_amount',
  deliveryCost: 'delivery_cost',
  shaqCost: 'shaq_cost',
  paymentMethod: 'payment_method',
  deliveryStatus: 'delivery_status',
  shaqTrackingId: 'shaq_tracking_id',
  notes: 'notes',
  orderedAt: 'ordered_at',
};

// FR : Récupère une commande par id.
// EN : Fetch an order by id.
async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM orders WHERE id = $1`, [id]);
  return rows[0] || null;
}

// FR : Récupère une commande par n° de suivi ShaQ.
// EN : Fetch an order by ShaQ tracking number.
async function findByTracking(trackingId) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM orders WHERE shaq_tracking_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [trackingId]
  );
  return rows[0] || null;
}

/** Orders that have a ShaQ tracking number (for status polling). */
// FR : Commandes suivies (pour le polling de statut).
// EN : Tracked orders (for status polling).
async function listTracked(limit = 1000) {
  const { rows } = await query(
    `SELECT id, order_number, shaq_tracking_id, delivery_status
       FROM orders
      WHERE shaq_tracking_id IS NOT NULL AND shaq_tracking_id NOT LIKE 'SHOPIFY-%' AND archived = FALSE
        AND delivery_status NOT IN ('delivered','returned_to_sender','return_to_central','cancelled')
      ORDER BY updated_at ASC
      LIMIT $1`,
    [limit]
  );
  return rows;
}

// FR : Commandes non encore expédiées vers ShaQ (pour le rattrapage auto).
// EN : Orders not yet shipped to ShaQ (for the auto catch-up job).
async function listUnshipped(limit = 200) {
  const { rows } = await query(
    `SELECT id, order_number
       FROM orders
      WHERE shaq_tracking_id IS NULL AND archived = FALSE
        AND delivery_status NOT IN ('cancelled','delivered','returned_to_sender','return_to_central')
      ORDER BY created_at ASC
      LIMIT $1`,
    [limit]
  );
  return rows;
}

// FR : Récupère une commande par order_number.
// EN : Fetch an order by order_number.
async function findByOrderNumber(orderNumber) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM orders WHERE order_number = $1 LIMIT 1`, [orderNumber]);
  return rows[0] || null;
}

/** Persist the ShaQ tracking number (+ optional status, order_number) on an order. */
// FR : Pose le n° de suivi ShaQ (+ statut/réf).
// EN : Set the ShaQ tracking number (+ status/ref).
async function setShaqTracking(id, { trackingId, status, orderNumber } = {}) {
  const sets = [];
  const params = [id];
  let i = 2;
  if (trackingId !== undefined) { sets.push(`shaq_tracking_id = $${i++}`); params.push(trackingId); }
  if (status) { sets.push(`delivery_status = $${i++}`); params.push(status); }
  if (orderNumber) { sets.push(`order_number = $${i++}`); params.push(orderNumber); }
  if (!sets.length) return findById(id);
  const { rows } = await query(
    `UPDATE orders SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLUMNS}`, params
  );
  return rows[0] || null;
}

/**
 * Import upsert keyed on order_number (== ShaQ partner_ref). Guarantees a single
 * order is never created twice. On conflict, refresh delivery/customer fields but
 * preserve created_at and ordered_at (order date stays ShaQ-sourced).
 */
// FR : Upsert par order_number (anti-doublon import).
// EN : Upsert by order_number (import dedup).
async function upsertByOrderNumber(data) {
  const { rows } = await query(
    `INSERT INTO orders
       (order_number, customer_name, customer_phone, customer_email, region, city,
        delivery_address, order_amount, delivery_cost, delivery_status, shaq_tracking_id, ordered_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,'pending'),$11,COALESCE($12::timestamptz, now()))
     ON CONFLICT (order_number) DO UPDATE SET
       customer_name    = COALESCE(EXCLUDED.customer_name, orders.customer_name),
       customer_phone   = COALESCE(EXCLUDED.customer_phone, orders.customer_phone),
       customer_email   = COALESCE(EXCLUDED.customer_email, orders.customer_email),
       region           = COALESCE(EXCLUDED.region, orders.region),
       city             = COALESCE(EXCLUDED.city, orders.city),
       delivery_address = COALESCE(EXCLUDED.delivery_address, orders.delivery_address),
       order_amount     = COALESCE(NULLIF(EXCLUDED.order_amount, 0), orders.order_amount),
       delivery_cost    = COALESCE(NULLIF(EXCLUDED.delivery_cost, 0), orders.delivery_cost),
       delivery_status  = EXCLUDED.delivery_status,
       shaq_tracking_id = COALESCE(EXCLUDED.shaq_tracking_id, orders.shaq_tracking_id)
     RETURNING ${COLUMNS}, (xmax = 0) AS inserted`,
    [
      data.orderNumber, data.customerName || null, data.customerPhone || null,
      data.customerEmail || null, data.region || null, data.city || null,
      data.deliveryAddress || null, data.orderAmount ?? 0, data.deliveryCost ?? 0,
      data.deliveryStatus || null, data.shaqTrackingId || null, data.orderedAt || null,
    ]
  );
  return rows[0]; // includes `inserted` flag (true = new row, false = updated)
}

// FR : Articles d'une commande.
// EN : Line items of an order.
async function findItems(orderId) {
  const { rows } = await query(
    `SELECT id, product_id, product_name, sku, quantity, unit_price
     FROM order_items WHERE order_id = $1 ORDER BY created_at`,
    [orderId]
  );
  return rows;
}

// FR : Crée une commande et ses articles (transaction).
// EN : Create an order and its items (transaction).
async function create(data) {
  return transaction(async (client) => {
    const orderRes = await client.query(
      `INSERT INTO orders
        (shopify_order_id, order_number, customer_name, customer_phone, customer_email,
         region, city, delivery_address, order_amount, delivery_cost, shaq_cost,
         payment_method, delivery_status, shaq_tracking_id, notes, ordered_at, delivered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text,$14,$15,$16,
               CASE WHEN $13::text = 'delivered' THEN now() ELSE NULL END)
       RETURNING ${COLUMNS}`,
      [
        data.shopifyOrderId || null,
        data.orderNumber || null,
        data.customerName || null,
        data.customerPhone || null,
        data.customerEmail || null,
        data.region || null,
        data.city || null,
        data.deliveryAddress || null,
        data.orderAmount ?? 0,
        data.deliveryCost ?? 0,
        data.shaqCost ?? 0,
        data.paymentMethod || null,
        data.deliveryStatus || 'pending',
        data.shaqTrackingId || null,
        data.notes || null,
        data.orderedAt || null,
      ]
    );
    const order = orderRes.rows[0];

    if (Array.isArray(data.items) && data.items.length) {
      for (const it of data.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [order.id, it.productId || null, it.productName || null, it.sku || null, it.quantity ?? 1, it.unitPrice ?? 0]
        );
      }
    }
    return order;
  });
}

// FR : Met à jour les champs modifiables d'une commande.
// EN : Update an order's editable fields.
async function update(id, data) {
  const sets = [];
  const params = [];
  let i = 1;
  for (const [key, col] of Object.entries(UPDATABLE)) {
    if (data[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      params.push(data[key]);
    }
  }
  // Stamp delivered_at when transitioning to delivered. Prefer the real ShaQ
  // delivery timestamp when the caller provides it; only fall back to now() when
  // no real date is known (never overwrite a real date with a sync-time stamp).
  if (data.deliveryStatus === 'delivered') {
    if (data.deliveredAt) {
      sets.push(`delivered_at = $${i++}`);
      params.push(data.deliveredAt instanceof Date ? data.deliveredAt : new Date(data.deliveredAt));
    } else {
      sets.push(`delivered_at = COALESCE(delivered_at, now())`);
    }
  }
  if (!sets.length) return findById(id);
  params.push(id);
  const { rows } = await query(
    `UPDATE orders SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${COLUMNS}`,
    params
  );
  return rows[0] || null;
}

// FR : Définit l'état archivé.
// EN : Set the archived flag.
async function setArchived(id, archived) {
  const { rows } = await query(
    `UPDATE orders SET archived = $1 WHERE id = $2 RETURNING ${COLUMNS}`,
    [archived, id]
  );
  return rows[0] || null;
}

// FR : Supprime une commande.
// EN : Delete an order.
async function remove(id) {
  const { rowCount } = await query('DELETE FROM orders WHERE id = $1', [id]);
  return rowCount > 0;
}

/**
 * Set the order's business date (ordered_at) from ShaQ: the earliest delivery
 * event timestamp for this order. ShaQ is the source of truth for the order
 * date, so this overrides any Shopify-derived date once ShaQ data exists.
 * No-op if the order has no timestamped events yet.
 */
// FR : Aligne ordered_at sur le 1er événement ShaQ.
// EN : Align ordered_at with the earliest ShaQ event.
async function setOrderedAtFromEvents(orderId) {
  // Only fill ordered_at when it is still unknown (NULL). An order that already
  // has a date (from Shopify or the migration) keeps it — a status update must
  // NEVER change the order/creation date.
  const { rows } = await query(
    `UPDATE orders o
        SET ordered_at = e.min_occurred
       FROM (
         SELECT MIN(occurred_at) AS min_occurred
         FROM delivery_events
         WHERE order_id = $1 AND occurred_at IS NOT NULL
       ) e
      WHERE o.id = $1 AND o.ordered_at IS NULL AND e.min_occurred IS NOT NULL
      RETURNING o.ordered_at`,
    [orderId]
  );
  return rows[0] ? rows[0].ordered_at : null;
}

// ---- Bulk operations ----
// FR : Maj statut en lot.
// EN : Bulk status update.
async function bulkUpdateStatus(ids, status) {
  const { rowCount } = await query(
    // Cast $1 to text explicitly: it is used both as an assignment and in a
    // comparison, which otherwise makes Postgres fail to infer its type.
    `UPDATE orders SET delivery_status = $1::text,
       delivered_at = CASE WHEN $1::text = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END
     WHERE id = ANY($2::uuid[])`,
    [status, ids]
  );
  return rowCount;
}

// FR : Archivage en lot.
// EN : Bulk archive.
async function bulkArchive(ids, archived) {
  const { rowCount } = await query(
    `UPDATE orders SET archived = $1 WHERE id = ANY($2::uuid[])`,
    [archived, ids]
  );
  return rowCount;
}

// FR : Maj notes en lot.
// EN : Bulk notes update.
async function bulkUpdateNotes(ids, notes) {
  const { rowCount } = await query(
    `UPDATE orders SET notes = $1 WHERE id = ANY($2::uuid[])`,
    [notes, ids]
  );
  return rowCount;
}

// FR : Construit la clause WHERE de la liste (paramétrée).
// EN : Build the list WHERE clause (parameterized).
function buildFilters({ search, status, region, city, archived, from, to, paymentMethod }, startIndex = 1) {
  const where = [];
  const params = [];
  let i = startIndex;

  if (search) {
    where.push(`(customer_name ILIKE $${i} OR customer_phone ILIKE $${i} OR customer_email ILIKE $${i} OR order_number ILIKE $${i} OR shaq_tracking_id ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }
  if (status) { where.push(`delivery_status = $${i++}`); params.push(status); }
  if (region) { where.push(`region = $${i++}`); params.push(region); }
  if (city) { where.push(`city = $${i++}`); params.push(city); }
  if (paymentMethod) { where.push(`payment_method = $${i++}`); params.push(paymentMethod); }
  if (archived !== undefined) { where.push(`archived = $${i++}`); params.push(archived); }
  if (from) { where.push(`created_at >= $${i++}`); params.push(from); }
  if (to) { where.push(`created_at <= $${i++}`); params.push(to); }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params, nextIndex: i };
}

// FR : Liste paginée enrichie (1er article).
// EN : Enriched paginated list (first item).
async function list(opts) {
  const { whereSql, params, nextIndex } = buildFilters(opts);
  let i = nextIndex;

  const totalRes = await query(`SELECT COUNT(*)::int AS n FROM orders ${whereSql}`, params);
  // Enrich each row with its first line item (product / quantity / unit price)
  // and the total quantity, so the Orders table can show them without N+1 calls.
  const rowsRes = await query(
    `SELECT ${COLUMNS},
       fi.product_name AS first_product,
       fi.quantity     AS first_quantity,
       fi.unit_price   AS first_unit_price,
       (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = orders.id) AS total_quantity
     FROM orders
     LEFT JOIN LATERAL (
       SELECT product_name, quantity, unit_price
       FROM order_items WHERE order_id = orders.id
       ORDER BY created_at LIMIT 1
     ) fi ON TRUE
     ${whereSql}
     ORDER BY ${opts.sortBy} ${opts.sortDir} LIMIT $${i++} OFFSET $${i++}`,
    [...params, opts.limit, opts.offset]
  );
  return { total: totalRes.rows[0].n, rows: rowsRes.rows };
}

module.exports = {
  findById,
  findByTracking,
  findByOrderNumber,
  listTracked,
  listUnshipped,
  setShaqTracking,
  upsertByOrderNumber,
  findItems,
  create,
  update,
  setArchived,
  setOrderedAtFromEvents,
  remove,
  bulkUpdateStatus,
  bulkArchive,
  bulkUpdateNotes,
  list,
  buildFilters,
  SORTABLE: ['created_at', 'updated_at', 'order_amount', 'delivery_status', 'ordered_at', 'delivered_at'],
};
