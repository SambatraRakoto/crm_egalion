'use strict';
// FR : Routes du journal d'audit (/audit-logs).
// EN : Audit-log routes (/audit-logs).

const express = require('express');
const ctrl = require('../controllers/audit.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// Audit trail is admin-only.
router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/', ctrl.list); // ?userId=&action=&page=&limit=

module.exports = router;
