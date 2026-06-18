'use strict';

const financeService = require('../services/finance.service');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

// FR : GET /finance/summary — synthèse financière.
// EN : GET /finance/summary — financial summary.
const summary = asyncHandler(async (req, res) =>
  success(res, { message: 'Synthèse financière', data: await financeService.summary(req.query) }));

// FR : GET /finance/report — rapport financier.
// EN : GET /finance/report — financial report.
const report = asyncHandler(async (req, res) =>
  success(res, { message: 'Rapport financier', data: await financeService.report(req.query) }));

module.exports = { summary, report };
