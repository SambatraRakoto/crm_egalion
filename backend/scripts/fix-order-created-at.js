'use strict';
// FR : Script ponctuel — corrige orders.created_at depuis l'export CSV Shopify.
// EN : One-off script — fix orders.created_at from the Shopify CSV export.
//
// Compare la colonne "Created at" du CSV (date d'origine) avec orders.created_at
// en base, pour les commandes créées entre deux dates. Si elles diffèrent, met à
// jour UNIQUEMENT created_at — aucune autre colonne n'est touchée.
//
// Usage (sur le VPS) :
//   node scripts/fix-order-created-at.js <fichier.csv> --from 2026-06-01 --to 2026-06-20
//   node scripts/fix-order-created-at.js <fichier.csv> --from 2026-06-01 --to 2026-06-20 --apply
//
// Sans --apply : dry-run, affiche seulement les écarts trouvés (rien n'est écrit).
// Avec --apply : applique réellement les UPDATE en base.
//
// Connexion DB : variables d'environnement standard PG (PGHOST, PGPORT,
// PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE) — déjà utilisées par le backend.

const fs = require('fs');
const { Pool } = require('pg');

// ---------- CLI args ----------
const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--'));
const apply = args.includes('--apply');
const fromArg = args[args.indexOf('--from') + 1];
const toArg = args[args.indexOf('--to') + 1];

if (!csvPath || !fromArg || !toArg) {
  console.error('Usage: node fix-order-created-at.js <fichier.csv> --from YYYY-MM-DD --to YYYY-MM-DD [--apply]');
  process.exit(1);
}

const fromDate = new Date(`${fromArg}T00:00:00.000Z`);
const toDate = new Date(`${toArg}T23:59:59.999Z`);
if (isNaN(fromDate) || isNaN(toDate)) {
  console.error('Dates --from/--to invalides (format attendu : YYYY-MM-DD)');
  process.exit(1);
}

// ---------- CSV parsing (";" delimiter, quoted fields, newlines embedded) ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ';') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Extract the numeric id after the "#NA" / "SHOPIFY-" prefix (both refer to the
// same order — only the digits matter for matching).
function orderDigits(name) {
  const m = String(name || '').match(/(\d+)/);
  return m ? m[1] : null;
}

// "2026-06-20 21:10:22 UTC" -> Date
function parseCsvDate(s) {
  if (!s) return null;
  const cleaned = String(s).trim().replace(/\s+UTC$/i, 'Z').replace(' ', 'T');
  const d = new Date(cleaned);
  return isNaN(d) ? null : d;
}

async function main() {
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(text);
  const header = rows[0];
  const idx = (col) => header.indexOf(col);
  const iName = idx('Name');
  const iCreated = idx('Created at');
  if (iName === -1 || iCreated === -1) {
    console.error('Colonnes "Name" ou "Created at" introuvables dans le CSV.');
    process.exit(1);
  }

  // One row per CSV order (line items repeat the same order — keep the first).
  const csvOrders = new Map(); // digits -> { name, createdAt }
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < header.length) continue;
    const name = row[iName];
    const digits = orderDigits(name);
    if (!digits) continue;
    const createdAt = parseCsvDate(row[iCreated]);
    if (!createdAt) continue;
    if (createdAt < fromDate || createdAt > toDate) continue;
    if (!csvOrders.has(digits)) csvOrders.set(digits, { name, createdAt });
  }

  console.log(`CSV: ${csvOrders.size} commande(s) trouvée(s) entre ${fromArg} et ${toArg}.`);

  const pool = new Pool();
  let checked = 0;
  let mismatched = 0;
  let updated = 0;
  let notFound = 0;

  try {
    for (const [digits, { name, createdAt }] of csvOrders) {
      checked++;
      const { rows: dbRows } = await pool.query(
        `SELECT id, order_number, created_at FROM orders
         WHERE order_number = $1 OR order_number = $2
         LIMIT 1`,
        [`#NA${digits}`, `SHOPIFY-${digits}`]
      );
      const order = dbRows[0];
      if (!order) {
        notFound++;
        console.log(`[NOT FOUND] ${name} (digits=${digits}) — aucune commande correspondante en base.`);
        continue;
      }

      const dbCreatedAt = new Date(order.created_at);
      const sameInstant = dbCreatedAt.getTime() === createdAt.getTime();
      if (sameInstant) continue;

      mismatched++;
      console.log(
        `[MISMATCH] ${order.order_number} (id=${order.id}) — DB: ${dbCreatedAt.toISOString()} | CSV: ${createdAt.toISOString()}`
      );

      if (apply) {
        await pool.query('UPDATE orders SET created_at = $1 WHERE id = $2', [createdAt, order.id]);
        updated++;
      }
    }
  } finally {
    await pool.end();
  }

  console.log('---');
  console.log(`Vérifiées : ${checked}`);
  console.log(`Écarts détectés : ${mismatched}`);
  console.log(`Non trouvées en base : ${notFound}`);
  console.log(apply ? `Mises à jour appliquées : ${updated}` : 'Dry-run — aucune écriture effectuée (relancer avec --apply pour corriger).');
}

main().catch((err) => {
  console.error('Erreur :', err);
  process.exit(1);
});
