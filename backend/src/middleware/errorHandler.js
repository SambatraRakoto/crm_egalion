'use strict';

const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const config = require('../config');

/** Catch-all for unmatched routes. */
// FR : Handler 404 pour les routes inconnues.
// EN : 404 handler for unknown routes.
function notFound(req, res, next) {
  next(ApiError.notFound(`Route introuvable: ${req.method} ${req.originalUrl}`));
}

/** Translate known PostgreSQL error codes into ApiError instances. */
// FR : Traduit une erreur PostgreSQL en ApiError.
// EN : Translate a PostgreSQL error into an ApiError.
function mapPgError(err) {
  switch (err.code) {
    case '23505': // unique_violation
      return ApiError.conflict('Cette valeur existe déjà (contrainte d\'unicité).');
    case '23503': // foreign_key_violation
      return ApiError.badRequest('Référence invalide (clé étrangère).');
    case '23502': // not_null_violation
      return ApiError.badRequest(`Champ obligatoire manquant: ${err.column || ''}`.trim());
    case '22P02': // invalid_text_representation
      return ApiError.badRequest('Format de valeur invalide.');
    default:
      return null;
  }
}

/* eslint-disable no-unused-vars */
// FR : Middleware global de gestion des erreurs.
// EN : Global error-handling middleware.
function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    const mapped = error.code ? mapPgError(error) : null;
    error = mapped || new ApiError(error.statusCode || 500, error.message || 'Erreur interne du serveur');
  }

  if (error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl}`, err);
  }

  const body = {
    success: false,
    message: error.message,
    errors: error.errors || [],
  };
  if (!config.isProd && error.statusCode >= 500) {
    body.stack = err.stack;
  }

  res.status(error.statusCode || 500).json(body);
}

module.exports = { errorHandler, notFound };
