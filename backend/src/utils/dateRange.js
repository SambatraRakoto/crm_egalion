'use strict';

/**
 * Resolve a date-range filter from query params into { from, to } ISO bounds.
 * Supports preset periods and a custom range.
 *
 * query.period: today | yesterday | week | month | year | custom
 * query.from / query.to: ISO dates (used when period=custom or standalone)
 */
// FR : Résout une période en bornes { from, to }.
// EN : Resolve a period into { from, to } bounds.
function resolveDateRange(query = {}) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  let from;
  let to;

  switch (query.period) {
    case 'today':
      from = startOfDay(now);
      to = endOfDay(now);
      break;
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      from = startOfDay(y);
      to = endOfDay(y);
      break;
    }
    case 'week': {
      // ISO week starting Monday.
      const day = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day);
      from = startOfDay(monday);
      to = endOfDay(now);
      break;
    }
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = endOfDay(now);
      break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = endOfDay(now);
      break;
    case 'custom':
    default:
      if (query.from) from = new Date(query.from);
      if (query.to) to = endOfDay(new Date(query.to));
      break;
  }

  return {
    from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : null,
    to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : null,
  };
}

module.exports = { resolveDateRange };
