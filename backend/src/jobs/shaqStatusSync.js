'use strict';
// FR : Tâche périodique de suivi — interroge ShaQ pour récupérer l'avancement
//      du statut de chaque commande suivie et met à jour le CRM si changement.
//      Tourne en arrière-plan (toutes les 5 min par défaut). Réutilise la logique
//      existante shaqService.syncStatuses (aucun nouvel algorithme).
// EN : Periodic status-tracking job — polls ShaQ for each tracked order's current
//      status and updates the CRM on change. Runs in the background (every 5 min
//      by default). Reuses the existing shaqService.syncStatuses (no new logic).

const config = require('../config');
const logger = require('../utils/logger');

let timer = null;
let running = false; // prevents overlapping runs

// FR : Un passage de synchronisation des statuts (protégé contre le chevauchement).
// EN : One status-sync pass (guarded against overlap so slow runs don't stack up).
async function runOnce() {
  if (running) return; // a previous run is still in progress
  running = true;
  try {
    // Lazy require avoids a circular dependency at module load.
    const shaqService = require('../services/shaq.service');
    await shaqService.syncStatuses();
  } catch (err) {
    logger.warn(`ShaQ status-sync job error: ${err && err.message ? err.message : err}`);
  } finally {
    running = false;
  }
}

// FR : Démarre la tâche (no-op si désactivée ou identifiants ShaQ absents).
// EN : Start the job (no-op if disabled or ShaQ credentials are missing).
function start() {
  const minutes = config.shaq.statusSyncIntervalMinutes;
  const enabled = minutes > 0 && config.shaq.identifier && config.shaq.secret;
  if (!enabled) {
    logger.info('ShaQ status-sync job: disabled (no interval or no credentials)');
    return null;
  }
  const ms = minutes * 60 * 1000;
  // First pass shortly after boot (offset from the catch-up job's 30s so the two
  // ShaQ jobs don't fire simultaneously), then every `minutes`.
  setTimeout(runOnce, 45 * 1000);
  timer = setInterval(runOnce, ms);
  if (timer.unref) timer.unref(); // don't keep the process alive just for this
  logger.info(`ShaQ status-sync job: every ${minutes} min`);
  return timer;
}

// FR : Arrête la tâche.
// EN : Stop the job.
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, runOnce };
