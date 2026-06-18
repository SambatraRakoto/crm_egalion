'use strict';

/** Parse page/limit from the request query with sane bounds. */
// FR : Parse page/limit avec bornes saines.
// EN : Parse page/limit with sane bounds.
function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (Number.isNaN(page) || page < 1) page = 1;
  if (Number.isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Parse sort params against a whitelist of allowed columns to prevent SQL
 * injection through ORDER BY (which cannot be parameterized).
 */
// FR : Parse le tri contre une liste blanche de colonnes.
// EN : Parse sorting against a column whitelist.
function parseSort(query, allowedColumns, fallback) {
  const sortBy = allowedColumns.includes(query.sortBy) ? query.sortBy : fallback;
  const sortDir = String(query.sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return { sortBy, sortDir };
}

module.exports = { parsePagination, parseSort };
