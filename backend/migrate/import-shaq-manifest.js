'use strict';
/**
 * Import a ShaQ manifest .xlsx into the `orders` table.
 *
 *   node migrate/import-shaq-manifest.js <chemin.xlsx> [--dry-run]
 *
 * - Transforms the Partner Ref  "SHOPIFY-1234"  ->  order_number  "#NA-1234".
 * - Idempotent: upsert by order_number (re-running updates, never duplicates).
 * - Self-contained: reads the .xlsx (a ZIP of XML) with Node's zlib, no deps.
 *
 * FR : Importe un manifeste ShaQ .xlsx dans la table orders (SHOPIFY- -> #NA-).
 * EN : Import a ShaQ manifest .xlsx into the orders table (SHOPIFY- -> #NA-).
 */
const fs = require('fs');
const zlib = require('zlib');
const { pool } = require('../src/database/pool');

// ── Minimal ZIP reader (enough for .xlsx) ────────────────────────────────────
// FR : Extrait les fichiers d'un .xlsx (ZIP) sans dépendance.
// EN : Extract files from an .xlsx (ZIP) without dependencies.
function readZipEntries(file) {
  const buf = fs.readFileSync(file);
  // Locate End Of Central Directory (signature 0x06054b50), scanning from end.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('xlsx invalide (EOCD introuvable)');
  let off = buf.readUInt32LE(eocd + 16); // central directory offset
  const count = buf.readUInt16LE(eocd + 10);
  const entries = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    // Local header: data starts after its own variable-length name/extra fields.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries[name] = method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

// ── Parse the worksheet into rows of cells ───────────────────────────────────
function parseSheet(entries) {
  const ss = entries['xl/sharedStrings.xml'] ? entries['xl/sharedStrings.xml'].toString('utf8') : '';
  const sheet = entries['xl/worksheets/sheet1.xml'].toString('utf8');
  const strings = [];
  let m;
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  while ((m = siRe.exec(ss))) {
    const t = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decode(x[1]));
    strings.push(t.join(''));
  }
  const colToIdx = (ref) => {
    const c = ref.match(/^[A-Z]+/)[0];
    let n = 0; for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  while ((m = rowRe.exec(sheet))) {
    const cells = {};
    const cRe = /<c r="([A-Z]+)(\d+)"(?:[^>]*?\st="([^"]+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is><t[^>]*>([\s\S]*?)<\/t><\/is>)?<\/c>/g;
    let cm;
    while ((cm = cRe.exec(m[1]))) {
      const col = colToIdx(cm[1]); const type = cm[3]; let val = cm[4];
      if (type === 's') val = strings[Number(val)];
      else if (cm[5] !== undefined) val = decode(cm[5]);
      cells[col] = val;
    }
    rows.push(cells);
  }
  return rows;
}

// Valid internal delivery statuses (matches the schema CHECK constraint).
const VALID_STATUS = new Set([
  'pending', 'received', 'warehouse_received', 'collected', 'ready_for_pickup',
  'shipped', 'assigned', 'in_transit', 'dispatched', 'confirmed', 'delivered',
  'not_delivered', 'rescheduled', 'customer_hold', 'customer_unreachable', 'suspected_scam',
  'return_picked', 'return_in_progress', 'returned_to_sender', 'return_to_central', 'cancelled',
]);

// FR : Transforme une ligne du manifeste en commande.
// EN : Transform a manifest row into an order.
function rowToOrder(r) {
  const ref = String(r[0] || '').trim();
  const num = ref.replace(/^SHOPIFY-/i, '');
  const orderNumber = `#NA-${num}`;
  const rawStatus = String(r[10] || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const status = VALID_STATUS.has(rawStatus) ? rawStatus : 'pending';
  const notes = [
    r[11] && String(r[11]).trim(),
    r[9] && `Rider: ${String(r[9]).trim()}`,
    r[7] && `Weight: ${r[7]}kg`,
    `Origin ref: ${ref}`,
  ].filter(Boolean).join(' | ');
  const date = r[12] ? String(r[12]).trim() : null; // "YYYY-MM-DD HH:MM:SS"
  return {
    orderNumber,
    // Already present at ShaQ under its original ref → marks the order "shipped"
    // so the auto-ship / catch-up never re-sends it (dedup by number: if #NA-<n>
    // exists, it's already at ShaQ ⇒ no re-send).
    shaqTrackingId: ref || null,
    customerName: r[3] ? String(r[3]).trim() : null,
    customerPhone: r[4] ? String(r[4]).trim() : null,
    region: r[1] ? String(r[1]).trim() : null,
    city: r[2] ? String(r[2]).trim() : null,
    orderAmount: Number(r[5]) || 0,
    deliveryCost: Number(r[8]) || 0,
    status,
    notes,
    orderedAt: date,
    deliveredAt: status === 'delivered' ? date : null,
  };
}

async function main() {
  const file = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!file) {
    console.error('Usage: node migrate/import-shaq-manifest.js <chemin.xlsx> [--dry-run]');
    process.exit(1);
  }

  const entries = readZipEntries(file);
  const rows = parseSheet(entries);
  // Header is on the 2nd row (index 1); data starts at index 2.
  const data = rows.slice(2).filter((r) => r[0]);
  const orders = data.map(rowToOrder);

  // Status breakdown (sanity).
  const byStatus = {};
  orders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
  console.log(`Lignes parsées : ${orders.length}`);
  console.log('Par statut :', JSON.stringify(byStatus));
  console.log('Exemple :', JSON.stringify(orders[0]));

  if (dryRun) {
    console.log('\n[DRY-RUN] Aucune écriture en base. Retire --dry-run pour importer.');
    await pool.end();
    return;
  }

  let inserted = 0; let updated = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const o of orders) {
      const res = await client.query(
        `INSERT INTO orders (order_number, shaq_tracking_id, customer_name, customer_phone, region, city,
           order_amount, delivery_cost, delivery_status, notes, ordered_at, delivered_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                 COALESCE($11::timestamptz, now()), $12::timestamptz, COALESCE($11::timestamptz, now()))
         ON CONFLICT (order_number) DO UPDATE SET
           shaq_tracking_id = EXCLUDED.shaq_tracking_id,
           customer_name = EXCLUDED.customer_name, customer_phone = EXCLUDED.customer_phone,
           region = EXCLUDED.region, city = EXCLUDED.city, order_amount = EXCLUDED.order_amount,
           delivery_cost = EXCLUDED.delivery_cost, delivery_status = EXCLUDED.delivery_status,
           notes = EXCLUDED.notes, ordered_at = EXCLUDED.ordered_at, delivered_at = EXCLUDED.delivered_at
         RETURNING id, (xmax = 0) AS inserted`,
        [o.orderNumber, o.shaqTrackingId, o.customerName, o.customerPhone, o.region, o.city,
         o.orderAmount, o.deliveryCost, o.status, o.notes, o.orderedAt, o.deliveredAt]
      );
      if (res.rows[0].inserted) inserted++; else updated++;

      // The manifest has no product breakdown → one line item carrying the order
      // value as unit price (quantity 1), so the UNIT PRICE / QTY columns populate.
      const orderId = res.rows[0].id;
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      await client.query(
        `INSERT INTO order_items (order_id, product_name, quantity, unit_price)
         VALUES ($1, NULL, 1, $2)`,
        [orderId, o.orderAmount]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`\n✅ Terminé : ${inserted} insérée(s), ${updated} mise(s) à jour.`);
  await pool.end();
}

main().catch((err) => { console.error('ÉCHEC migration:', err.message); process.exit(1); });
