'use strict';

const productService = require('../services/product.service');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, paginationMeta } = require('../utils/response');
const { AUDIT_ACTION } = require('../utils/constants');

// FR : GET /products — liste paginée.
// EN : GET /products — paginated list.
const list = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } = await productService.list(req.query);
  return success(res, { message: 'Liste des produits', data: rows, meta: paginationMeta({ page, limit, total }) });
});

// FR : GET /products/:id — détail d'un produit.
// EN : GET /products/:id — product detail.
const getOne = asyncHandler(async (req, res) => {
  const product = await productService.getById(req.params.id);
  return success(res, { message: 'Détails du produit', data: product });
});

// FR : POST /products — crée un produit.
// EN : POST /products — create a product.
const create = asyncHandler(async (req, res) => {
  const product = await productService.create(req.body);
  await auditService.record(req, { action: AUDIT_ACTION.PRODUCT_CREATE, entityType: 'product', entityId: product.id });
  return success(res, { status: 201, message: 'Produit créé avec succès', data: product });
});

// FR : PUT /products/:id — met à jour un produit.
// EN : PUT /products/:id — update a product.
const update = asyncHandler(async (req, res) => {
  const product = await productService.update(req.params.id, req.body);
  await auditService.record(req, { action: AUDIT_ACTION.PRODUCT_UPDATE, entityType: 'product', entityId: product.id });
  return success(res, { message: 'Produit mis à jour avec succès', data: product });
});

// FR : DELETE /products/:id — supprime un produit.
// EN : DELETE /products/:id — delete a product.
const remove = asyncHandler(async (req, res) => {
  await productService.remove(req.params.id);
  await auditService.record(req, { action: AUDIT_ACTION.PRODUCT_DELETE, entityType: 'product', entityId: req.params.id });
  return success(res, { message: 'Produit supprimé avec succès' });
});

// FR : PATCH /products/:id/stock — ajuste le stock.
// EN : PATCH /products/:id/stock — adjust stock.
const updateStock = asyncHandler(async (req, res) => {
  const { quantity, delta } = req.body;
  const product = delta !== undefined
    ? await productService.adjustStock(req.params.id, delta)
    : await productService.setStock(req.params.id, quantity);
  await auditService.record(req, {
    action: AUDIT_ACTION.PRODUCT_UPDATE,
    entityType: 'product',
    entityId: product.id,
    metadata: { stockChange: delta !== undefined ? { delta } : { quantity } },
  });
  return success(res, { message: 'Stock mis à jour', data: product });
});

module.exports = { list, getOne, create, update, remove, updateStock };
