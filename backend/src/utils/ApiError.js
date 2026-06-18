'use strict';

/**
 * Operational error with an HTTP status code. Thrown anywhere in the request
 * lifecycle and caught by the global error handler.
 */
class ApiError extends Error {
  // FR : Construit une ApiError (status, message, erreurs de champ).
  // EN : Build an ApiError (status, message, field errors).
  constructor(statusCode, message, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  // FR : Erreur 400 (requête invalide).
  // EN : 400 error (bad request).
  static badRequest(message = 'Requête invalide', errors = []) {
    return new ApiError(400, message, errors);
  }
  // FR : Erreur 401 (non authentifié).
  // EN : 401 error (unauthorized).
  static unauthorized(message = 'Non authentifié') {
    return new ApiError(401, message);
  }
  // FR : Erreur 403 (accès refusé).
  // EN : 403 error (forbidden).
  static forbidden(message = 'Accès refusé') {
    return new ApiError(403, message);
  }
  // FR : Erreur 404 (introuvable).
  // EN : 404 error (not found).
  static notFound(message = 'Ressource introuvable') {
    return new ApiError(404, message);
  }
  // FR : Erreur 409 (conflit).
  // EN : 409 error (conflict).
  static conflict(message = 'Conflit') {
    return new ApiError(409, message);
  }
  // FR : Erreur 422 (entité non traitable).
  // EN : 422 error (unprocessable).
  static unprocessable(message = 'Entité non traitable', errors = []) {
    return new ApiError(422, message, errors);
  }
  // FR : Erreur 500 (interne).
  // EN : 500 error (internal).
  static internal(message = 'Erreur interne du serveur') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
