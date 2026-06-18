/**
 * Centralized runtime configuration.
 *
 * Every environment-dependent value the frontend needs is resolved here, once,
 * from Vite's `import.meta.env`. Nothing else in the app should read
 * `import.meta.env` directly — import from this module instead.
 *
 * To connect the app to the real backend, it is enough to:
 *   1. Set `VITE_API_URL` to the backend origin (e.g. https://api.nuruya.com)
 *   2. Set `VITE_USE_MOCK=false`
 * No code change is required anywhere else.
 */

/** Read a string env var with a fallback. */
function readString(key, fallback = '') {
  const value = import.meta.env?.[key];
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

/** Read a boolean env var (`"true"`/`"false"`) with a fallback. */
function readBool(key, fallback = false) {
  const value = import.meta.env?.[key];
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

/** Read a numeric env var with a fallback. */
function readNumber(key, fallback = 0) {
  const value = Number(import.meta.env?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

const apiUrl = readString('VITE_API_URL', 'http://localhost:4000').replace(/\/+$/, '');
const apiPrefix = readString('VITE_API_PREFIX', '/api/v1');

export const config = Object.freeze({
  /** Backend origin, without trailing slash (e.g. http://localhost:4000). */
  apiUrl,
  /** API version prefix mounted by the backend (Express mounts `/api/v1`). */
  apiPrefix,
  /** Fully-qualified API base, e.g. http://localhost:4000/api/v1 */
  apiBaseUrl: `${apiUrl}${apiPrefix}`,

  /**
   * When true, services return local mock data instead of calling the backend.
   * Defaults to `true` so the UI is fully functional before the backend is live.
   * Flip to `false` (or set VITE_USE_MOCK=false) once endpoints are available.
   */
  useMock: readBool('VITE_USE_MOCK', true),

  /** Simulated latency (ms) for mock responses, to exercise loading states. */
  mockLatency: readNumber('VITE_MOCK_LATENCY', 350),

  /** Fixed USD→GHS reference rate used across the UI. */
  usdToGhs: readNumber('VITE_USD_TO_GHS', 15.4),

  /** Storage keys for the JWT pair. */
  tokenStorageKey: 'nuruya_access_token',
  refreshTokenStorageKey: 'nuruya_refresh_token',

  /** Convenience flags. */
  isDev: import.meta.env?.DEV ?? false,
  isProd: import.meta.env?.PROD ?? false,
});

export default config;
