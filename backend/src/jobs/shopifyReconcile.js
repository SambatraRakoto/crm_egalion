'use strict';
// FR : Filet de sécurité — re-synchronise périodiquement les commandes Shopify
//      récentes (upsert idempotent) pour rattraper tout webhook orders/create
//      manqué. L'envoi à ShaQ est ensuite assuré par le job de rattrapage ShaQ.
// EN : Safety net — periodically re-pull recent Shopify orders (idempotent upsert)
//      to catch any missed orders/create webhook. Shipping to ShaQ is then handled
//      by the ShaQ catch-up job (shipPendingOrders).

const config = require('../config');
const logger = require('../utils/logger');

let timer = null;
let running = false; // prevents overlapping runs

// FR : Un passage de reconciliation (protégé contre le chevauchement).
// EN : One reconcile pass (guarded against overlap).
async function runOnce() {
  if (running) return;
  running = true;
  try {
    // Lazy require avoids any load-order coupling.
    const shopifyService = require('../services/shopify.service');
    const res = await shopifyService.syncOrders();
    logger.debug(`Shopify reconcile: ${JSON.stringify(res)}`);
  } catch (err) {
    logger.warn(`Shopify reconcile job error: ${err && err.message ? err.message : err}`);
  } finally {
    running = false;
  }
}

// FR : Démarre le job (no-op si désactivé ou identifiants Shopify absents).
// EN : Start the job (no-op if disabled or Shopify credentials are missing).
function start() {
  const minutes = config.shopify.reconcileIntervalMinutes;
  const enabled = minutes > 0 && config.shopify.storeDomain && config.shopify.accessToken;
  if (!enabled) {
    logger.info('Shopify reconcile job: disabled (no interval or no credentials)');
    return null;
  }
  const ms = minutes * 60 * 1000;
  // First pass ~1 min after boot, then every `minutes`.
  setTimeout(runOnce, 60 * 1000);
  timer = setInterval(runOnce, ms);
  if (timer.unref) timer.unref(); // don't keep the process alive just for this
  logger.info(`Shopify reconcile job: every ${minutes} min`);
  return timer;
}

// FR : Arrête le job.
// EN : Stop the job.
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, runOnce };
