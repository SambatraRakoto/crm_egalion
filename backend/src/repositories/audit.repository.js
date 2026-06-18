'use strict';

const { query } = require('../database/pool');

// FR : Insère une entrée d'audit.
// EN : Insert an audit entry.
async function insert({ userId, action, entityType, entityId, metadata, ip, userAgent }) {
  const sql = `
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`;
  const params = [
    userId || null,
    action,
    entityType || null,
    entityId != null ? String(entityId) : null,
    metadata ? JSON.stringify(metadata) : null,
    ip || null,
    userAgent || null,
  ];
  const { rows } = await query(sql, params);
  return rows[0];
}

// FR : Liste paginée/filtrée du journal d'audit.
// EN : Paginated/filtered audit list.
async function list({ limit, offset, userId, action }) {
  const where = [];
  const params = [];
  let i = 1;
  if (userId) { where.push(`user_id = $${i++}`); params.push(userId); }
  if (action) { where.push(`action = $${i++}`); params.push(action); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await query(`SELECT COUNT(*)::int AS n FROM audit_logs ${whereSql}`, params);
  const rowsRes = await query(
    `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );
  return { total: totalRes.rows[0].n, rows: rowsRes.rows };
}

module.exports = { insert, list };
