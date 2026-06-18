'use strict';
// FR : Routes ShaQ (webhook + flux + suivi).
// EN : ShaQ routes (webhook + flows + tracking).

const express = require('express');
const ctrl = require('../controllers/shaq.controller');
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const verifyWebhook = require('../middleware/verifyWebhook');
const config = require('../config');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// Public webhook — authenticated by HMAC signature, not JWT.
router.post('/webhook', verifyWebhook(() => config.shaq.webhookSecret, 'x-shaq-signature'), ctrl.webhook);

// Regional tariff grid + formula constants (any authenticated user).
router.get('/tariff', authenticate, ctrl.getTariff);

// Internal, authenticated history endpoints.
router.get('/events', authenticate, ctrl.listEvents);
router.get(
  '/orders/:orderId/events',
  authenticate,
  param('orderId').isUUID().withMessage('Identifiant commande invalide'),
  validate,
  ctrl.eventsForOrder
);

// Outbound ShaQ operations (admin / manager).
const canManage = authorize(ROLES.ADMIN, ROLES.MANAGER);
// (1) Send a Shopify/CRM order to ShaQ as a new package.
router.post(
  '/orders/:orderId/ship',
  authenticate,
  canManage,
  param('orderId').isUUID().withMessage('Identifiant commande invalide'),
  validate,
  ctrl.shipOrder
);
// (2) Import packages present in ShaQ into the CRM (deduped by partner_ref).
router.post('/import', authenticate, canManage, ctrl.importPackages);
// (3) Poll ShaQ and update CRM statuses on change.
router.post('/sync-statuses', authenticate, canManage, ctrl.syncStatuses);

module.exports = router;
