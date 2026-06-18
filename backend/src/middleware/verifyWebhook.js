'use strict';

const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Verify an HMAC-SHA256 webhook signature against the raw request body.
 * If no secret is configured, verification is skipped (dev convenience) with a
 * warning. `headerName` is the request header carrying the signature.
 */
// FR : Fabrique un middleware de vérification HMAC de webhook.
// EN : Build a webhook HMAC verification middleware.
module.exports = function verifyWebhook(getSecret, headerName = 'x-shaq-signature') {
  return function (req, res, next) {
    const secret = getSecret();
    if (!secret) {
      logger.warn(`Webhook signature not verified: no secret configured (${headerName})`);
      return next();
    }

    const signature = req.headers[headerName];
    if (!signature) return next(ApiError.unauthorized('Signature webhook manquante'));

    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return next(ApiError.unauthorized('Signature webhook invalide'));
    }
    return next();
  };
};
