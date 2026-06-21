'use strict';
/**
 * Import + MERGE June 1–20, 2026 orders from up to THREE sources into `orders`:
 *   1) ShaQ manifest .xlsx   -> delivery status, region, city, rider, fee
 *   2) Old CRM CSV export     -> product, quantity, unit price, customer, tracking  (PRIMARY)
 *   3) Old CRM SQL dump       -> same fields (FALLBACK for rows missing from the CSV)
 *
 * Key = numeric id ("SHOPIFY-5573" / "#NA1283" -> "#NA5573"). No dash. No "SHOPIFY-".
 * Idempotent: upsert by order_number, one line item per order. No duplicates.
 *
 *   node migrate/import-june-merge.js <manifest.xlsx> <localhost.sql|-> <export.csv|->
 *      [--dry-run]
 *
 * FR : Importe et fusionne les commandes du 1-20 juin (manifeste + CRM SQL + CRM CSV).
 * EN : Import and merge June 1-20 orders (manifest + CRM SQL + CRM CSV).
 */
const fs = require('fs');
const zlib = require('zlib');
const { pool } = require('../src/database/pool');
const { deliveryFee, tariffGrid } = require('../src/utils/shaqTariff');

// Region names from the ShaQ tariff grid, longest first (so "Bono East" matches
// before "Bono", "Western North" before "Western", etc.).
const REGION_NAMES = tariffGrid().map((r) => r.region).sort((a, b) => b.length - a.length);
// FR : Devine la région à partir d'un texte libre (adresse). EN : Guess region from free text (address).
function regionFromText(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  for (const name of REGION_NAMES) if (t.includes(name.toLowerCase())) return name;
  return null;
}

const JUNE_FROM = '2026-06-01';
const JUNE_TO = '2026-06-22'; // exclusive → includes June 1-21

const numOf = (s) => { const n = parseInt(String(s || '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null; };
// Historical June 1-20 orders KEEP their ShaQ partner_ref "SHOPIFY-<n>" as the
// order_number, so every ShaQ process (webhook, status sync) matches natively.
// New orders (June 21+) use "#NA<n>" via the live Shopify webhook.
const orderNumberOf = (num) => `SHOPIFY-${num}`;
const originRefOf = (num) => `SHOPIFY-${num}`;     // ShaQ partner_ref (dedup marker)
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");

const VALID = new Set(['pending','received','warehouse_received','collected','ready_for_pickup','shipped','assigned','in_transit','dispatched','confirmed','delivered','not_delivered','rescheduled','customer_hold','customer_unreachable','suspected_scam','return_picked','return_in_progress','returned_to_sender','return_to_central','cancelled']);
function normStatus(raw) { const k = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_'); return VALID.has(k) ? k : null; }
const FR_STATUS = { nouveau: 'pending', 'en attente': 'pending', confirmée: 'confirmed', confirmee: 'confirmed', 'en préparation': 'confirmed', 'en preparation': 'confirmed', expédiée: 'shipped', expediee: 'shipped', livrée: 'delivered', livree: 'delivered', annulée: 'cancelled', annulee: 'cancelled', reportée: 'rescheduled', reportee: 'rescheduled' };

function extractTracking(notes) { const s = String(notes || ''); const m = s.match(/packages\/([A-Za-z0-9]+)/i) || s.match(/Tracking:\s*([A-Za-z0-9]+)/i); return m ? m[1] : null; }
function cleanNotes(notes) { if (!notes) return null; const o = String(notes).replace(/Tracking:\s*[A-Za-z0-9]+\s*/i, '').replace(/URL:\s*https?:\/\/\S+/i, '').replace(/\s*\|\s*\|\s*/g, ' | ').replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim(); return o || null; }

// ── 1) ShaQ manifest (.xlsx = ZIP of XML) ────────────────────────────────────
function readZip(file) {
  const buf = fs.readFileSync(file); let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('xlsx invalide');
  let off = buf.readUInt32LE(eocd + 16); const count = buf.readUInt16LE(eocd + 10); const e = {};
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(off + 10), compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30), commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42); const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const lN = buf.readUInt16LE(localOff + 26), lE = buf.readUInt16LE(localOff + 28); const ds = localOff + 30 + lN + lE;
    const raw = buf.subarray(ds, ds + compSize); e[name] = method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return e;
}
function readManifest(file) {
  const e = readZip(file);
  const ss = e['xl/sharedStrings.xml'] ? e['xl/sharedStrings.xml'].toString('utf8') : '';
  const sh = e['xl/worksheets/sheet1.xml'].toString('utf8');
  const strings = []; let m; const siRe = /<si>([\s\S]*?)<\/si>/g;
  while ((m = siRe.exec(ss))) strings.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => dec(x[1])).join(''));
  const c2i = (r) => { let n = 0; for (const ch of r.match(/^[A-Z]+/)[0]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const rows = []; const rRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  while ((m = rRe.exec(sh))) {
    const cells = {}; const cRe = /<c r="([A-Z]+)(\d+)"(?:[^>]*?\st="([^"]+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is><t[^>]*>([\s\S]*?)<\/t><\/is>)?<\/c>/g; let cm;
    while ((cm = cRe.exec(m[1]))) { const col = c2i(cm[1]); let v = cm[4]; if (cm[3] === 's') v = strings[Number(v)]; else if (cm[5] !== undefined) v = dec(cm[5]); cells[col] = v; }
    rows.push(cells);
  }
  const byNum = new Map();
  rows.slice(2).filter((r) => r[0]).forEach((r) => {
    const num = numOf(r[0]); if (num == null) return;
    byNum.set(num, { region: r[1] || null, city: r[2] || null, customerName: r[3] || null, customerPhone: r[4] || null, packageValue: Number(r[5]) || 0, deliveryFee: Number(r[8]) || 0, rider: r[9] || null, status: normStatus(r[10]), comment: r[11] || null, date: r[12] || null });
  });
  return byNum;
}

// ── 2) CRM CSV export ────────────────────────────────────────────────────────
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
function readCsv(file) {
  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  const h = rows.findIndex((r) => r.includes('Commande')); if (h < 0) return new Map();
  const hdr = rows[h]; const C = (n) => hdr.indexOf(n);
  const byNum = new Map();
  rows.slice(h + 1).filter((r) => r[C('Commande')]).forEach((r) => {
    const num = numOf(r[C('Commande')]); if (num == null) return;
    byNum.set(num, {
      customerName: [r[C('Nom')], r[C('Prénom')]].filter(Boolean).join(' ').trim() || null,
      customerEmail: r[C('Email')] || null, customerPhone: r[C('Téléphone')] || null, address: r[C('Adresse')] || null,
      product: r[C('Produit')] || null, quantity: Number(r[C('Quantité')]) || 1, unitPrice: Number(r[C('Prix')]) || 0,
      region: regionFromText(r[C('Adresse')]), frStatus: (r[C('Statut')] || '').toLowerCase().trim(),
      tracking: extractTracking(r[C('Notes')]), notes: cleanNotes(r[C('Notes')]),
      date: r[C('Date')] || null, deliveredAt: r[C('Date Livraison')] || null,
    });
  });
  return byNum;
}

// ── 3) CRM SQL dump (MariaDB `commandes`) ────────────────────────────────────
const BACKSLASH = String.fromCharCode(92);
function parseTuples(s) {
  const rows = []; let i = 0;
  while (i < s.length) {
    if (s[i] !== '(') { i++; continue; }
    i++; const vals = []; let cur = ''; let inStr = false; let isNull = false; let started = false;
    while (i < s.length) {
      const c = s[i];
      if (inStr) { if (c === BACKSLASH) { cur += s[i + 1]; i += 2; continue; } if (c === "'") { inStr = false; i++; continue; } cur += c; i++; continue; }
      if (c === "'") { inStr = true; started = true; i++; continue; }
      if (c === ',') { vals.push(isNull ? null : cur.trim()); cur = ''; isNull = false; started = false; i++; continue; }
      if (c === ')') { vals.push(isNull ? null : cur.trim()); i++; break; }
      cur += c; if (!started && cur.trim().toUpperCase().startsWith('NULL')) isNull = true; i++;
    }
    rows.push(vals);
    while (i < s.length && s[i] !== '(' && s[i] !== ';') i++;
    if (s[i] === ';') break;
  }
  return rows;
}
const CMD_COLS = ['id','commande','nom','prenom','email','telephone','adresse','prix','date_creation','produit','statut','quantite','produit_id','utilisateur','date_modification','frais_livraison','total_ttc','sites','archive','notes','date_report','date_livraison','raison_report'];
function readSqlDump(file) {
  const sql = fs.readFileSync(file, 'utf8');
  let all = []; const re = /INSERT INTO `commandes`[^V]*VALUES/g; let m;
  while ((m = re.exec(sql))) { const start = m.index + m[0].length; const end = sql.indexOf(';\n', start); all = all.concat(parseTuples(sql.slice(start, end < 0 ? sql.length : end))); }
  const byNum = new Map();
  all.map((v) => Object.fromEntries(CMD_COLS.map((c, k) => [c, v[k]]))).forEach((o) => {
    const num = numOf(o.commande); if (num == null) return;
    if (!byNum.has(num)) byNum.set(num, {
      customerName: [o.nom, o.prenom].filter(Boolean).join(' ').trim() || null,
      customerEmail: o.email || null, customerPhone: o.telephone || null, address: o.adresse || null,
      product: o.produit || null, quantity: Number(o.quantite) || 1, unitPrice: Number(o.prix) || 0,
      deliveryFee: Number(o.frais_livraison) || 0, frStatus: (o.statut || '').toLowerCase().trim(),
      tracking: extractTracking(o.notes), notes: cleanNotes(o.notes),
      date: o.date_creation || null, deliveredAt: o.date_livraison || null,
    });
  });
  return byNum;
}

// ── Merge ────────────────────────────────────────────────────────────────────
function mergeOrder(num, shaq, crm) {
  let status = 'pending';
  if (crm && FR_STATUS[crm.frStatus] === 'cancelled') status = 'cancelled';
  else if (shaq && shaq.status) status = shaq.status;
  else if (crm) status = FR_STATUS[crm.frStatus] || 'pending';

  const quantity = crm ? crm.quantity : 1;
  const unitPrice = crm ? crm.unitPrice : (shaq ? shaq.packageValue : 0);
  const orderAmount = crm ? Number((crm.unitPrice * crm.quantity).toFixed(2)) : (shaq ? shaq.packageValue : 0);
  // Region: manifest first, else parsed from the CRM address.
  const region = (shaq && shaq.region) || (crm && crm.region) || null;
  // Delivery fee = ShaQ regional tariff (contract grid). Falls back to the
  // default fee when the region is unknown — never left at 0.
  const deliveryCost = deliveryFee(region);
  const date = (crm && crm.date) || (shaq && shaq.date) || null;
  const deliveredAt = status === 'delivered' ? ((shaq && shaq.date) || (crm && crm.deliveredAt) || date) : null;
  const noteParts = [crm && crm.notes, shaq && shaq.comment, shaq && shaq.rider && `Rider: ${shaq.rider}`, `Origin: ${originRefOf(num)}`].filter(Boolean);

  return {
    orderNumber: orderNumberOf(num),
    shaqTrackingId: (crm && crm.tracking) || originRefOf(num),
    customerName: (crm && crm.customerName) || (shaq && shaq.customerName) || null,
    customerEmail: crm ? crm.customerEmail : null,
    customerPhone: (crm && crm.customerPhone) || (shaq && shaq.customerPhone) || null,
    region,
    city: (shaq && shaq.city) || null,
    address: (crm && crm.address) || null,
    product: crm ? crm.product : null,
    quantity, unitPrice, orderAmount, deliveryCost, status,
    notes: noteParts.join(' | '), orderedAt: date, deliveredAt,
  };
}

async function main() {
  const xlsx = process.argv[2];
  const sqlFile = process.argv[3];
  const csvFile = process.argv[4];
  const dryRun = process.argv.includes('--dry-run');
  if (!xlsx) { console.error('Usage: node migrate/import-june-merge.js <manifest.xlsx> <localhost.sql|-> <export.csv|-> [--dry-run]'); process.exit(1); }

  const shaqByNum = readManifest(xlsx);
  // CRM index: SQL dump first, then CSV overlaid on top (CSV preferred, it's newer/complete).
  const crmByNum = new Map();
  if (sqlFile && sqlFile !== '-') for (const [k, v] of readSqlDump(sqlFile)) crmByNum.set(k, v);
  if (csvFile && csvFile !== '-') for (const [k, v] of readCsv(csvFile)) crmByNum.set(k, v);

  // Order set = manifest (June 1-20 by export) ∪ CRM rows whose date is in June 1-20.
  const allNums = new Set(shaqByNum.keys());
  for (const [num, c] of crmByNum) if (c.date && c.date >= JUNE_FROM && c.date < JUNE_TO) allNums.add(num);

  const orders = [...allNums].sort((a, b) => a - b).map((num) => mergeOrder(num, shaqByNum.get(num), crmByNum.get(num)));
  const withProduct = orders.filter((o) => o.product).length;
  const withTracking = orders.filter((o) => o.shaqTrackingId && !o.shaqTrackingId.startsWith('SHOPIFY-')).length;
  console.log(`Manifeste: ${shaqByNum.size} | CRM (SQL+CSV): ${crmByNum.size}`);
  console.log(`UNION = ${orders.length} | avec produit = ${withProduct} | avec vrai tracking = ${withTracking} | sans produit = ${orders.length - withProduct}`);

  if (dryRun) { console.log('\n[DRY-RUN] aucune écriture.'); await pool.end(); return; }

  let inserted = 0, updated = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const o of orders) {
      const res = await client.query(
        `INSERT INTO orders (order_number, shaq_tracking_id, customer_name, customer_email, customer_phone,
           region, city, delivery_address, order_amount, delivery_cost, delivery_status, notes, ordered_at, delivered_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13::timestamptz, now()), $14::timestamptz, COALESCE($13::timestamptz, now()))
         ON CONFLICT (order_number) DO UPDATE SET
           shaq_tracking_id = EXCLUDED.shaq_tracking_id, customer_name = EXCLUDED.customer_name,
           customer_email = EXCLUDED.customer_email, customer_phone = EXCLUDED.customer_phone,
           region = EXCLUDED.region, city = EXCLUDED.city, delivery_address = EXCLUDED.delivery_address,
           order_amount = EXCLUDED.order_amount, delivery_cost = EXCLUDED.delivery_cost,
           delivery_status = EXCLUDED.delivery_status, notes = EXCLUDED.notes,
           ordered_at = EXCLUDED.ordered_at, delivered_at = EXCLUDED.delivered_at
         RETURNING id, (xmax = 0) AS inserted`,
        [o.orderNumber, o.shaqTrackingId, o.customerName, o.customerEmail, o.customerPhone, o.region, o.city, o.address, o.orderAmount, o.deliveryCost, o.status, o.notes, o.orderedAt, o.deliveredAt]
      );
      if (res.rows[0].inserted) inserted++; else updated++;
      const orderId = res.rows[0].id;
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      await client.query(`INSERT INTO order_items (order_id, product_name, quantity, unit_price) VALUES ($1,$2,$3,$4)`, [orderId, o.product, o.quantity, o.unitPrice]);
    }
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }

  console.log(`\n✅ Terminé : ${inserted} insérée(s), ${updated} mise(s) à jour.`);
  await pool.end();
}

main().catch((err) => { console.error('ÉCHEC:', err.message); process.exit(1); });
