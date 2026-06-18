'use strict';

const productRepo = require('../repositories/product.repository');
const ApiError = require('../utils/ApiError');
const { parsePagination, parseSort } = require('../utils/queryParams');

// FR : Récupère un produit par id.
// EN : Fetch a product by id.
async function getById(id) {
  const product = await productRepo.findById(id);
  if (!product) throw ApiError.notFound('Produit introuvable');
  return product;
}

// FR : Crée un produit.
// EN : Create a product.
async function create(data) {
  return productRepo.create(data);
}

// FR : Met à jour un produit.
// EN : Update a product.
async function update(id, data) {
  await getById(id);
  return productRepo.update(id, data);
}

// FR : Supprime un produit.
// EN : Delete a product.
async function remove(id) {
  const ok = await productRepo.remove(id);
  if (!ok) throw ApiError.notFound('Produit introuvable');
}

// FR : Ajuste le stock par un delta (jamais < 0).
// EN : Adjust stock by a delta (never below 0).
async function adjustStock(id, delta) {
  await getById(id);
  return productRepo.adjustStock(id, delta);
}

// FR : Définit le stock à une valeur absolue.
// EN : Set stock to an absolute value.
async function setStock(id, quantity) {
  await getById(id);
  return productRepo.setStock(id, quantity);
}

// FR : Liste paginée/filtrée des produits.
// EN : Paginated/filtered list of products.
async function list(queryParams) {
  const { page, limit, offset } = parsePagination(queryParams);
  const { sortBy, sortDir } = parseSort(queryParams, productRepo.SORTABLE, 'created_at');
  const { total, rows } = await productRepo.list({
    limit,
    offset,
    search: queryParams.search,
    category: queryParams.category,
    productStatus: queryParams.status,
    stockState: queryParams.stockState,
    sortBy,
    sortDir,
  });
  return { rows, page, limit, total };
}

module.exports = { getById, create, update, remove, adjustStock, setStock, list };
