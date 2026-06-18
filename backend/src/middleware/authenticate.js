'use strict';

const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const asyncHandler = require('../utils/asyncHandler');

/**
 * FR : Vérifie le jeton d'accès Bearer et attache l'utilisateur décodé à req.user.
 *      Forme du payload : { sub, email, roles: [slug] }.
 * EN : Verify the Bearer access token and attach the decoded user to req.user.
 *      Payload shape: { sub, email, roles: [slug] }.
 */
module.exports = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Token d\'accès manquant ou mal formé');
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token d\'accès expiré');
    }
    throw ApiError.unauthorized('Token d\'accès invalide');
  }
});
