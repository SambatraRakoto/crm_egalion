'use strict';
/**
 * Build a SQL file that archives CRM orders with NO Shopify counterpart
 * (order_number number absent from the Shopify export), restricted to the date
 * range covered by the export so recent/not-yet-exported orders are never
 * touched. Archiving is reversible (archived = TRUE, no delete).
 *
 *   node migrate/gen-archive-orphans.js <shopify_export.csv> [out.sql]
 *
 * FR : Génère le SQL pour archiver les commandes orphelines (absentes de Shopify).
 * EN : Generate SQL to archive orphan orders (absent from Shopify).
 */
const fs = require('fs');

function parseCSV(text) {
  const rows = []; let row = []; let cur = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const numOf = (s) => { const n = parseInt(String(s || '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null; };

function main() {
  const csvFile = process.argv[2];
  const out = process.argv[3] || 'archive_orphans.sql';
  if (!csvFile) { console.error('Usage: node migrate/gen-archive-orphans.js <shopify_export.csv> [out.sql]'); process.exit(1); }

  const rows = parseCSV(fs.readFileSync(csvFile, 'utf8'));
  const h = rows.findIndex((r) => r.includes('Name') && r.includes('Created at'));
  if (h < 0) throw new Error('Colonnes "Name"/"Created at" introuvables');
  const C = (n) => rows[h].indexOf(n);
  const iName = C('Name'); const iDate = C('Created at'); const iTotal = C('Total');

  const nums = new Set(); let maxDate = '0000-00-00';
  for (const r of rows.slice(h + 1)) {
    if (!r[iName] || String(r[iTotal] || '').trim() === '') continue;
    const num = numOf(r[iName]); if (num != null) nums.add(String(num));
    const d = String(r[iDate] || '').slice(0, 10);
    if (d > maxDate) maxDate = d;
  }
  const list = [...nums].map((n) => `'${n}'`).join(',');
  // Guard: only consider orders dated on/before the export's last day.
  const cond =
    `WHERE NOT archived\n` +
    `  AND COALESCE(ordered_at, created_at)::date <= '${maxDate}'\n` +
    `  AND regexp_replace(COALESCE(order_number, ''), '[^0-9]', '', 'g') NOT IN (${list})`;

  const sql = [
    `-- Archive des commandes orphelines (absentes de l'export Shopify), <= ${maxDate}.`,
    `-- Réf. Shopify valides : ${nums.size}.`,
    '-- 1) APERÇU (ne modifie rien) :',
    `SELECT order_number, customer_name, order_amount,`,
    `       COALESCE(ordered_at, created_at)::date AS date, delivery_status`,
    `  FROM orders`,
    `  ${cond.replace(/\n/g, '\n  ')};`,
    '',
    '-- 2) ARCHIVAGE (réversible : SET archived = FALSE pour annuler) :',
    'BEGIN;',
    `UPDATE orders SET archived = TRUE`,
    `  ${cond.replace(/\n/g, '\n  ')};`,
    'COMMIT;',
    '',
  ].join('\n');
  fs.writeFileSync(out, sql, 'utf8');
  console.log(`✅ ${out} écrit (réf valides: ${nums.size}, plage <= ${maxDate}).`);
}
main();
