'use strict';

/** Standard success envelope. */
// FR : Enveloppe de réponse standard de succès.
// EN : Standard success response envelope.
function success(res, { message = 'OK', data = null, meta = undefined, status = 200 } = {}) {
  const body = { success: true, message, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}

/** Standard error envelope. */
// FR : Enveloppe de réponse standard d'erreur.
// EN : Standard error response envelope.
function error(res, { message = 'Erreur', errors = [], status = 400 } = {}) {
  return res.status(status).json({ success: false, message, errors });
}

/** Build pagination metadata for list responses. */
// FR : Construit les métadonnées de pagination.
// EN : Build pagination metadata.
function paginationMeta({ page, limit, total }) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

module.exports = { success, error, paginationMeta };
