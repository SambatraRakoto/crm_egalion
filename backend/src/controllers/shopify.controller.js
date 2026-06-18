'use strict';

const shopifyService = require('../services/shopify.service');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, paginationMeta } = require('../utils/response');
const { AUDIT_ACTION } = require('../utils/constants');

// FR : GET /shopify/settings — paramètres.
// EN : GET /shopify/settings — settings.
const getSettings = asyncHandler(async (req, res) =>
  success(res, { message: 'Paramètres Shopify', data: await shopifyService.getSettings() }));

// FR : PUT /shopify/settings — enregistre les paramètres.
// EN : PUT /shopify/settings — save settings.
const updateSettings = asyncHandler(async (req, res) => {
  const data = await shopifyService.updateSettings(req.body);
  return success(res, { message: 'Paramètres Shopify enregistrés', data });
});

// FR : GET /shopify/check-connection — teste la connexion.
// EN : GET /shopify/check-connection — test connection.
const checkConnection = asyncHandler(async (req, res) => {
  const data = await shopifyService.checkConnection();
  return success(res, { message: 'Connexion Shopify vérifiée', data });
});

// FR : POST /shopify/sync/products — synchronise les produits.
// EN : POST /shopify/sync/products — sync products.
const syncProducts = asyncHandler(async (req, res) => {
  const log = await shopifyService.syncProducts();
  await auditService.record(req, { action: AUDIT_ACTION.SYNC_RUN, entityType: 'shopify', metadata: { type: 'products' } });
  return success(res, { message: 'Synchronisation des produits terminée', data: log });
});

// FR : POST /shopify/sync/orders — synchronise les commandes.
// EN : POST /shopify/sync/orders — sync orders.
const syncOrders = asyncHandler(async (req, res) => {
  const log = await shopifyService.syncOrders();
  await auditService.record(req, { action: AUDIT_ACTION.SYNC_RUN, entityType: 'shopify', metadata: { type: 'orders' } });
  return success(res, { message: 'Synchronisation des commandes terminée', data: log });
});

// Webhooks must return 2xx fast so Shopify doesn't retry; processing is quick (single upsert).
// FR : Webhook commande Shopify (create/updated).
// EN : Shopify order webhook (create/updated).
const webhookOrder = asyncHandler(async (req, res) => {
  const data = await shopifyService.handleOrderWebhook(req.body);
  return success(res, { message: 'Commande synchronisée', data });
});

// FR : Webhook produit Shopify.
// EN : Shopify product webhook.
const webhookProduct = asyncHandler(async (req, res) => {
  const data = await shopifyService.handleProductWebhook(req.body);
  return success(res, { message: 'Produit synchronisé', data });
});

// FR : Webhook commande annulée Shopify.
// EN : Shopify order-cancelled webhook.
const webhookOrderCancelled = asyncHandler(async (req, res) => {
  const data = await shopifyService.handleOrderCancelled(req.body);
  return success(res, { message: 'Commande annulée synchronisée', data });
});

// FR : Webhook fulfillment Shopify.
// EN : Shopify fulfillment webhook.
const webhookFulfillment = asyncHandler(async (req, res) => {
  const data = await shopifyService.handleFulfillmentWebhook(req.body);
  return success(res, { message: 'Fulfillment synchronisé', data });
});

// FR : Webhook stock Shopify.
// EN : Shopify inventory webhook.
const webhookInventory = asyncHandler(async (req, res) => {
  const data = await shopifyService.handleInventoryWebhook(req.body);
  return success(res, { message: 'Stock synchronisé', data });
});

// FR : POST /shopify/webhooks/register — enregistre les webhooks.
// EN : POST /shopify/webhooks/register — register webhooks.
const registerWebhooks = asyncHandler(async (req, res) => {
  const data = await shopifyService.registerWebhooks();
  await auditService.record(req, { action: AUDIT_ACTION.SYNC_RUN, entityType: 'shopify', metadata: { action: 'register_webhooks' } });
  return success(res, { message: 'Webhooks Shopify enregistrés', data });
});

// FR : GET /shopify/sync/history — historique de synchro.
// EN : GET /shopify/sync/history — sync history.
const history = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } = await shopifyService.history(req.query);
  return success(res, { message: 'Historique des synchronisations', data: rows, meta: paginationMeta({ page, limit, total }) });
});

module.exports = {
  getSettings, updateSettings, checkConnection, syncProducts, syncOrders,
  webhookOrder, webhookProduct, webhookOrderCancelled, webhookFulfillment, webhookInventory,
  registerWebhooks, history,
};
