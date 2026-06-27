'use strict';
/**
 * Build a portable SQL file that resets each order's order_amount to the
 * authoritative Shopify "Total" (net of discounts), matched by order number
 * (#NA<n> / SHOPIFY-<n>). Aligns CRM revenue with Shopify "Total sales".
 *
 *   node migrate/gen-fix-amounts.js <shopify_export.csv> [out.sql]
 *
 * FR : Génère le SQL pour restaurer le montant de commande depuis l'export Shopify.
 * EN : Generate SQL to restore order amounts from the Shopify export.
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
  const out = process.argv[3] || 'fix_order_amounts.sql';
  if (!csvFile) { console.error('Usage: node migrate/gen-fix-amounts.js <shopify_export.csv> [out.sql]'); process.exit(1); }

  const rows = parseCSV(fs.readFileSync(csvFile, 'utf8'));
  const h = rows.findIndex((r) => r.includes('Name') && r.includes('Total'));
  if (h < 0) throw new Error('Colonnes "Name"/"Total" introuvables');
  const C = (n) => rows[h].indexOf(n);
  const iName = C('Name'); const iTotal = C('Total');

  const byNum = new Map(); // num -> total (first non-empty per order)
  for (const r of rows.slice(h + 1)) {
    const name = r[iName]; const total = r[iTotal];
    if (!name || total === undefined || String(total).trim() === '') continue;
    const num = numOf(name); if (num == null) continue;
    const val = Number(String(total).trim());
    if (!Number.isFinite(val)) continue;
    if (!byNum.has(num)) byNum.set(num, val.toFixed(2));
  }

  const lines = [
    '-- Restaure order_amount depuis le Total Shopify (net de remise), par numéro.',
    `-- ${byNum.size} commandes.`,
    'BEGIN;',
  ];
  for (const [num, amt] of byNum) {
    lines.push(
      `UPDATE orders SET order_amount = ${amt} ` +
      `WHERE order_number IN ('SHOPIFY-${num}', '#NA${num}');`
    );
  }
  lines.push('COMMIT;', '');
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`✅ ${out} écrit (${byNum.size} commandes).`);
}
main();
