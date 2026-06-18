'use strict';
// FR : Règles de validation des paramètres Shopify.
// EN : Validation rules for Shopify settings.

const { body } = require('express-validator');

const updateSettings = [
  body('storeDomain')
    .optional({ values: 'falsy' })
    .matches(/^[a-zA-Z0-9-]+\.myshopify\.com$/)
    .withMessage('Domaine Shopify invalide (ex: ma-boutique.myshopify.com)'),
  body('accessToken').optional({ values: 'falsy' }).isString().isLength({ min: 10 }).withMessage('Token invalide'),
  body('apiVersion').optional({ values: 'falsy' }).matches(/^\d{4}-\d{2}$/).withMessage('Version API invalide (ex: 2024-10)'),
];

module.exports = { updateSettings };
