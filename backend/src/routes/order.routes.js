'use strict';
// FR : Routes des commandes (/orders).
// EN : Order routes (/orders).

const express = require('express');
const ctrl = require('../controllers/order.controller');
const v = require('../validators/order.validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

const canManage = authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT);

// Bulk endpoints (declared before /:id to avoid route shadowing).
router.patch('/bulk/status', canManage, v.bulkStatus, validate, ctrl.bulkStatus);
router.patch('/bulk/archive', canManage, v.bulkArchive, validate, ctrl.bulkArchive);
router.patch('/bulk/notes', canManage, v.bulkNotes, validate, ctrl.bulkNotes);

router.get('/', v.listQuery, validate, ctrl.list);
router.get('/:id', v.idParam, validate, ctrl.getOne);
router.post('/', canManage, v.create, validate, ctrl.create);
router.put('/:id', canManage, v.update, validate, ctrl.update);
router.patch('/:id/archive', canManage, v.idParam, validate, ctrl.archive);
router.patch('/:id/restore', canManage, v.idParam, validate, ctrl.restore);
router.delete('/:id', authorize(ROLES.ADMIN), v.idParam, validate, ctrl.remove);

module.exports = router;
