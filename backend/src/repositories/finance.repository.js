'use strict';

const { query } = require('../database/pool');

// FR : Construit la clause WHERE de plage de dates.
// EN : Build the date-range WHERE clause.
function rangeClause(from, to, startIndex = 1) {
  const where = ['archived = FALSE'];
  const params = [];
  let i = startIndex;
  if (from) { where.push(`created_at >= $${i++}`); params.push(from); }
  if (to) { where.push(`created_at <= $${i++}`); params.push(to); }
  return { whereSql: `WHERE ${where.join(' AND ')}`, params, nextIndex: i };
}

/**
 * Financial snapshot. Conventions:
 * - revenue (CA total) = sum of order_amount over all non-archived orders.
 * - collected = order_amount of delivered orders (paiements reçus).
 * - outstanding = order_amount of non-delivered, non-cancelled/returned orders.
 * - codPending = delivered COD orders not yet remitted (proxy: COD + delivered).
 */
// FR : Agrège les chiffres financiers.
// EN : Aggregate the financial figures.
async function summary(from, to) {
  const { whereSql, params } = rangeClause(from, to);
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE delivery_status = 'delivered')::int AS delivered_orders,
      COALESCE(SUM(order_amount), 0) AS total_revenue,
      COALESCE(SUM(order_amount) FILTER (WHERE delivery_status = 'delivered'), 0) AS collected,
      COALESCE(SUM(order_amount) FILTER (WHERE delivery_status NOT IN ('delivered','cancelled','return_picked','return_in_progress','returned_to_sender','return_to_central')), 0) AS outstanding,
      COALESCE(SUM(order_amount) FILTER (
        WHERE delivery_status = 'delivered' AND lower(COALESCE(payment_method, '')) IN ('cod','cash','cash_on_delivery','espèces','especes')
      ), 0) AS cod_collected,
      COALESCE(SUM(order_amount) FILTER (
        WHERE delivery_status NOT IN ('delivered','cancelled','return_picked','return_in_progress','returned_to_sender','return_to_central')
          AND lower(COALESCE(payment_method, '')) IN ('cod','cash','cash_on_delivery','espèces','especes')
      ), 0) AS cod_pending,
      COALESCE(SUM(delivery_cost), 0) AS total_delivery_cost,
      COALESCE(SUM(shaq_cost), 0) AS total_shaq_cost,
      -- ShaQ economics on DELIVERED orders (the example's "CA produits livrés"):
      COALESCE(SUM(delivery_cost) FILTER (WHERE delivery_status = 'delivered'), 0) AS frais_livraison,
      COALESCE(SUM(order_amount * 0.05) FILTER (WHERE delivery_status = 'delivered'), 0) AS commission_shaq
    FROM orders ${whereSql}`;
  const { rows } = await query(sql, params);
  return rows[0];
}

/** Supplier cost (cout_fournisseur) of DELIVERED orders = Σ qty × product supplier_cost. */
// FR : Coût fournisseur des commandes livrées.
// EN : Supplier cost of delivered orders.
async function supplierCostDelivered(from, to) {
  const where = ['o.archived = FALSE', "o.delivery_status = 'delivered'"];
  const params = [];
  let i = 1;
  if (from) { where.push(`o.created_at >= $${i++}`); params.push(from); }
  if (to) { where.push(`o.created_at <= $${i++}`); params.push(to); }
  const { rows } = await query(
    `SELECT COALESCE(SUM(oi.quantity * COALESCE(p.supplier_cost, 0)), 0) AS supplier_cost
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
      WHERE ${where.join(' AND ')}`,
    params
  );
  return Number(rows[0].supplier_cost) || 0;
}

/** Revenue/collected/outstanding grouped over time for financial reporting. */
// FR : Séries financières par granularité.
// EN : Financial series by granularity.
async function report(from, to, granularity = 'month') {
  const valid = { day: 'day', week: 'week', month: 'month', year: 'year' };
  const trunc = valid[granularity] || 'month';
  const { whereSql, params } = rangeClause(from, to);
  const sql = `
    SELECT date_trunc('${trunc}', created_at) AS bucket,
           COUNT(*)::int AS orders,
           COALESCE(SUM(order_amount), 0) AS revenue,
           COALESCE(SUM(order_amount) FILTER (WHERE delivery_status = 'delivered'), 0) AS collected,
           COALESCE(SUM(order_amount) FILTER (WHERE delivery_status NOT IN ('delivered','cancelled','return_picked','return_in_progress','returned_to_sender','return_to_central')), 0) AS outstanding,
           COALESCE(SUM(delivery_cost + shaq_cost), 0) AS logistics_cost
    FROM orders ${whereSql}
    GROUP BY bucket ORDER BY bucket`;
  const { rows } = await query(sql, params);
  return rows;
}

module.exports = { summary, report, supplierCostDelivered };
