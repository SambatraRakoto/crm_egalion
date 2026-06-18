'use strict';
// FR : Routes d'authentification (/auth).
// EN : Authentication routes (/auth).

const express = require('express');
const ctrl = require('../controllers/auth.controller');
const v = require('../validators/auth.validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { authLimiter } = require('../middleware/rateLimiter');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// Public (rate-limited) endpoints
router.post('/login', authLimiter, v.login, validate, ctrl.login);
router.post('/refresh', authLimiter, v.refresh, validate, ctrl.refresh);
router.post('/forgot-password', authLimiter, v.forgotPassword, validate, ctrl.forgotPassword);
router.post('/reset-password', authLimiter, v.resetPassword, validate, ctrl.resetPassword);

// Authenticated endpoints
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.post('/change-password', authenticate, v.changePassword, validate, ctrl.changePassword);

// Admin-only: create users
router.post(
  '/register',
  authenticate,
  authorize(ROLES.ADMIN),
  v.register,
  validate,
  ctrl.register
);

module.exports = router;
