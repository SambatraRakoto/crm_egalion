'use strict';
/**
 * Backfill the destination region (and city + delivery fee) on CRM orders that
 * have none, using the Shopify export. ShaQ requires destination_region, so
 * orders without it can't be shipped — this fills it from:
 *   1) Note Attributes "State: <region>" (Shopify custom checkout field);
 *   2) Shipping City matched to a regional capital (e.g. Kumasi -> Ashanti);
 *   3) the address / city text.
 * Matches by NUMBER (SHOPIFY-<n> or #NA<n>). Only fills EMPTY regions; never
 * touches status. Without --apply it previews.
 *
 *   node migrate/backfill-regions.js <shopify_export.csv> [--apply]
 *
 * FR : Renseigne la région des commandes qui n'en ont pas (pour l'envoi ShaQ).
 * EN : Backfill the region on orders missing it (so they can ship to ShaQ).
 */
const fs = require('fs');
const { pool } = require('../src/database/pool');
const { deliveryFee, tariffGrid } = require('../src/utils/shaqTariff');

const numOf = (s) => { const n = parseInt(String(s || '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null; };
const grid = tariffGrid();
const REGION_NAMES = grid.map((r) => r.region).sort((a, b) => b.length - a.length);
const CAPITAL_TO_REGION = new Map(grid.map((r) => [String(r.capital || '').toLowerCase(), r.region]));
const regionFromText = (t) => { if (!t) return null; const s = String(t).toLowerCase(); for (const n of REGION_NAMES) if (s.includes(n.toLowerCase())) return n; return null; };
const regionFromCity = (c) => { if (!c) return null; const s = String(c).toLowerCase().trim(); for (const [cap, reg] of CAPITAL_TO_REGION) if (cap && s.includes(cap)) return reg; return null; };

function parseCSV(text) {
  const rows = []; let row = []; let cur = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c; }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function readShopify(file) {
  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  const h = rows.findIndex((r) => r.includes('Name') && r.includes('Created at'));
  const C = (n) => rows[h].indexOf(n);
  const get = (r, n) => { const i = C(n); return i >= 0 ? (r[i] || '') : ''; };
  const byNum = new Map();
  for (const r of rows.slice(h + 1)) {
    const name = get(r, 'Name'); if (!name) continue; const num = numOf(name); if (num == null) continue;
    if (byNum.has(num)) continue; // first row carries the order-level fields
    const na = get(r, 'Note Attributes');
    const stateM = na.match(/State:\s*([^\n\r]+)/i);
    const cityM = na.match(/City:\s*([^\n\r]+)/i);
    const stateRaw = stateM ? stateM[1].trim() : '';
    const city = (get(r, 'Shipping City') || (cityM ? cityM[1].trim() : '')).trim() || null;
    const region =
      regionFromText(stateRaw) ||
      regionFromCity(city) ||
      regionFromText(get(r, 'Shipping Address1')) ||
      regionFromText(na) ||
      (stateRaw || null);
    byNum.set(num, { region, city });
  }
  return byNum;
}

async function main() {
  const csv = process.argv[2]; const apply = process.argv.includes('--apply');
  if (!csv) { console.error('Usage: node migrate/backfill-regions.js <shopify.csv> [--apply]'); process.exit(1); }

  const data = readShopify(csv);
  let resolved = 0; let unresolved = 0;
  for (const v of data.values()) { if (v.region) resolved++; else unresolved++; }
  console.log(`Shopify: ${data.size} commandes | région résolue: ${resolved} | non résolue: ${unresolved}`);
  console.log('  échantillon:', [...data.entries()].slice(0, 6).map(([n, v]) => `${n}->${v.region || '?'}`).join(', '));

  if (!apply) { console.log('\n[APERÇU] rien écrit. Relance avec --apply pour mettre à jour.'); await pool.end(); return; }

  let updated = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [num, v] of data) {
      if (!v.region) continue;
      const res = await client.query(
        `UPDATE orders
            SET region = $1,
                city = COALESCE(NULLIF($2,''), city),
                delivery_cost = $3
          WHERE order_number IN ($4, $5)
            AND (region IS NULL OR region = '')`,
        [v.region, v.city, deliveryFee(v.region), `SHOPIFY-${num}`, `#NA${num}`]
      );
      updated += res.rowCount;
    }
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }

  console.log(`\n✅ ${updated} commande(s) mise(s) à jour (région + frais). Statuts intacts.`);
  console.log('   -> relance ensuite l\'envoi/rattrapage ShaQ pour les expédier.');
  await pool.end();
}
main().catch((e) => { console.error('ÉCHEC:', e.message); process.exit(1); });
