'use strict';
// FR : Règles de validation des entrées produits.
// EN : Validation rules for product inputs.

const { body, param, query } = require('express-validator');
const { PRODUCT_STATUS_LIST } = require('../utils/constants');

const idParam = [param('id').isUUID().withMessage('Identifiant produit invalide')];

const create = [
  body('name').trim().notEmpty().withMessage('Le nom est requis'),
  body('sku').optional({ values: 'falsy' }).isString(),
  body('description').optional({ values: 'falsy' }).isString(),
  body('category').optional({ values: 'falsy' }).isString(),
  body('price').optional().isFloat({ min: 0 }).withMessage('Prix invalide'),
  body('supplierCost').optional().isFloat({ min: 0 }).withMessage('Coût fournisseur invalide'),
  body('stockQuantity').optional().isInt({ min: 0 }).withMessage('Quantité invalide'),
  body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Seuil invalide'),
  body('productStatus').optional().isIn(PRODUCT_STATUS_LIST).withMessage('Statut invalide'),
  body('imageUrl').optional({ values: 'falsy' }).isString(),
  body('shopifyProductId').optional({ values: 'falsy' }).isInt(),
];

const update = [
  ...idParam,
  body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide'),
  body('price').optional().isFloat({ min: 0 }),
  body('supplierCost').optional().isFloat({ min: 0 }),
  body('stockQuantity').optional().isInt({ min: 0 }),
  body('lowStockThreshold').optional().isInt({ min: 0 }),
  body('productStatus').optional().isIn(PRODUCT_STATUS_LIST).withMessage('Statut invalide'),
];

const updateStock = [
  ...idParam,
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantité invalide'),
  body('delta').optional().isInt().withMessage('Delta invalide'),
  body().custom((value) => {
    if (value.quantity === undefined && value.delta === undefined) {
      throw new Error('Fournir "quantity" (valeur absolue) ou "delta" (ajustement)');
    }
    return true;
  }),
];

const listQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(PRODUCT_STATUS_LIST),
  query('stockState').optional().isIn(['in_stock', 'low_stock', 'out_of_stock']),
];

module.exports = { idParam, create, update, updateStock, listQuery };
