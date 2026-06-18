'use strict';

const shaqService = require('../services/shaq.service');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, paginationMeta } = require('../utils/response');
const { AUDIT_ACTION } = require('../utils/constants');
const tariff = require('../utils/shaqTariff');

// Regional delivery tariff grid + financial formula constants.
// FR : GET /shaq/tariff — grille tarifaire ShaQ.
// EN : GET /shaq/tariff — ShaQ tariff grid.
const getTariff = asyncHandler(async (req, res) =>
  success(res, {
    message: 'Grille tarifaire ShaQ',
    data: {
      grid: tariff.tariffGrid(),
      commissionRate: tariff.COMMISSION_RATE, // 0.05 (commission_shaq = prix × 0.05)
      returnRate: tariff.RETURN_RATE, // 0.70 (retours = 70% du coût de livraison)
      currency: 'GHS',
    },
  }));

// FR : POST /shaq/webhook — événement de livraison (HMAC).
// EN : POST /shaq/webhook — delivery event (HMAC).
const webhook = asyncHandler(async (req, res) => {
  const result = await shaqService.handleWebhook(req.body);
  return success(res, { message: 'Événement de livraison traité', data: result });
});

// FR : GET /shaq/events — événements paginés.
// EN : GET /shaq/events — paginated events.
const listEvents = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } = await shaqService.listEvents(req.query);
  return success(res, { message: 'Historique des événements', data: rows, meta: paginationMeta({ page, limit, total }) });
});

// FR : GET /shaq/orders/:id/events — événements d'une commande.
// EN : GET /shaq/orders/:id/events — order events.
const eventsForOrder = asyncHandler(async (req, res) => {
  const events = await shaqService.eventsForOrder(req.params.orderId);
  return success(res, { message: 'Événements de la commande', data: events });
});

// (1) Send a Shopify/CRM order to ShaQ as a new package.
// FR : POST /shaq/orders/:id/ship — envoie la commande à ShaQ.
// EN : POST /shaq/orders/:id/ship — send the order to ShaQ.
const shipOrder = asyncHandler(async (req, res) => {
  const result = await shaqService.sendOrderToShaq(req.params.orderId);
  await auditService.record(req, {
    action: AUDIT_ACTION.SYNC_RUN, entityType: 'shaq', entityId: req.params.orderId,
    metadata: { action: 'ship', tracking: result.trackingNumber },
  });
  return success(res, { status: 201, message: 'Colis créé chez ShaQ', data: result });
});

// (2) Import packages present in ShaQ into the CRM (deduped by partner_ref).
// FR : POST /shaq/import — importe les colis ShaQ.
// EN : POST /shaq/import — import ShaQ packages.
const importPackages = asyncHandler(async (req, res) => {
  const result = await shaqService.importPackages(req.body || {});
  await auditService.record(req, { action: AUDIT_ACTION.SYNC_RUN, entityType: 'shaq', metadata: { action: 'import', ...result } });
  return success(res, { message: 'Import ShaQ terminé', data: result });
});

// (3) Poll ShaQ and update CRM statuses that changed.
// FR : POST /shaq/sync-statuses — synchronise les statuts.
// EN : POST /shaq/sync-statuses — sync statuses.
const syncStatuses = asyncHandler(async (req, res) => {
  const result = await shaqService.syncStatuses(req.body || {});
  await auditService.record(req, { action: AUDIT_ACTION.SYNC_RUN, entityType: 'shaq', metadata: { action: 'sync_statuses', ...result } });
  return success(res, { message: 'Statuts ShaQ synchronisés', data: result });
});

module.exports = { webhook, listEvents, eventsForOrder, getTariff, shipOrder, importPackages, syncStatuses };
