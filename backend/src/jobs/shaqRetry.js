'use strict';
// FR : Tâche périodique de rattrapage — envoie à ShaQ les commandes Pending
//      non encore expédiées (ex. reçues pendant une panne ShaQ).
// EN : Periodic catch-up job — ships to ShaQ the Pending orders not yet sent
//      (e.g. received while ShaQ was down).

const config = require('../config');
const logger = require('../utils/logger');

let timer = null;
let running = false; // prevents overlapping runs

// FR : Un passage de rattrapage (protégé contre le chevauchement).
// EN : One catch-up pass (guarded against overlap).
async function runOnce() {
  if (running) return; // a previous run is still in progress
  running = true;
  try {
    // Lazy require avoids a circular dependency at module load.
    const shaqService = require('../services/shaq.service');
    await shaqService.shipPendingOrders({ limit: 200 });
  } catch (err) {
    logger.warn(`ShaQ catch-up job error: ${err && err.message ? err.message : err}`);
  } finally {
    running = false;
  }
}

// FR : Démarre la tâche (no-op si désactivée ou identifiants ShaQ absents).
// EN : Start the job (no-op if disabled or ShaQ credentials are missing).
function start() {
  const minutes = config.shaq.retryIntervalMinutes;
  const enabled = config.shaq.autoShip && minutes > 0 && config.shaq.identifier && config.shaq.secret;
  if (!enabled) {
    logger.info('ShaQ catch-up job: disabled (autoShip off, no interval, or no credentials)');
    return null;
  }
  const ms = minutes * 60 * 1000;
  // First pass shortly after boot, then every `minutes`.
  setTimeout(runOnce, 30 * 1000);
  timer = setInterval(runOnce, ms);
  if (timer.unref) timer.unref(); // don't keep the process alive just for this
  logger.info(`ShaQ catch-up job: every ${minutes} min`);
  return timer;
}

// FR : Arrête la tâche.
// EN : Stop the job.
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, runOnce };
