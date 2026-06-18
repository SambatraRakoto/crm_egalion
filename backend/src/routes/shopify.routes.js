'use strict';
// FR : Routes Shopify (webhooks + synchronisation).
// EN : Shopify routes (webhooks + sync).

const express = require('express');
const ctrl = require('../controllers/shopify.controller');
const v = require('../validators/shopify.validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const verifyShopifyWebhook = require('../middleware/verifyShopifyWebhook');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// ---- Real-time webhooks (public, authenticated by Shopify HMAC signature) ----
// Register these URLs in Shopify Admin → Settings → Notifications → Webhooks,
// or via the Admin API, for topics: orders/create, orders/updated,
// products/create, products/update. Format JSON.
router.post('/webhooks/orders', verifyShopifyWebhook, ctrl.webhookOrder);
router.post('/webhooks/orders/cancelled', verifyShopifyWebhook, ctrl.webhookOrderCancelled);
router.post('/webhooks/fulfillments', verifyShopifyWebhook, ctrl.webhookFulfillment);
router.post('/webhooks/products', verifyShopifyWebhook, ctrl.webhookProduct);
router.post('/webhooks/inventory', verifyShopifyWebhook, ctrl.webhookInventory);

// ---- Authenticated management & manual sync ----
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER));

router.get('/settings', ctrl.getSettings);
router.put('/settings', v.updateSettings, validate, ctrl.updateSettings);
router.get('/check-connection', ctrl.checkConnection);
router.post('/sync/products', ctrl.syncProducts);
router.post('/sync/orders', ctrl.syncOrders);
router.post('/webhooks/register', ctrl.registerWebhooks);
router.get('/sync/history', ctrl.history); // ?type=products|orders

module.exports = router;
