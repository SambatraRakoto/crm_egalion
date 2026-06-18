'use strict';

const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, paginationMeta } = require('../utils/response');
const { parsePagination } = require('../utils/queryParams');

// FR : GET /audit-logs — journal d'audit paginé.
// EN : GET /audit-logs — paginated audit log.
const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { total, rows } = await auditService.list({
    limit,
    offset,
    userId: req.query.userId,
    action: req.query.action,
  });
  return success(res, { message: 'Journal d\'audit', data: rows, meta: paginationMeta({ page, limit, total }) });
});

module.exports = { list };
