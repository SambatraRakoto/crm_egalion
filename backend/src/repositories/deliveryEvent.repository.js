'use strict';

const { query } = require('../database/pool');

// FR : Insère un événement de livraison.
// EN : Insert a delivery event.
async function insert({ orderId, trackingId, status, rawStatus, description, payload, occurredAt }) {
  const { rows } = await query(
    `INSERT INTO delivery_events (order_id, tracking_id, status, raw_status, description, payload, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, now()))
     RETURNING *`,
    [
      orderId || null,
      trackingId || null,
      status,
      rawStatus || null,
      description || null,
      payload ? JSON.stringify(payload) : null,
      occurredAt || null,
    ]
  );
  return rows[0];
}

// FR : Événements d'une commande (récents d'abord).
// EN : Events for an order (most recent first).
async function listForOrder(orderId) {
  const { rows } = await query(
    `SELECT * FROM delivery_events WHERE order_id = $1 ORDER BY occurred_at DESC`,
    [orderId]
  );
  return rows;
}

// FR : Liste paginée/filtrée des événements.
// EN : Paginated/filtered event list.
async function list({ limit, offset, trackingId, status, search, region, from, to }) {
  const where = [];
  const params = [];
  let i = 1;
  if (trackingId) { where.push(`de.tracking_id = $${i++}`); params.push(trackingId); }
  if (status) { where.push(`de.status = $${i++}`); params.push(status); }
  if (region) { where.push(`o.region = $${i++}`); params.push(region); }
  if (from) { where.push(`de.occurred_at >= $${i++}`); params.push(from); }
  if (to) { where.push(`de.occurred_at <= $${i++}`); params.push(to); }
  if (search) {
    where.push(`(de.tracking_id ILIKE $${i} OR o.order_number ILIKE $${i} OR o.customer_name ILIKE $${i})`);
    params.push(`%${search}%`); i++;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  // Join orders so the UI can show the order number / customer / region.
  const base = `FROM delivery_events de LEFT JOIN orders o ON o.id = de.order_id ${whereSql}`;

  const totalRes = await query(`SELECT COUNT(*)::int AS n ${base}`, params);
  const rowsRes = await query(
    `SELECT de.*, o.order_number, o.customer_name, o.region
       ${base} ORDER BY de.occurred_at DESC LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );
  return { total: totalRes.rows[0].n, rows: rowsRes.rows };
}

module.exports = { insert, listForOrder, list };
