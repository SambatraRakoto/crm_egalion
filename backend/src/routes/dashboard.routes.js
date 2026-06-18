'use strict';
// FR : Routes du tableau de bord (/dashboard).
// EN : Dashboard routes (/dashboard).

const express = require('express');
const ctrl = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// All dashboard endpoints accept date filters: ?period=today|yesterday|week|month|year|custom
// plus ?from / ?to (ISO) for custom ranges.
router.use(authenticate);

router.get('/overview', ctrl.overview);
router.get('/kpis', ctrl.kpis);
router.get('/revenue-series', ctrl.revenueSeries); // ?granularity=day|week|month|year
router.get('/status-distribution', ctrl.statusDistribution);
router.get('/order-volume', ctrl.orderVolume);
router.get('/delivery-funnel', ctrl.deliveryFunnel);
router.get('/top-products', ctrl.topProducts); // ?limit
router.get('/top-regions', ctrl.topRegions); // ?limit
router.get('/cancellation-by-region', ctrl.cancellationByRegion);

module.exports = router;
