'use strict';

const { query } = require('../database/pool');

/** Build a WHERE clause limiting on created_at to [from, to] (both optional). */
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

/** Consolidated KPI snapshot. */
// FR : Agrège les KPI (commandes, CA, coûts, délais).
// EN : Aggregate KPIs (orders, revenue, costs, lead time).
async function kpis(from, to) {
  const { whereSql, params } = rangeClause(from, to);
  const sql = `
    SELECT
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE delivery_status = 'delivered')::int AS delivered_orders,
      COUNT(*) FILTER (WHERE delivery_status = 'pending')::int AS pending_orders,
      COUNT(*) FILTER (WHERE delivery_status IN ('return_picked','return_in_progress','returned_to_sender','return_to_central'))::int AS returned_orders,
      COUNT(*) FILTER (WHERE delivery_status = 'cancelled')::int AS cancelled_orders,
      COALESCE(SUM(order_amount) FILTER (WHERE delivery_status = 'delivered'), 0) AS revenue,
      COALESCE(AVG(order_amount), 0) AS avg_order_value,
      COALESCE(SUM(delivery_cost), 0) AS total_delivery_cost,
      COALESCE(SUM(shaq_cost), 0) AS total_shaq_cost,
      COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - COALESCE(ordered_at, created_at))) / 86400.0)
        FILTER (WHERE delivery_status = 'delivered' AND delivered_at IS NOT NULL), 0) AS avg_delivery_days
    FROM orders ${whereSql}`;
  const { rows } = await query(sql, params);
  return rows[0];
}

/** Revenue + order count grouped by day/week/month/year. */
// FR : CA et volume groupés par période.
// EN : Revenue and volume grouped by period.
async function revenueSeries(from, to, granularity = 'day') {
  const valid = { day: 'day', week: 'week', month: 'month', year: 'year' };
  const trunc = valid[granularity] || 'day';
  const { whereSql, params } = rangeClause(from, to);
  const sql = `
    SELECT date_trunc('${trunc}', created_at) AS bucket,
           COUNT(*)::int AS orders,
           COALESCE(SUM(order_amount) FILTER (WHERE delivery_status = 'delivered'), 0) AS revenue,
           COALESCE(SUM(order_amount), 0) AS total_amount
    FROM orders ${whereSql}
    GROUP BY bucket ORDER BY bucket`;
  const { rows } = await query(sql, params);
  return rows;
}

// FR : Compte des commandes par statut.
// EN : Order counts by status.
async function statusDistribution(from, to) {
  const { whereSql, params } = rangeClause(from, to);
  const { rows } = await query(
    `SELECT delivery_status AS status, COUNT(*)::int AS count
     FROM orders ${whereSql} GROUP BY delivery_status ORDER BY count DESC`,
    params
  );
  return rows;
}

/** Delivery funnel (cumulative): received -> collected -> in transit -> delivered -> returned. */
// FR : Compteurs cumulés de l'entonnoir de livraison.
// EN : Cumulative delivery-funnel counters.
async function deliveryFunnel(from, to) {
  const { whereSql, params } = rangeClause(from, to);
  const sql = `
    SELECT
      COUNT(*)::int AS received,
      COUNT(*) FILTER (WHERE delivery_status IN ('collected','ready_for_pickup','shipped','assigned','in_transit','dispatched','confirmed','delivered'))::int AS collected,
      COUNT(*) FILTER (WHERE delivery_status IN ('shipped','assigned','in_transit','dispatched','confirmed','delivered'))::int AS in_transit,
      COUNT(*) FILTER (WHERE delivery_status = 'delivered')::int AS delivered,
      COUNT(*) FILTER (WHERE delivery_status IN ('return_picked','return_in_progress','returned_to_sender','return_to_central'))::int AS returned
    FROM orders ${whereSql}`;
  const { rows } = await query(sql, params);
  return rows[0];
}

// FR : Produits les plus commandés.
// EN : Most-ordered products.
async function topProducts(from, to, limit = 10) {
  const where = ['o.archived = FALSE'];
  const params = [];
  let i = 1;
  if (from) { where.push(`o.created_at >= $${i++}`); params.push(from); }
  if (to) { where.push(`o.created_at <= $${i++}`); params.push(to); }
  params.push(limit);
  const sql = `
    SELECT oi.product_id,
           COALESCE(oi.product_name, p.name) AS name,
           oi.sku,
           SUM(oi.quantity)::int AS units_sold,
           COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE ${where.join(' AND ')}
    GROUP BY oi.product_id, COALESCE(oi.product_name, p.name), oi.sku
    ORDER BY units_sold DESC
    LIMIT $${i}`;
  const { rows } = await query(sql, params);
  return rows;
}

// FR : Régions les plus actives.
// EN : Most active regions.
async function topRegions(from, to, limit = 10) {
  const { whereSql, params, nextIndex } = rangeClause(from, to);
  params.push(limit);
  const sql = `
    SELECT COALESCE(NULLIF(region, ''), 'Inconnu') AS region,
           COUNT(*)::int AS orders,
           COALESCE(SUM(order_amount) FILTER (WHERE delivery_status = 'delivered'), 0) AS revenue
    FROM orders ${whereSql}
    GROUP BY COALESCE(NULLIF(region, ''), 'Inconnu')
    ORDER BY orders DESC
    LIMIT $${nextIndex}`;
  const { rows } = await query(sql, params);
  return rows;
}

// FR : Taux d'annulation par région.
// EN : Cancellation rate per region.
async function cancellationByRegion(from, to) {
  const { whereSql, params } = rangeClause(from, to);
  const sql = `
    SELECT COALESCE(NULLIF(region, ''), 'Inconnu') AS region,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE delivery_status = 'cancelled')::int AS cancelled,
           ROUND(100.0 * COUNT(*) FILTER (WHERE delivery_status = 'cancelled') / NULLIF(COUNT(*), 0), 2) AS cancellation_rate
    FROM orders ${whereSql}
    GROUP BY COALESCE(NULLIF(region, ''), 'Inconnu')
    ORDER BY cancellation_rate DESC NULLS LAST`;
  const { rows } = await query(sql, params);
  return rows;
}

module.exports = {
  kpis,
  revenueSeries,
  statusDistribution,
  deliveryFunnel,
  topProducts,
  topRegions,
  cancellationByRegion,
};
