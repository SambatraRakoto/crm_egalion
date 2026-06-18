'use strict';
// FR : Routes des produits (/products).
// EN : Product routes (/products).

const express = require('express');
const ctrl = require('../controllers/product.controller');
const v = require('../validators/product.validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', v.listQuery, validate, ctrl.list);
router.get('/:id', v.idParam, validate, ctrl.getOne);

// Mutations restricted to admin/manager.
const canManage = authorize(ROLES.ADMIN, ROLES.MANAGER);

router.post('/', canManage, v.create, validate, ctrl.create);
router.put('/:id', canManage, v.update, validate, ctrl.update);
router.patch('/:id/stock', canManage, v.updateStock, validate, ctrl.updateStock);
router.delete('/:id', authorize(ROLES.ADMIN), v.idParam, validate, ctrl.remove);

module.exports = router;
