'use strict';
/**
 * Import a Shopify "orders export" CSV into the CRM and ensure each order has a
 * ShaQ tracking number:
 *   - if a ShaQ package already exists for the order ref -> reuse its tracking;
 *   - otherwise create the package at ShaQ and store the returned tracking.
 *
 * Orders keep their native Shopify name ("#NA<n>") as order_number (live scheme).
 *
 *   node migrate/import-shopify-csv.js <orders_export.csv> [--dry-run]
 *
 * ShaQ credentials are read from env (SHAQ_IDENTIFIER / SHAQ_SECRET / SHAQ_API_BASE).
 */
const fs = require('fs');
const { pool } = require('../src/database/pool');
const { deliveryFee } = require('../src/utils/shaqTariff');

const SHAQ_BASE = (process.env.SHAQ_API_BASE || 'https://test-partner.shaqexpress.com/api/v1').replace(/\/$/, '');
const SHAQ_ID = process.env.SHAQ_IDENTIFIER;
const SHAQ_SECRET = process.env.SHAQ_SECRET;

// ── ShaQ minimal client ──────────────────────────────────────────────────────
let token = null;
async function shaq(path, { method = 'GET', body } = {}) {
  if (!token) {
    const r = await fetch(`${SHAQ_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: SHAQ_ID, secret: SHAQ_SECRET }) });
    const d = await r.json(); token = d.token || (d.data && d.data.token) || d.accessToken;
    if (!token) throw new Error('ShaQ login failed: ' + JSON.stringify(d).slice(0, 200));
  }
  const r = await fetch(`${SHAQ_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  let d; const t = await r.text(); try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, ok: r.ok, data: d };
}

// ── CSV parsing ──────────────────────────────────────────────────────────────
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
const stateFromNotes = (notes) => { const m = String(notes || '').match(/State:\s*([^\r\n]+)/i); return m ? m[1].trim() : null; };

function readShopifyCsv(file) {
  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  const hdr = rows[0]; const C = (n) => hdr.indexOf(n);
  const orders = [];
  let current = null;
  for (const r of rows.slice(1)) {
    if (!r[C('Name')] && !current) continue;
    if (r[C('Name')]) {
      // New order row.
      current = {
        orderNumber: r[C('Name')],
        customerName: r[C('Shipping Name')] || r[C('Billing Name')] || null,
        customerEmail: r[C('Email')] || null,
        customerPhone: r[C('Shipping Phone')] || r[C('Phone')] || null,
        region: stateFromNotes(r[C('Notes')]) || r[C('Shipping Province Name')] || null,
        city: r[C('Shipping City')] || null,
        address: r[C('Shipping Address1')] || null,
        orderAmount: Number(r[C('Total')]) || 0,
        date: (r[C('Created at')] || '').replace(' UTC', '') || null,
        items: [],
      };
      orders.push(current);
    }
    const name = r[C('Lineitem name')];
    if (name) current.items.push({ name, quantity: Number(r[C('Lineitem quantity')]) || 1, unitPrice: Number(r[C('Lineitem price')]) || 0 });
  }
  return orders;
}

// ── Load all ShaQ packages into a map partnerRef -> {tracking,status,...} ────
async function loadShaqPackages() {
  const map = new Map();
  for (let page = 1; page <= 100; page++) {
    const r = await shaq(`/packages?page=${page}&limit=100`);
    const list = (r.data && r.data.data && r.data.data.list) || [];
    for (const p of list) {
      const ref = p.partnerRef || p.partner_ref;
      if (ref) map.set(ref, { tracking: p.trackingNumber || p.tracking_number, status: p.status || p.currentStatus || 'pending', region: p.destinationRegion || null, city: p.destinationCity || null });
    }
    if (list.length < 100) break;
  }
  return map;
}

// ── Ensure a ShaQ tracking (reuse existing or create) ───────────────────────
async function ensureTracking(o, pkgMap) {
  const existing = pkgMap.get(o.orderNumber);
  if (existing && existing.tracking) {
    if (!o.region && existing.region) o.region = existing.region;
    if (!o.city && existing.city) o.city = existing.city;
    return { tracking: existing.tracking, status: existing.status || 'pending', created: false };
  }
  const units = o.items.reduce((s, it) => s + (it.quantity || 1), 0) || 1;
  const payload = {
    partner_ref: o.orderNumber,
    customer_name: o.customerName || 'Client',
    customer_phone_1: o.customerPhone || '',
    source_country_iso2: 'GH', source_address_line_1: 'Accra, Ghana',
    destination_country_iso2: 'GH', destination_region: o.region || '', destination_city: o.city || '',
    destination_address_line_1: o.address || o.city || o.region || o.orderNumber,
    description: o.items.map((i) => i.name).join(', ') || `Commande ${o.orderNumber}`,
    units, type: 'parcel', handling: 'normal', value: o.orderAmount,
    items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, value: i.unitPrice })),
  };
  const res = await shaq('/packages', { method: 'POST', body: payload });
  if (!res.ok) throw new Error(`createPackage ${o.orderNumber}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  const d = res.data.data || res.data;
  const tracking = d.trackingNumber || d.tracking_number;
  if (!tracking) throw new Error(`ShaQ no tracking for ${o.orderNumber}`);
  return { tracking, status: d.status || 'pending', created: true };
}

async function main() {
  const csv = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!csv) { console.error('Usage: node migrate/import-shopify-csv.js <orders_export.csv> [--dry-run]'); process.exit(1); }
  if (!SHAQ_ID || !SHAQ_SECRET) { console.error('SHAQ_IDENTIFIER / SHAQ_SECRET requis (env).'); process.exit(1); }

  const orders = readShopifyCsv(csv);
  console.log(`Commandes lues: ${orders.length}`);

  const pkgMap = await loadShaqPackages();
  console.log(`Colis ShaQ chargés: ${pkgMap.size}`);

  for (const o of orders) {
    const r = await ensureTracking(o, pkgMap);
    o._tracking = r.tracking; o._status = r.status;
    console.log(`  ${o.orderNumber}  ${o.region || '?'}  -> tracking ${r.tracking} (${r.created ? 'CRÉÉ' : 'existant ShaQ'})`);
  }

  if (dryRun) { console.log('\n[DRY-RUN] aucune écriture DB.'); await pool.end(); return; }

  const client = await pool.connect();
  let inserted = 0, updated = 0;
  try {
    await client.query('BEGIN');
    for (const o of orders) {
      const res = await client.query(
        `INSERT INTO orders (order_number, shaq_tracking_id, customer_name, customer_email, customer_phone,
           region, city, delivery_address, order_amount, delivery_cost, delivery_status, ordered_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12::timestamptz,now()),COALESCE($12::timestamptz,now()))
         ON CONFLICT (order_number) DO UPDATE SET
           shaq_tracking_id = EXCLUDED.shaq_tracking_id, customer_name = EXCLUDED.customer_name,
           customer_email = EXCLUDED.customer_email, customer_phone = EXCLUDED.customer_phone,
           region = EXCLUDED.region, city = EXCLUDED.city, delivery_address = EXCLUDED.delivery_address,
           order_amount = EXCLUDED.order_amount, delivery_cost = EXCLUDED.delivery_cost
         RETURNING id, (xmax = 0) AS inserted`,
        [o.orderNumber, o._tracking, o.customerName, o.customerEmail, o.customerPhone,
         o.region, o.city, o.address, o.orderAmount, deliveryFee(o.region), o._status || 'pending', o.date]
      );
      if (res.rows[0].inserted) inserted++; else updated++;
      const orderId = res.rows[0].id;
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      for (const it of o.items) {
        await client.query('INSERT INTO order_items (order_id, product_name, quantity, unit_price) VALUES ($1,$2,$3,$4)', [orderId, it.name, it.quantity, it.unitPrice]);
      }
    }
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }

  console.log(`\n✅ Terminé : ${inserted} insérée(s), ${updated} mise(s) à jour.`);
  await pool.end();
}
main().catch((e) => { console.error('ÉCHEC:', e.message); process.exit(1); });
