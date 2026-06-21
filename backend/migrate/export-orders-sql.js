'use strict';
/**
 * Export the local `orders` + `order_items` rows to a portable SQL file that can
 * be loaded into the Hostinger PostgreSQL container. Self-contained: wraps a
 * TRUNCATE (safety) + multi-row INSERTs in a transaction.
 *
 *   node migrate/export-orders-sql.js [outфile]
 */
const fs = require('fs');
const { pool } = require('../src/database/pool');

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildInsert(table, rows) {
  if (!rows.length) return `-- (aucune ligne pour ${table})\n`;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const lines = [];
  // Batch in chunks of 500 rows per INSERT.
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map((r) => `(${cols.map((c) => sqlVal(r[c])).join(', ')})`).join(',\n');
    lines.push(`INSERT INTO ${table} (${colList}) VALUES\n${values};`);
  }
  return lines.join('\n');
}

async function main() {
  const out = process.argv[2] || 'june_orders_export.sql';
  // --orders=#NA6313,#NA6314  -> export only these; implies --append (no TRUNCATE).
  const ordersArg = process.argv.find((a) => a.startsWith('--orders='));
  const onlyNums = ordersArg ? ordersArg.slice('--orders='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;
  const append = onlyNums || process.argv.includes('--append');

  const where = onlyNums ? `WHERE order_number = ANY($1)` : '';
  const params = onlyNums ? [onlyNums] : [];
  const orders = (await pool.query(`SELECT * FROM orders ${where} ORDER BY order_number`, params)).rows;
  const orderIds = orders.map((o) => o.id);
  const items = orderIds.length
    ? (await pool.query('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY order_id, created_at', [orderIds])).rows
    : [];

  // Append mode replaces only the targeted orders (delete then insert) — leaves
  // every other order on the target untouched (no TRUNCATE).
  const head = append
    ? [
        '-- Nuruya CRM — export INCRÉMENTAL (append, sans TRUNCATE).',
        `-- ${orders.length} commandes, ${items.length} lignes.`,
        'BEGIN;',
        `DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number IN (${orders.map((o) => `'${o.order_number.replace(/'/g, "''")}'`).join(', ') || 'NULL'}));`,
        `DELETE FROM orders WHERE order_number IN (${orders.map((o) => `'${o.order_number.replace(/'/g, "''")}'`).join(', ') || 'NULL'});`,
      ]
    : [
        '-- Nuruya CRM — export commandes juin (généré depuis la base locale).',
        `-- ${orders.length} commandes, ${items.length} lignes.`,
        'BEGIN;',
        'TRUNCATE orders, order_items, delivery_events RESTART IDENTITY CASCADE;',
      ];

  const sql = [
    ...head,
    buildInsert('orders', orders),
    buildInsert('order_items', items),
    'COMMIT;',
    '',
  ].join('\n');

  fs.writeFileSync(out, sql, 'utf8');
  console.log(`✅ Export écrit: ${out} (${orders.length} commandes, ${items.length} lignes, ${(sql.length / 1024).toFixed(0)} Ko)`);
  await pool.end();
}
main().catch((e) => { console.error('ÉCHEC:', e.message); process.exit(1); });
