'use strict';
// FR : Routeur principal : monte tous les sous-routeurs sous /api/v1.
// EN : Main router: mounts all sub-routers under /api/v1.

const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const productRoutes = require('./product.routes');
const orderRoutes = require('./order.routes');
const dashboardRoutes = require('./dashboard.routes');
const financeRoutes = require('./finance.routes');
const shaqRoutes = require('./shaq.routes');
const shopifyRoutes = require('./shopify.routes');
const auditRoutes = require('./audit.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API opérationnelle', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/finance', financeRoutes);
router.use('/shaq', shaqRoutes);
router.use('/shopify', shopifyRoutes);
router.use('/audit-logs', auditRoutes);

module.exports = router;
