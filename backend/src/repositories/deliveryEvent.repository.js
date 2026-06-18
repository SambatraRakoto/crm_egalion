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
async function list({ limit, offset, trackingId, status }) {
  const where = [];
  const params = [];
  let i = 1;
  if (trackingId) { where.push(`tracking_id = $${i++}`); params.push(trackingId); }
  if (status) { where.push(`status = $${i++}`); params.push(status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await query(`SELECT COUNT(*)::int AS n FROM delivery_events ${whereSql}`, params);
  const rowsRes = await query(
    `SELECT * FROM delivery_events ${whereSql} ORDER BY occurred_at DESC LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );
  return { total: totalRes.rows[0].n, rows: rowsRes.rows };
}

module.exports = { insert, listForOrder, list };
