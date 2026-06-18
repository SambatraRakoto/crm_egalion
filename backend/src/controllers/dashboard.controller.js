'use strict';

const dashboardService = require('../services/dashboard.service');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

// FR : GET /dashboard/overview — vue d'ensemble.
// EN : GET /dashboard/overview — overview.
const overview = asyncHandler(async (req, res) =>
  success(res, { message: 'Vue d\'ensemble', data: await dashboardService.overview(req.query) }));

// FR : GET /dashboard/kpis — indicateurs clés.
// EN : GET /dashboard/kpis — key KPIs.
const kpis = asyncHandler(async (req, res) =>
  success(res, { message: 'KPIs', data: await dashboardService.kpis(req.query) }));

// FR : GET /dashboard/revenue-series — série de CA.
// EN : GET /dashboard/revenue-series — revenue series.
const revenueSeries = asyncHandler(async (req, res) =>
  success(res, { message: 'Évolution du chiffre d\'affaires', data: await dashboardService.revenueSeries(req.query) }));

// FR : GET /dashboard/status-distribution — répartition par statut.
// EN : GET /dashboard/status-distribution — status distribution.
const statusDistribution = asyncHandler(async (req, res) =>
  success(res, { message: 'Répartition par statut', data: await dashboardService.statusDistribution(req.query) }));

// FR : GET /dashboard/order-volume — volume de commandes.
// EN : GET /dashboard/order-volume — order volume.
const orderVolume = asyncHandler(async (req, res) =>
  success(res, { message: 'Volume des commandes', data: await dashboardService.orderVolume(req.query) }));

// FR : GET /dashboard/delivery-funnel — entonnoir de livraison.
// EN : GET /dashboard/delivery-funnel — delivery funnel.
const deliveryFunnel = asyncHandler(async (req, res) =>
  success(res, { message: 'Funnel de livraison', data: await dashboardService.deliveryFunnel(req.query) }));

// FR : GET /dashboard/top-products — meilleurs produits.
// EN : GET /dashboard/top-products — top products.
const topProducts = asyncHandler(async (req, res) =>
  success(res, { message: 'Produits les plus vendus', data: await dashboardService.topProducts(req.query) }));

// FR : GET /dashboard/top-regions — meilleures régions.
// EN : GET /dashboard/top-regions — top regions.
const topRegions = asyncHandler(async (req, res) =>
  success(res, { message: 'Régions les plus performantes', data: await dashboardService.topRegions(req.query) }));

// FR : GET /dashboard/cancellation-by-region — annulations par région.
// EN : GET /dashboard/cancellation-by-region — cancellations by region.
const cancellationByRegion = asyncHandler(async (req, res) =>
  success(res, { message: 'Taux d\'annulation par région', data: await dashboardService.cancellationByRegion(req.query) }));

module.exports = {
  overview, kpis, revenueSeries, statusDistribution, orderVolume,
  deliveryFunnel, topProducts, topRegions, cancellationByRegion,
};
