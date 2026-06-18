'use strict';

const orderService = require('../services/order.service');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, paginationMeta } = require('../utils/response');
const { AUDIT_ACTION } = require('../utils/constants');

// FR : GET /orders — liste paginée.
// EN : GET /orders — paginated list.
const list = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } = await orderService.list(req.query);
  return success(res, { message: 'Liste des commandes', data: rows, meta: paginationMeta({ page, limit, total }) });
});

// FR : GET /orders/:id — détail d'une commande.
// EN : GET /orders/:id — order detail.
const getOne = asyncHandler(async (req, res) => {
  const order = await orderService.getById(req.params.id, { withItems: true });
  return success(res, { message: 'Détails de la commande', data: order });
});

// FR : POST /orders — crée une commande.
// EN : POST /orders — create an order.
const create = asyncHandler(async (req, res) => {
  const order = await orderService.create(req.body);
  await auditService.record(req, { action: AUDIT_ACTION.ORDER_CREATE, entityType: 'order', entityId: order.id });
  return success(res, { status: 201, message: 'Commande créée avec succès', data: order });
});

// FR : PUT /orders/:id — met à jour une commande.
// EN : PUT /orders/:id — update an order.
const update = asyncHandler(async (req, res) => {
  const order = await orderService.update(req.params.id, req.body);
  await auditService.record(req, { action: AUDIT_ACTION.ORDER_UPDATE, entityType: 'order', entityId: order.id });
  return success(res, { message: 'Commande mise à jour avec succès', data: order });
});

// FR : DELETE /orders/:id — supprime une commande.
// EN : DELETE /orders/:id — delete an order.
const remove = asyncHandler(async (req, res) => {
  await orderService.remove(req.params.id);
  await auditService.record(req, { action: AUDIT_ACTION.ORDER_DELETE, entityType: 'order', entityId: req.params.id });
  return success(res, { message: 'Commande supprimée avec succès' });
});

// FR : PATCH /orders/:id/archive — archive.
// EN : PATCH /orders/:id/archive — archive.
const archive = asyncHandler(async (req, res) => {
  const order = await orderService.archive(req.params.id);
  await auditService.record(req, { action: AUDIT_ACTION.ORDER_ARCHIVE, entityType: 'order', entityId: order.id });
  return success(res, { message: 'Commande archivée', data: order });
});

// FR : PATCH /orders/:id/restore — désarchive.
// EN : PATCH /orders/:id/restore — unarchive.
const restore = asyncHandler(async (req, res) => {
  const order = await orderService.restore(req.params.id);
  await auditService.record(req, { action: AUDIT_ACTION.ORDER_RESTORE, entityType: 'order', entityId: order.id });
  return success(res, { message: 'Commande restaurée', data: order });
});

// FR : PATCH /orders/bulk/status — statut en lot.
// EN : PATCH /orders/bulk/status — bulk status.
const bulkStatus = asyncHandler(async (req, res) => {
  const result = await orderService.bulkUpdateStatus(req.body.ids, req.body.status);
  await auditService.record(req, {
    action: AUDIT_ACTION.ORDER_UPDATE,
    entityType: 'order',
    metadata: { bulk: 'status', status: req.body.status, count: result.updated },
  });
  return success(res, { message: `${result.updated} commande(s) mise(s) à jour`, data: result });
});

// FR : PATCH /orders/bulk/archive — archivage en lot.
// EN : PATCH /orders/bulk/archive — bulk archive.
const bulkArchive = asyncHandler(async (req, res) => {
  const result = await orderService.bulkArchive(req.body.ids, req.body.archived !== false);
  await auditService.record(req, {
    action: AUDIT_ACTION.ORDER_ARCHIVE,
    entityType: 'order',
    metadata: { bulk: 'archive', count: result.updated },
  });
  return success(res, { message: `${result.updated} commande(s) traitée(s)`, data: result });
});

// FR : PATCH /orders/bulk/notes — notes en lot.
// EN : PATCH /orders/bulk/notes — bulk notes.
const bulkNotes = asyncHandler(async (req, res) => {
  const result = await orderService.bulkUpdateNotes(req.body.ids, req.body.notes);
  await auditService.record(req, {
    action: AUDIT_ACTION.ORDER_UPDATE,
    entityType: 'order',
    metadata: { bulk: 'notes', count: result.updated },
  });
  return success(res, { message: `${result.updated} commande(s) mise(s) à jour`, data: result });
});

module.exports = {
  list, getOne, create, update, remove, archive, restore,
  bulkStatus, bulkArchive, bulkNotes,
};
