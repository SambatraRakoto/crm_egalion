'use strict';
// FR : Routes d'administration des utilisateurs (/users).
// EN : User administration routes (/users).

const express = require('express');
const ctrl = require('../controllers/user.controller');
const v = require('../validators/user.validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// User administration is admin-only.
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/roles', ctrl.listRoles);
router.get('/', v.listQuery, validate, ctrl.list);
router.get('/:id', v.idParam, validate, ctrl.getOne);
router.put('/:id', v.update, validate, ctrl.update);
router.patch('/:id/roles', v.setRoles, validate, ctrl.setRoles);
router.patch('/:id/active', v.setActive, validate, ctrl.setActive);
router.delete('/:id', v.idParam, validate, ctrl.remove);

module.exports = router;
