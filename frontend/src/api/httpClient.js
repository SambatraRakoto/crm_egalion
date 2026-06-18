/**
 * Central HTTP client (Fetch based — no extra dependency).
 *
 * Responsibilities:
 *  - Prefix every request with `config.apiBaseUrl`.
 *  - Attach the JWT `Authorization` header.
 *  - Serialize query params and JSON bodies.
 *  - Unwrap the backend `{ success, message, data }` envelope → returns `data`.
 *  - Normalize every failure into an `ApiError`.
 *  - Transparently refresh the access token once on 401 (single-flight), then
 *    retry the original request. If refresh fails, clear the session and emit
 *    an `auth:unauthorized` event so the app can redirect to login.
 *
 * Everything funnels through one `request()` so switching transport (axios,
 * cookies, etc.) later is a one-file change.
 */
import { config } from '@/config/env';
import { endpoints } from '@/api/endpoints';
import { tokenStorage } from '@/lib/tokenStorage';
import { ApiError } from '@/lib/apiError';

/** Broadcast that the session is no longer valid (AuthContext listens to this). */
export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';
function emitUnauthorized() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  }
}

/** Build a query string from a params object, skipping nullish/empty values. */
function buildQuery(params) {
  if (!params) return '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    usp.append(key, String(value));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

/** Parse the response body, tolerating empty/non-JSON payloads. */
async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Turn any failed response/body into an ApiError. */
function toApiError(response, body) {
  const message =
    (body && typeof body === 'object' && (body.message || body.error)) ||
    (typeof body === 'string' && body) ||
    response.statusText ||
    'Request failed';
  const fieldErrors =
    (body && typeof body === 'object' && Array.isArray(body.errors) && body.errors) || [];
  return new ApiError(message, { status: response.status, fieldErrors });
}

// ─── Refresh single-flight ────────────────────────────────────────────────────
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new ApiError('No refresh token', { status: 401 });

  const response = await fetch(`${config.apiBaseUrl}${endpoints.auth.refresh}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const body = await parseBody(response);
  if (!response.ok) throw toApiError(response, body);

  const data = body?.data ?? body;
  tokenStorage.setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  return data.accessToken;
}

/**
 * Core request.
 * @template T
 * @param {string} path  Endpoint path (relative to apiBaseUrl).
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.body]   JSON body (object) — serialized automatically.
 * @param {object} [options.params] Query params.
 * @param {boolean} [options.auth]  Attach Authorization header (default true).
 * @param {boolean} [options.raw]   Return the full envelope `{data, meta, message}` instead of just `data`.
 * @param {boolean} [options._retry] Internal: marks a post-refresh retry.
 * @param {object} [options.headers]
 * @returns {Promise<T>} The unwrapped `data` payload (or `{data, meta}` when `raw`).
 */
async function request(path, options = {}) {
  const { method = 'GET', body, params, auth = true, raw = false, headers = {}, _retry = false } = options;

  const finalHeaders = { Accept: 'application/json', ...headers };
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (auth) {
    const token = tokenStorage.getAccessToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}${buildQuery(params)}`, {
      method,
      headers: finalHeaders,
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    throw new ApiError('Network error — could not reach the server.', { status: 0, cause });
  }

  // Transparent refresh-and-retry on 401 (once).
  if (response.status === 401 && auth && !_retry && path !== endpoints.auth.refresh) {
    try {
      refreshPromise = refreshPromise || refreshAccessToken();
      await refreshPromise;
      refreshPromise = null;
      return request(path, { ...options, _retry: true });
    } catch (refreshErr) {
      refreshPromise = null;
      tokenStorage.clear();
      emitUnauthorized();
      throw refreshErr instanceof ApiError
        ? refreshErr
        : new ApiError('Session expired', { status: 401, cause: refreshErr });
    }
  }

  const data = await parseBody(response);
  if (!response.ok) {
    if (response.status === 401) emitUnauthorized();
    throw toApiError(response, data);
  }

  // Unwrap the standard envelope; tolerate already-unwrapped payloads.
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return raw ? { data: data.data, meta: data.meta, message: data.message } : data.data;
  }
  return raw ? { data, meta: undefined } : data;
}

export const http = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  /** GET returning `{ data, meta }` (for paginated list endpoints). */
  getRaw: (path, options) => request(path, { ...options, method: 'GET', raw: true }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  request,
};

export default http;
