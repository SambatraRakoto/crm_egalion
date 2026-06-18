'use strict';

const { query } = require('../database/pool');

const COLUMNS = `id, shopify_product_id, sku, name, description, category, price,
  supplier_cost, stock_quantity, low_stock_threshold, product_status, image_url,
  created_at, updated_at`;

/** Derive the stock state expression for SELECTs. */
const STOCK_STATE_SQL = `
  CASE
    WHEN stock_quantity <= 0 THEN 'out_of_stock'
    WHEN stock_quantity <= low_stock_threshold THEN 'low_stock'
    ELSE 'in_stock'
  END AS stock_state`;

// FR : Récupère un produit (avec stock_state).
// EN : Fetch a product (with stock_state).
async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS}, ${STOCK_STATE_SQL} FROM products WHERE id = $1`, [id]);
  return rows[0] || null;
}

// FR : Crée un produit.
// EN : Create a product.
async function create(data) {
  const { rows } = await query(
    `INSERT INTO products
      (shopify_product_id, sku, name, description, category, price, supplier_cost,
       stock_quantity, low_stock_threshold, product_status, image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING ${COLUMNS}, ${STOCK_STATE_SQL}`,
    [
      data.shopifyProductId || null,
      data.sku || null,
      data.name,
      data.description || null,
      data.category || null,
      data.price ?? 0,
      data.supplierCost ?? 0,
      data.stockQuantity ?? 0,
      data.lowStockThreshold ?? 5,
      data.productStatus || 'active',
      data.imageUrl || null,
    ]
  );
  return rows[0];
}

const UPDATABLE = {
  sku: 'sku',
  name: 'name',
  description: 'description',
  category: 'category',
  price: 'price',
  supplierCost: 'supplier_cost',
  stockQuantity: 'stock_quantity',
  lowStockThreshold: 'low_stock_threshold',
  productStatus: 'product_status',
  imageUrl: 'image_url',
};

// FR : Met à jour un produit.
// EN : Update a product.
async function update(id, data) {
  const sets = [];
  const params = [];
  let i = 1;
  for (const [key, col] of Object.entries(UPDATABLE)) {
    if (data[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      params.push(data[key]);
    }
  }
  if (!sets.length) return findById(id);
  params.push(id);
  const { rows } = await query(
    `UPDATE products SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${COLUMNS}, ${STOCK_STATE_SQL}`,
    params
  );
  return rows[0] || null;
}

/** Adjust stock by a delta (positive or negative); never goes below 0. */
// FR : Ajuste le stock par un delta (>= 0).
// EN : Adjust stock by a delta (>= 0).
async function adjustStock(id, delta) {
  const { rows } = await query(
    `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity + $1)
     WHERE id = $2 RETURNING ${COLUMNS}, ${STOCK_STATE_SQL}`,
    [delta, id]
  );
  return rows[0] || null;
}

// FR : Définit le stock absolu.
// EN : Set absolute stock.
async function setStock(id, quantity) {
  const { rows } = await query(
    `UPDATE products SET stock_quantity = $1 WHERE id = $2 RETURNING ${COLUMNS}, ${STOCK_STATE_SQL}`,
    [quantity, id]
  );
  return rows[0] || null;
}

// FR : Supprime un produit.
// EN : Delete a product.
async function remove(id) {
  const { rowCount } = await query('DELETE FROM products WHERE id = $1', [id]);
  return rowCount > 0;
}

// FR : Liste paginée/filtrée des produits.
// EN : Paginated/filtered product list.
async function list({ limit, offset, search, category, productStatus, stockState, sortBy, sortDir }) {
  const where = [];
  const params = [];
  let i = 1;

  if (search) {
    where.push(`(name ILIKE $${i} OR sku ILIKE $${i} OR category ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }
  if (category) { where.push(`category = $${i++}`); params.push(category); }
  if (productStatus) { where.push(`product_status = $${i++}`); params.push(productStatus); }
  if (stockState === 'out_of_stock') where.push('stock_quantity <= 0');
  else if (stockState === 'low_stock') where.push('stock_quantity > 0 AND stock_quantity <= low_stock_threshold');
  else if (stockState === 'in_stock') where.push('stock_quantity > low_stock_threshold');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await query(`SELECT COUNT(*)::int AS n FROM products ${whereSql}`, params);
  const rowsRes = await query(
    `SELECT ${COLUMNS}, ${STOCK_STATE_SQL} FROM products ${whereSql}
     ORDER BY ${sortBy} ${sortDir} LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );
  return { total: totalRes.rows[0].n, rows: rowsRes.rows };
}

module.exports = {
  findById,
  create,
  update,
  adjustStock,
  setStock,
  remove,
  list,
  SORTABLE: ['created_at', 'updated_at', 'name', 'price', 'stock_quantity', 'category'],
};
