'use strict';

const app = require('./app');
const config = require('./config');
const { pool } = require('./database/pool');
const logger = require('./utils/logger');
const shaqRetry = require('./jobs/shaqRetry');
const shaqStatusSync = require('./jobs/shaqStatusSync');
const shopifyReconcile = require('./jobs/shopifyReconcile');

const server = app.listen(config.port, () => {
  logger.info(`Nuruya CRM API running on http://localhost:${config.port}${config.apiPrefix} [${config.env}]`);
  // FR : Démarre le rattrapage automatique ShaQ. EN : Start the ShaQ auto catch-up job.
  shaqRetry.start();
  // FR : Démarre la synchro périodique des statuts ShaQ (toutes les 5 min).
  // EN : Start the periodic ShaQ status-sync job (every 5 min).
  shaqStatusSync.start();
  // FR : Démarre le filet de reconciliation Shopify. EN : Start the Shopify reconcile safety net.
  shopifyReconcile.start();
});

// FR : Arrêt gracieux du serveur (signaux).
// EN : Graceful server shutdown (signals).
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down...`);
  shaqRetry.stop();
  shaqStatusSync.stop();
  shopifyReconcile.stop();
  server.close(async () => {
    try {
      await pool.end();
      logger.info('Database pool closed. Bye.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', err);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', reason));

module.exports = server;
