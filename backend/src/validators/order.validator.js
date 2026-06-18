'use strict';
// FR : Règles de validation des entrées commandes.
// EN : Validation rules for order inputs.

const { body, param, query } = require('express-validator');
const { DELIVERY_STATUS_LIST } = require('../utils/constants');

const idParam = [param('id').isUUID().withMessage('Identifiant commande invalide')];

const create = [
  body('customerName').optional({ values: 'falsy' }).isString(),
  body('customerPhone').optional({ values: 'falsy' }).isString(),
  body('customerEmail').optional({ values: 'falsy' }).isEmail().withMessage('Email client invalide'),
  body('region').optional({ values: 'falsy' }).isString(),
  body('city').optional({ values: 'falsy' }).isString(),
  body('deliveryAddress').optional({ values: 'falsy' }).isString(),
  body('orderAmount').optional().isFloat({ min: 0 }).withMessage('Montant invalide'),
  body('deliveryCost').optional().isFloat({ min: 0 }),
  body('shaqCost').optional().isFloat({ min: 0 }),
  body('paymentMethod').optional({ values: 'falsy' }).isString(),
  body('deliveryStatus').optional().isIn(DELIVERY_STATUS_LIST).withMessage('Statut de livraison invalide'),
  body('shopifyOrderId').optional({ values: 'falsy' }).isInt(),
  body('items').optional().isArray().withMessage('items doit être un tableau'),
  body('items.*.quantity').optional().isInt({ min: 1 }),
  body('items.*.unitPrice').optional().isFloat({ min: 0 }),
];

const update = [
  ...idParam,
  body('customerEmail').optional({ values: 'falsy' }).isEmail().withMessage('Email client invalide'),
  body('orderAmount').optional().isFloat({ min: 0 }),
  body('deliveryCost').optional().isFloat({ min: 0 }),
  body('shaqCost').optional().isFloat({ min: 0 }),
  body('deliveryStatus').optional().isIn(DELIVERY_STATUS_LIST).withMessage('Statut de livraison invalide'),
];

const listQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(DELIVERY_STATUS_LIST),
  query('period').optional().isIn(['today', 'yesterday', 'week', 'month', 'year', 'custom']),
  query('archived').optional().isIn(['true', 'false']),
];

const idsBody = body('ids')
  .isArray({ min: 1 })
  .withMessage('Fournir un tableau d\'identifiants')
  .bail()
  .custom((arr) => arr.every((x) => typeof x === 'string'))
  .withMessage('Identifiants invalides');

const bulkStatus = [
  idsBody,
  body('status').isIn(DELIVERY_STATUS_LIST).withMessage('Statut de livraison invalide'),
];

const bulkArchive = [idsBody, body('archived').optional().isBoolean()];

const bulkNotes = [idsBody, body('notes').isString().withMessage('Notes invalides')];

module.exports = { idParam, create, update, listQuery, bulkStatus, bulkArchive, bulkNotes };
