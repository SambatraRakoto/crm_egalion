'use strict';
/**
 * Build a portable SQL file that resets each order's created_at + ordered_at to
 * the authoritative Shopify "Created at" date, matched by order number
 * (#NA<n> / SHOPIFY-<n>). For accurate time-based analytics.
 *
 *   node migrate/gen-fix-dates.js <shopify_export.csv> [out.sql]
 *
 * FR : Génère le SQL pour restaurer la date de commande depuis l'export Shopify.
 * EN : Generate SQL to restore order dates from the Shopify export.
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
// "2026-06-21 13:36:47 UTC" -> "2026-06-21 13:36:47+00"
const toTs = (s) => String(s || '').trim().replace(/\s*UTC$/i, '+00').replace(/\s*GMT$/i, '+00');

function main() {
  const csvFile = process.argv[2];
  const out = process.argv[3] || 'fix_created_dates.sql';
  if (!csvFile) { console.error('Usage: node migrate/gen-fix-dates.js <shopify_export.csv> [out.sql]'); process.exit(1); }

  const rows = parseCSV(fs.readFileSync(csvFile, 'utf8'));
  const h = rows.findIndex((r) => r.includes('Name') && r.includes('Created at'));
  if (h < 0) throw new Error('Colonnes "Name"/"Created at" introuvables');
  const C = (n) => rows[h].indexOf(n);
  const iName = C('Name'); const iDate = C('Created at');

  const byNum = new Map(); // num -> created_at (first non-empty per order)
  for (const r of rows.slice(h + 1)) {
    const name = r[iName]; const date = r[iDate];
    if (!name || !date) continue;
    const num = numOf(name); if (num == null) return;
    if (!byNum.has(num)) byNum.set(num, toTs(date));
  }

  const lines = [
    '-- Restaure created_at + ordered_at depuis la date Shopify (par numéro).',
    `-- ${byNum.size} commandes.`,
    'BEGIN;',
  ];
  for (const [num, ts] of byNum) {
    lines.push(
      `UPDATE orders SET created_at = '${ts}', ordered_at = '${ts}' ` +
      `WHERE order_number IN ('SHOPIFY-${num}', '#NA${num}');`
    );
  }
  lines.push('COMMIT;', '');
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`✅ ${out} écrit (${byNum.size} commandes).`);
  const sample = [...byNum.entries()].slice(0, 3);
  console.log('échantillon:', JSON.stringify(sample));
}
main();
