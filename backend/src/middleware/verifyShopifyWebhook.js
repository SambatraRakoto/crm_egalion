'use strict';

const crypto = require('crypto');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Verify a Shopify webhook. Shopify signs the raw request body with HMAC-SHA256
 * (base64) using the app's webhook secret, sent in the X-Shopify-Hmac-Sha256
 * header. If no secret is configured, verification is skipped (dev only).
 */
// FR : Vérifie la signature HMAC d'un webhook Shopify.
// EN : Verify a Shopify webhook HMAC signature.
module.exports = function verifyShopifyWebhook(req, res, next) {
  const secret = config.shopify.webhookSecret;
  if (!secret) {
    logger.warn('Shopify webhook signature not verified: SHOPIFY_WEBHOOK_SECRET not set');
    return next();
  }

  const signature = req.headers['x-shopify-hmac-sha256'];
  if (!signature) return next(ApiError.unauthorized('Signature Shopify manquante'));

  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(ApiError.unauthorized('Signature Shopify invalide'));
  }
  return next();
};
