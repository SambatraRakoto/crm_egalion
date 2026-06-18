'use strict';

const ApiError = require('./ApiError');

/**
 * Minimal Shopify Admin REST client built on global fetch (Node 18+).
 * Pass per-call settings so credentials can come from the DB, not only env.
 */
// FR : Crée un client REST Shopify Admin (fetch).
// EN : Create a Shopify Admin REST client (fetch).
function createClient({ storeDomain, accessToken, apiVersion }) {
  if (!storeDomain || !accessToken) {
    throw ApiError.badRequest('Identifiants Shopify non configurés');
  }
  const base = `https://${storeDomain}/admin/api/${apiVersion}`;

  async function request(path, { method = 'GET', query, body } = {}) {
    const url = new URL(`${base}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url, {
      method,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(res.status === 401 ? 401 : 502, `Erreur Shopify (${res.status}): ${text.slice(0, 300)}`);
    }
    return res.json();
  }

  return {
    getShop: () => request('/shop.json'),
    getProducts: (limit = 250) => request('/products.json', { query: { limit } }),
    getOrders: (limit = 250, status = 'any') => request('/orders.json', { query: { limit, status } }),
    listWebhooks: () => request('/webhooks.json'),
    createWebhook: (topic, address) =>
      request('/webhooks.json', { method: 'POST', body: { webhook: { topic, address, format: 'json' } } }),
  };
}

module.exports = { createClient };
