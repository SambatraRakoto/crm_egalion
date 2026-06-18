'use strict';

const auditRepo = require('../repositories/audit.repository');
const logger = require('../utils/logger');

/**
 * Record an audit entry. Never throws — audit failures must not break the
 * primary action. Pass the Express req to capture actor, ip and user agent.
 */
// FR : Enregistre une entrée d'audit (ne lève jamais d'erreur).
// EN : Record an audit entry (never throws).
async function record(req, { action, entityType, entityId, metadata } = {}) {
  try {
    await auditRepo.insert({
      userId: req && req.user ? req.user.id : null,
      action,
      entityType,
      entityId,
      metadata,
      ip: req ? req.ip : null,
      userAgent: req ? req.headers['user-agent'] : null,
    });
  } catch (err) {
    logger.error('Failed to write audit log', err);
  }
}

// FR : Liste paginée du journal d'audit.
// EN : Paginated audit-log list.
async function list(opts) {
  return auditRepo.list(opts);
}

module.exports = { record, list };
