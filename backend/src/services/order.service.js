'use strict';

const orderRepo = require('../repositories/order.repository');
const ApiError = require('../utils/ApiError');
const { parsePagination, parseSort } = require('../utils/queryParams');
const { resolveDateRange } = require('../utils/dateRange');
const tariff = require('../utils/shaqTariff');

// FR : Récupère une commande par id (avec articles en option).
// EN : Fetch an order by id (optionally with its items).
async function getById(id, { withItems = false } = {}) {
  const order = await orderRepo.findById(id);
  if (!order) throw ApiError.notFound('Commande introuvable');
  if (withItems) order.items = await orderRepo.findItems(id);
  return order;
}

// FR : Crée une commande; pose les frais de livraison depuis la grille région.
// EN : Create an order; set the delivery fee from the regional grid.
async function create(data) {
  // frais_livraison comes from the ShaQ regional tariff grid (unless supplied).
  if (data.deliveryCost === undefined || data.deliveryCost === null || data.deliveryCost === '') {
    data = { ...data, deliveryCost: tariff.deliveryFee(data.region) };
  }
  return orderRepo.create(data);
}

/** Recompute frais_livraison from the region (e.g. after a region change). */
// FR : Recalcule les frais de livraison d'après la région.
// EN : Recompute the delivery fee from the order's region.
async function recalcDeliveryFee(id) {
  const order = await getById(id);
  const fee = tariff.deliveryFee(order.region);
  return orderRepo.update(id, { deliveryCost: fee });
}

// FR : Met à jour une commande existante.
// EN : Update an existing order.
async function update(id, data) {
  await getById(id);
  return orderRepo.update(id, data);
}

// FR : Supprime une commande.
// EN : Delete an order.
async function remove(id) {
  const ok = await orderRepo.remove(id);
  if (!ok) throw ApiError.notFound('Commande introuvable');
}

// FR : Archive une commande.
// EN : Archive an order.
async function archive(id) {
  await getById(id);
  return orderRepo.setArchived(id, true);
}

// FR : Désarchive (restaure) une commande.
// EN : Unarchive (restore) an order.
async function restore(id) {
  await getById(id);
  return orderRepo.setArchived(id, false);
}

// FR : Liste paginée/filtrée/triée des commandes.
// EN : Paginated/filtered/sorted list of orders.
async function list(queryParams) {
  const { page, limit, offset } = parsePagination(queryParams);
  const { sortBy, sortDir } = parseSort(queryParams, orderRepo.SORTABLE, 'created_at');
  const { from, to } = resolveDateRange(queryParams);

  let archived;
  if (queryParams.archived === 'true') archived = true;
  else if (queryParams.archived === 'false') archived = false;

  const { total, rows } = await orderRepo.list({
    limit,
    offset,
    sortBy,
    sortDir,
    search: queryParams.search,
    status: queryParams.status,
    region: queryParams.region,
    city: queryParams.city,
    paymentMethod: queryParams.paymentMethod,
    archived,
    from,
    to,
  });
  return { rows, page, limit, total };
}

// ---- Bulk ----
// FR : Change le statut de plusieurs commandes en lot.
// EN : Bulk-update the status of multiple orders.
async function bulkUpdateStatus(ids, status) {
  const n = await orderRepo.bulkUpdateStatus(ids, status);
  return { updated: n };
}
// FR : Archive/désarchive plusieurs commandes en lot.
// EN : Bulk archive/unarchive multiple orders.
async function bulkArchive(ids, archived) {
  const n = await orderRepo.bulkArchive(ids, archived);
  return { updated: n };
}
// FR : Met à jour les notes de plusieurs commandes en lot.
// EN : Bulk-update the notes of multiple orders.
async function bulkUpdateNotes(ids, notes) {
  const n = await orderRepo.bulkUpdateNotes(ids, notes);
  return { updated: n };
}

module.exports = {
  getById,
  create,
  recalcDeliveryFee,
  update,
  remove,
  archive,
  restore,
  list,
  bulkUpdateStatus,
  bulkArchive,
  bulkUpdateNotes,
};
