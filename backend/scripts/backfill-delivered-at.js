'use strict';
// FR : Script ponctuel — corrige orders.delivered_at avec la VRAIE date de
//      livraison ShaQ (étape "delivered" de l'historique de suivi), au lieu de
//      la date de sync (now()) qui faussait l'Avg. Delivery Time.
// EN : One-off script — fix orders.delivered_at with the REAL ShaQ delivery date
//      (the "delivered" step of the tracking history), instead of the sync-time
//      now() stamp that skewed the Avg. Delivery Time metric.
//
// Pour chaque commande livrée, on ré-interroge ShaQ (track par numéro de suivi,
// sinon getPackage par partner_ref), on extrait la date de l'étape "delivered"
// et, si elle diffère, on met à jour UNIQUEMENT delivered_at.
//
// Usage (dans le conteneur API) :
//   node scripts/backfill-delivered-at.js              # dry-run, aucune écriture
//   node scripts/backfill-delivered-at.js --apply      # applique les corrections
//   node scripts/backfill-delivered-at.js --apply --limit 50
//
// Connexion DB et identifiants ShaQ via les variables d'env déjà présentes dans
// le conteneur (PG* + SHAQ_*).

const { Pool } = require('pg');
const shaqClient = require('../src/utils/shaqClient');
const { extractDeliveredAt } = require('../src/services/shaq.service');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : 100000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch the full ShaQ record (status + tracking history) for one order. Prefer
// the real tracking number; fall back to partner_ref lookup when absent.
async function fetchShaq(order) {
  const tracking = order.shaq_tracking_id;
  if (tracking && !String(tracking).startsWith('SHOPIFY-')) {
    return shaqClient.track(tracking);
  }
  if (order.order_number) {
    return shaqClient.getPackage(order.order_number);
  }
  return null;
}

async function main() {
  if (!shaqClient.configured()) {
    console.error('Identifiants ShaQ non configurés (SHAQ_IDENTIFIER / SHAQ_SECRET) — impossible de re-fetcher.');
    process.exit(1);
  }

  const pool = new Pool();
  let checked = 0;
  let fixed = 0;
  let unchanged = 0;
  let noDate = 0;
  const errors = [];

  try {
    const { rows: orders } = await pool.query(
      `SELECT id, order_number, shaq_tracking_id, delivered_at
       FROM orders
       WHERE archived = FALSE AND delivery_status = 'delivered'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    console.log(`${orders.length} commande(s) livrée(s) à vérifier (apply=${apply}).`);

    for (const o of orders) {
      checked++;
      try {
        const resp = await fetchShaq(o);
        const realDelivered = extractDeliveredAt(resp);
        if (!realDelivered) {
          noDate++;
          console.log(`[NO DATE] ${o.order_number} — pas d'étape "delivered" datée dans le suivi ShaQ.`);
          continue;
        }
        const current = o.delivered_at ? new Date(o.delivered_at) : null;
        if (current && current.getTime() === realDelivered.getTime()) {
          unchanged++;
          continue;
        }
        console.log(`[FIX] ${o.order_number} — ${current ? current.toISOString() : 'null'} -> ${realDelivered.toISOString()}`);
        if (apply) {
          await pool.query('UPDATE orders SET delivered_at = $1 WHERE id = $2', [realDelivered, o.id]);
          fixed++;
        }
      } catch (err) {
        errors.push({ order: o.order_number || o.id, error: err.message });
        console.log(`[ERROR] ${o.order_number}: ${err.message}`);
      }
      await sleep(150); // be gentle with the ShaQ API
    }
  } finally {
    await pool.end();
  }

  console.log('---');
  console.log(`Vérifiées        : ${checked}`);
  console.log(`Corrigées        : ${apply ? fixed : '(dry-run)'}`);
  console.log(`Déjà correctes   : ${unchanged}`);
  console.log(`Sans date ShaQ   : ${noDate}`);
  console.log(`Erreurs          : ${errors.length}`);
  if (!apply) console.log('Dry-run — relancer avec --apply pour écrire.');
}

main().catch((err) => {
  console.error('Erreur :', err);
  process.exit(1);
});
