'use strict';
/**
 * Reconcile the CRM with a Shopify export: find orders MISSING from the CRM
 * (matched by the NUMBER after the prefix, so "SHOPIFY-<n>" and "#NA<n>" are the
 * same order) and add them. For each missing order:
 *   - if its number is in the ShaQ manifest (already at ShaQ) -> add as
 *     "SHOPIFY-<n>", with the tracking found in the notes (or a marker);
 *   - otherwise (new) -> add as "#NA<n>", no tracking (the catch-up job will
 *     ship it to ShaQ and get a real tracking).
 *
 *   node migrate/reconcile-orders.js <manifest.xlsx> <shopify_export.csv> [--apply]
 *
 * Without --apply it only PREVIEWS (no write). Never touches existing orders
 * (INSERT ... ON CONFLICT (order_number) DO NOTHING) and never changes statuses.
 *
 * FR : Réconcilie le CRM avec l'export Shopify (ajoute les commandes absentes).
 * EN : Reconcile the CRM with the Shopify export (add missing orders).
 */
const fs = require('fs');
const zlib = require('zlib');
const { pool } = require('../src/database/pool');
const { deliveryFee, tariffGrid } = require('../src/utils/shaqTariff');

const numOf = (s) => { const n = parseInt(String(s || '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null; };
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const VALID = new Set(['pending','received','warehouse_received','collected','ready_for_pickup','shipped','assigned','in_transit','dispatched','confirmed','delivered','not_delivered','rescheduled','customer_hold','customer_unreachable','suspected_scam','return_picked','return_in_progress','returned_to_sender','return_to_central','cancelled']);
const normStatus = (raw) => { const k = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_'); return VALID.has(k) ? k : null; };
const extractTracking = (notes) => { const s = String(notes || ''); const m = s.match(/packages\/([A-Za-z0-9]+)/i) || s.match(/Tracking:\s*([A-Za-z0-9]+)/i); return m ? m[1] : null; };
const REGION_NAMES = tariffGrid().map((r) => r.region).sort((a, b) => b.length - a.length);
const regionFromText = (t) => { if (!t) return null; const s = String(t).toLowerCase(); for (const n of REGION_NAMES) if (s.includes(n.toLowerCase())) return n; return null; };

// ── manifest (.xlsx) -> Map<num, {region,city,status,fee,date}> ───────────────
function readZip(file) {
  const buf = fs.readFileSync(file); let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  let off = buf.readUInt32LE(eocd + 16); const count = buf.readUInt16LE(eocd + 10); const e = {};
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(off + 10), cs = buf.readUInt32LE(off + 20), nl = buf.readUInt16LE(off + 28), el = buf.readUInt16LE(off + 30), cl = buf.readUInt16LE(off + 32), lo = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nl); const lN = buf.readUInt16LE(lo + 26), lE = buf.readUInt16LE(lo + 28), ds = lo + 30 + lN + lE;
    const raw = buf.subarray(ds, ds + cs); e[name] = method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw); off += 46 + nl + el + cl;
  }
  return e;
}
function readManifest(file) {
  const e = readZip(file); const ss = e['xl/sharedStrings.xml'] ? e['xl/sharedStrings.xml'].toString('utf8') : ''; const sh = e['xl/worksheets/sheet1.xml'].toString('utf8');
  const strings = []; let m; const siRe = /<si>([\s\S]*?)<\/si>/g; while ((m = siRe.exec(ss))) strings.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => dec(x[1])).join(''));
  const c2i = (r) => { let n = 0; for (const ch of r.match(/^[A-Z]+/)[0]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const rows = []; const rRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  while ((m = rRe.exec(sh))) { const cells = {}; const cRe = /<c r="([A-Z]+)(\d+)"(?:[^>]*?\st="([^"]+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is><t[^>]*>([\s\S]*?)<\/t><\/is>)?<\/c>/g; let cm; while ((cm = cRe.exec(m[1]))) { const col = c2i(cm[1]); let v = cm[4]; if (cm[3] === 's') v = strings[Number(v)]; else if (cm[5] !== undefined) v = dec(cm[5]); cells[col] = v; } rows.push(cells); }
  const byNum = new Map();
  rows.slice(2).filter((r) => r[0]).forEach((r) => { const num = numOf(r[0]); if (num == null) return; byNum.set(num, { region: r[1] || null, city: r[2] || null, status: normStatus(r[10]), fee: Number(r[8]) || 0, date: r[12] || null }); });
  return byNum;
}

// ── Shopify CSV (line items) -> Map<num, order> ───────────────────────────────
function parseCSV(text) {
  const rows = []; let row = []; let cur = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c; }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function readShopify(file) {
  const rows = parseCSV(fs.readFileSync(file, 'utf8')); const h = rows.findIndex((r) => r.includes('Name') && r.includes('Created at')); const C = (n) => rows[h].indexOf(n);
  const get = (r, n) => { const i = C(n); return i >= 0 ? r[i] : ''; };
  const byNum = new Map();
  for (const r of rows.slice(h + 1)) {
    const name = get(r, 'Name'); if (!name) continue; const num = numOf(name); if (num == null) continue;
    let o = byNum.get(num);
    if (!o) { o = { name, num, customer: null, phone: null, email: null, address: null, province: null, product: null, qty: 0, total: 0, date: null, notes: '' };
      byNum.set(num, o); }
    // order-level fields appear on the first row; keep first non-empty.
    o.customer = o.customer || get(r, 'Shipping Name') || get(r, 'Billing Name') || null;
    o.phone = o.phone || get(r, 'Phone') || get(r, 'Shipping Phone') || null;
    o.email = o.email || get(r, 'Email') || null;
    o.address = o.address || get(r, 'Shipping Address1') || get(r, 'Shipping Street') || null;
    o.province = o.province || get(r, 'Shipping Province') || get(r, 'Shipping Province Name') || null;
    o.date = o.date || (get(r, 'Created at') ? String(get(r, 'Created at')).replace(/\s*UTC$/i, '+00') : null);
    if (get(r, 'Total')) o.total = Number(get(r, 'Total')) || o.total;
    if (get(r, 'Notes')) o.notes = o.notes || get(r, 'Notes');
    o.product = o.product || get(r, 'Lineitem name') || null;
    o.qty += Number(get(r, 'Lineitem quantity')) || 0;
  }
  return byNum;
}

async function main() {
  const xlsx = process.argv[2]; const csv = process.argv[3]; const apply = process.argv.includes('--apply');
  if (!xlsx || !csv) { console.error('Usage: node migrate/reconcile-orders.js <manifest.xlsx> <shopify.csv> [--apply]'); process.exit(1); }

  const manifest = readManifest(xlsx);
  const shop = readShopify(csv);
  const existing = new Set((await pool.query("SELECT substring(order_number from '[0-9]+') AS n FROM orders WHERE order_number ~ '[0-9]'")).rows.map((r) => Number(r.n)));

  const toAdd = [];
  for (const [num, o] of shop) {
    if (existing.has(num)) continue; // already in CRM (any prefix) → skip
    const man = manifest.get(num);
    const tracking = extractTracking(o.notes);
    const atShaq = Boolean(man) || Boolean(tracking);
    const region = (man && man.region) || regionFromText(o.province) || regionFromText(o.address) || o.province || null;
    const qty = o.qty > 0 ? o.qty : 1;
    const amount = Number(o.total) || (man ? 0 : 0);
    toAdd.push({
      num,
      orderNumber: man ? `SHOPIFY-${num}` : `#NA${num}`,
      atShaq, isNew: !atShaq,
      customer: o.customer, phone: o.phone, email: o.email, address: o.address,
      region, city: man ? man.city : null,
      product: o.product, quantity: qty,
      orderAmount: amount, unitPrice: qty > 0 ? Number((amount / qty).toFixed(2)) : amount,
      deliveryCost: deliveryFee(region),
      status: man && man.status ? man.status : 'pending',
      trackingId: tracking || (man ? `SHOPIFY-${num}` : null),
      orderedAt: o.date || (man ? man.date : null),
    });
  }

  const shaqCount = toAdd.filter((x) => x.atShaq).length;
  const newCount = toAdd.filter((x) => x.isNew).length;
  console.log(`Shopify: ${shop.size} commandes | déjà en CRM: ${shop.size - toAdd.length} | ABSENTES: ${toAdd.length}`);
  console.log(`  -> déjà chez ShaQ (manifest/tracking) à ajouter en SHOPIFY- : ${shaqCount}`);
  console.log(`  -> nouvelles (pas chez ShaQ) à ajouter en #NA : ${newCount}`);
  console.log('  échantillon:', toAdd.slice(0, 5).map((x) => `${x.orderNumber}(${x.atShaq ? 'shaq' : 'new'})`).join(', '));

  if (!apply) { console.log('\n[APERÇU] rien écrit. Relance avec --apply pour insérer.'); await pool.end(); return; }

  let inserted = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const o of toAdd) {
      const res = await client.query(
        `INSERT INTO orders (order_number, shaq_tracking_id, customer_name, customer_email, customer_phone,
           region, city, delivery_address, order_amount, delivery_cost, delivery_status, ordered_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12::timestamptz, now()),COALESCE($12::timestamptz, now()))
         ON CONFLICT (order_number) DO NOTHING
         RETURNING id`,
        [o.orderNumber, o.trackingId, o.customer, o.email, o.phone, o.region, o.city, o.address, o.orderAmount, o.deliveryCost, o.status, o.orderedAt]
      );
      if (!res.rows[0]) continue; // conflict → skipped
      inserted++;
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
         VALUES ($1, (SELECT id FROM products WHERE lower(trim(name)) = lower(trim($2)) LIMIT 1), $2, $3, $4)`,
        [res.rows[0].id, o.product, o.quantity, o.unitPrice]
      );
    }
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }

  console.log(`\n✅ ${inserted} commande(s) ajoutée(s) (statuts existants non touchés).`);
  await pool.end();
}
main().catch((e) => { console.error('ÉCHEC:', e.message); process.exit(1); });
