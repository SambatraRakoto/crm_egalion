'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

const standardOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes, veuillez réessayer plus tard.', errors: [] },
};

// FR : Limiteur global appliqué à toutes les routes de l'API.
// EN : Global limiter applied to all API routes.
const apiLimiter = rateLimit({
  ...standardOptions,
  windowMs: config.security.rateWindowMs,
  max: config.security.rateMax,
});

// FR : Limiteur plus strict pour l'authentification (protection brute-force).
// EN : Stricter limiter for authentication endpoints (brute-force protection).
const authLimiter = rateLimit({
  ...standardOptions,
  windowMs: config.security.rateWindowMs,
  max: config.security.authRateMax,
});

module.exports = { apiLimiter, authLimiter };
