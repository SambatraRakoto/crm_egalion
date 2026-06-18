/**
 * FR : Stockage des jetons JWT. Le jeton d'accès vit en mémoire (rapide, durée
 *      de l'onglet) et dans localStorage (survit aux rechargements) ; le jeton
 *      de rafraîchissement vit dans localStorage. Passer à des cookies httpOnly
 *      plus tard ne demande de modifier que ce module.
 * EN : JWT token storage. The access token is kept in memory (fast, per-tab) and
 *      in localStorage (survives reloads); the refresh token lives in
 *      localStorage. Switching to httpOnly cookies later only touches this module.
 */
import { config } from '@/config/env';

let accessTokenMemory = null;

// FR : Sélectionne un stockage sûr (localStorage si dispo, sinon une Map en mémoire).
// EN : Pick a safe storage (localStorage when available, otherwise an in-memory Map).
const safeStorage = (() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    /* access can throw in sandboxed iframes */
  }
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
})();

export const tokenStorage = {
  // FR : Renvoie le jeton d'accès (mémoire puis localStorage).
  // EN : Return the access token (memory first, then localStorage).
  getAccessToken() {
    if (accessTokenMemory) return accessTokenMemory;
    accessTokenMemory = safeStorage.getItem(config.tokenStorageKey);
    return accessTokenMemory;
  },

  // FR : Renvoie le jeton de rafraîchissement.
  // EN : Return the refresh token.
  getRefreshToken() {
    return safeStorage.getItem(config.refreshTokenStorageKey);
  },

  // FR : Persiste la paire de jetons (accès et/ou rafraîchissement).
  // EN : Persist the token pair (access and/or refresh).
  setTokens({ accessToken, refreshToken }) {
    if (accessToken !== undefined) {
      accessTokenMemory = accessToken;
      safeStorage.setItem(config.tokenStorageKey, accessToken);
    }
    if (refreshToken !== undefined && refreshToken !== null) {
      safeStorage.setItem(config.refreshTokenStorageKey, refreshToken);
    }
  },

  // FR : Efface tous les jetons (déconnexion).
  // EN : Clear all tokens (logout).
  clear() {
    accessTokenMemory = null;
    safeStorage.removeItem(config.tokenStorageKey);
    safeStorage.removeItem(config.refreshTokenStorageKey);
  },

  // FR : Indique s'il existe une session (jeton d'accès présent).
  // EN : Whether a session exists (an access token is present).
  hasSession() {
    return Boolean(this.getAccessToken());
  },
};

export default tokenStorage;
