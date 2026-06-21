'use strict';
/**
 * Link migrated order_items to products by NAME (case-insensitive), so the
 * finance supplier-cost join (order_items.product_id -> products.supplier_cost)
 * works and the net margin becomes exact.
 *
 * Idempotent. Run AFTER products exist (e.g. on Hostinger after a Shopify sync):
 *   node migrate/relink-order-items.js
 *
 * FR : Relie les lignes de commande aux produits par nom (pour le coût fournisseur).
 * EN : Link order items to products by name (for supplier cost).
 */
const { pool } = require('../src/database/pool');

async function main() {
  const res = await pool.query(`
    UPDATE order_items oi
       SET product_id = p.id
      FROM products p
     WHERE oi.product_id IS NULL
       AND oi.product_name IS NOT NULL
       AND lower(trim(p.name)) = lower(trim(oi.product_name))
  `);
  const { rows: stats } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE product_id IS NOT NULL) AS lies,
      COUNT(*) FILTER (WHERE product_id IS NULL AND product_name IS NOT NULL) AS sans_lien
    FROM order_items
  `);
  const { rows: missing } = await pool.query(`
    SELECT DISTINCT oi.product_name
      FROM order_items oi
     WHERE oi.product_id IS NULL AND oi.product_name IS NOT NULL
     ORDER BY 1 LIMIT 20
  `);
  console.log(`✅ ${res.rowCount} ligne(s) reliée(s).`);
  console.log(`   total liées = ${stats[0].lies} | sans lien (produit absent) = ${stats[0].sans_lien}`);
  if (missing.length) {
    console.log('   noms produits sans correspondance (à créer/synchroniser) :');
    missing.forEach((m) => console.log('     - ' + m.product_name));
  }
  await pool.end();
}
main().catch((e) => { console.error('ÉCHEC:', e.message); process.exit(1); });
