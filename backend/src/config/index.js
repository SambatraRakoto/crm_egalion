'use strict';

require('dotenv').config();

// FR : Lit une variable d'env requise (ou valeur par défaut).
// EN : Read a required env var (or fallback).
function required(key, fallback) {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// FR : Convertit une variable d'env en booléen.
// EN : Coerce an env var to boolean.
function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

// FR : Convertit une variable d'env en entier.
// EN : Coerce an env var to integer.
function int(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: int(process.env.PORT, 4000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  // Business timezone. Ghana = Africa/Accra (GMT+0, no DST).
  timezone: process.env.APP_TIMEZONE || 'Africa/Accra',
  // Public base URL of this API, used to register Shopify webhooks (no trailing slash).
  publicUrl: (process.env.APP_PUBLIC_URL || '').replace(/\/$/, ''),

  db: {
    host: process.env.PGHOST || 'localhost',
    port: int(process.env.PGPORT, 5432),
    database: process.env.PGDATABASE || 'nuruya_crm',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    ssl: bool(process.env.PGSSL) ? { rejectUnauthorized: false } : false,
    max: int(process.env.PG_POOL_MAX, 10),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  security: {
    bcryptRounds: int(process.env.BCRYPT_ROUNDS, 10),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rateWindowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    rateMax: int(process.env.RATE_LIMIT_MAX, 300),
    authRateMax: int(process.env.AUTH_RATE_LIMIT_MAX, 20),
  },

  shopify: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-10',
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || '',
    // Safety-net reconcile: periodically re-pull recent Shopify orders and upsert
    // to catch any missed orders/create webhook. OFF by default (opt-in): when on,
    // it re-asserts Shopify as the source of truth for customer/region/address/
    // amount on recent orders (would revert manual CRM edits to those fields).
    // delivery_status / dates / tracking are never touched. Minutes (0 disables).
    reconcileIntervalMinutes: Number(process.env.SHOPIFY_RECONCILE_MINUTES || 0),
  },

  shaq: {
    // Partner API base (test: https://test-partner.shaqexpress.com/api/v1).
    apiBase: (process.env.SHAQ_API_BASE || 'https://test-partner.shaqexpress.com/api/v1').replace(/\/$/, ''),
    // Partner login credentials (POST /auth/login → Bearer token).
    identifier: process.env.SHAQ_IDENTIFIER || '',
    secret: process.env.SHAQ_SECRET || '',
    apiKey: process.env.SHAQ_API_KEY || '',
    webhookSecret: process.env.SHAQ_WEBHOOK_SECRET || '',
    // Sender (origin) defaults used when creating packages.
    sourceCountryIso2: process.env.SHAQ_SOURCE_COUNTRY || 'GH',
    sourceAddress: process.env.SHAQ_SOURCE_ADDRESS || 'Accra, Ghana',
    // Destination country (domestic Ghana delivery by default). Required by ShaQ.
    destCountryIso2: process.env.SHAQ_DEST_COUNTRY || 'GH',
    // Prefix for our order references == ShaQ partner_ref (dedup key).
    orderRefPrefix: process.env.SHAQ_ORDER_PREFIX || '#NA-',
    // Auto-ship: every Shopify order received is sent to ShaQ automatically.
    // Default ON when credentials are set; can be forced via SHAQ_AUTO_SHIP.
    autoShip: process.env.SHAQ_AUTO_SHIP
      ? process.env.SHAQ_AUTO_SHIP === 'true'
      : Boolean(process.env.SHAQ_IDENTIFIER && process.env.SHAQ_SECRET),
    // Catch-up job: periodically ship Pending orders not yet sent (e.g. orders
    // received while ShaQ was down). Minutes between runs (0 disables it).
    retryIntervalMinutes: Number(process.env.SHAQ_RETRY_INTERVAL_MINUTES || 15),
  },
};

module.exports = config;
