'use strict';
// FR : Routes financières (/finance).
// EN : Finance routes (/finance).

const express = require('express');
const ctrl = require('../controllers/finance.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// Financial data is restricted to admin, manager and finance roles.
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE));

router.get('/summary', ctrl.summary);
router.get('/report', ctrl.report); // ?period=...&granularity=day|week|month|year

module.exports = router;
