'use strict';

const config = require('../config');
const ApiError = require('./ApiError');
const logger = require('./logger');

/**
 * ShaQ Express partner API client (outbound), built on global fetch.
 * Reference: https://test-partner.shaqexpress.com/api/v1
 *
 * Auth: POST /auth/login { identifier, secret } -> Bearer token.
 * The token is cached at module scope and refreshed on 401 or expiry.
 */

let cachedToken = null;
let tokenExpiresAt = 0;

// FR : Indique si les identifiants ShaQ sont configurés.
// EN : Whether ShaQ credentials are configured.
function configured() {
  return Boolean(config.shaq.identifier && config.shaq.secret);
}

// FR : Requête HTTP brute vers l'API ShaQ (sans gestion du token).
// EN : Raw HTTP request to the ShaQ API (no token handling).
async function rawRequest(path, { method = 'GET', query, body, token } = {}) {
  const url = new URL(`${config.shaq.apiBase}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

/** Log in and cache the Bearer token. */
// FR : Se connecte et met en cache le jeton Bearer.
// EN : Log in and cache the Bearer token.
async function login() {
  if (!configured()) {
    throw ApiError.badRequest('Identifiants ShaQ non configurés (SHAQ_IDENTIFIER / SHAQ_SECRET)');
  }
  const { ok, status, data } = await rawRequest('/auth/login', {
    method: 'POST',
    body: { identifier: config.shaq.identifier, secret: config.shaq.secret },
  });
  if (!ok) throw new ApiError(status === 401 ? 401 : 502, `Échec de connexion ShaQ (${status})`);
  const token = data?.token || data?.data?.token || data?.access_token;
  if (!token) throw new ApiError(502, 'Réponse de connexion ShaQ invalide (token manquant)');
  cachedToken = token;
  // ShaQ tokens are short-lived; refresh defensively every ~50 min.
  tokenExpiresAt = Date.now() + 50 * 60 * 1000;
  logger.info('ShaQ partner API: authenticated');
  return token;
}

// FR : Renvoie un jeton valide (reconnexion si expiré).
// EN : Return a valid token (re-login if expired).
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  return login();
}

/** Authenticated request with one transparent re-login on 401. */
// FR : Requête authentifiée avec reconnexion transparente sur 401.
// EN : Authenticated request with transparent re-login on 401.
async function request(path, options = {}, _retry = false) {
  const token = await getToken();
  const res = await rawRequest(path, { ...options, token });
  if (res.status === 401 && !_retry) {
    cachedToken = null;
    return request(path, options, true);
  }
  if (!res.ok) {
    const msg = (res.data && (res.data.message || res.data.error)) || JSON.stringify(res.data || '').slice(0, 300);
    throw new ApiError(res.status >= 500 ? 502 : res.status, `Erreur ShaQ (${res.status}): ${msg}`);
  }
  return res.data;
}

const shaqClient = {
  configured,
  login,
  /** Create a single package. `payload.partner_ref` must be unique (dedup key). */
  createPackage: (payload) => request('/packages', { method: 'POST', body: payload }),
  /** Paginated list of packages. */
  getPackages: ({ page = 1, limit = 50 } = {}) => request('/packages', { query: { page, limit } }),
  /** Single package by partner_ref (includes trackingHistory). */
  getPackage: (partnerRef) => request(`/packages/${encodeURIComponent(partnerRef)}`),
  /** Track by tracking number (status + history). */
  track: (trackingNumber) => request(`/tracking/${encodeURIComponent(trackingNumber)}`),
};

module.exports = shaqClient;
