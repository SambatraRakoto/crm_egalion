/**
 * FR : Erreur API normalisée. Toute défaillance remontée par le client HTTP est
 *      une `ApiError`, donc l'UI s'appuie sur une seule forme :
 *      `error.message`, `error.status`, `error.fieldErrors`.
 * EN : Normalized API error. Every failure surfaced by the HTTP client is an
 *      `ApiError`, so UI code relies on a single shape: `error.message`,
 *      `error.status`, `error.fieldErrors`.
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {object} [opts]
   * @param {number} [opts.status]
   * @param {import('@/types').ApiFieldError[]} [opts.fieldErrors]
   * @param {string} [opts.code]
   * @param {unknown} [opts.cause]
   */
  constructor(message, { status = 0, fieldErrors = [], code, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.code = code;
    if (cause) this.cause = cause;
  }

  /** True when the failure is a 401 (expired/invalid session). */
  // FR : Vrai si 401 (session expirée/invalide). EN : True on 401 (expired/invalid session).
  get isUnauthorized() {
    return this.status === 401;
  }

  // FR : Vrai si 403 (accès interdit). EN : True on 403 (forbidden).
  get isForbidden() {
    return this.status === 403;
  }

  // FR : Vrai si 404 (ressource introuvable). EN : True on 404 (not found).
  get isNotFound() {
    return this.status === 404;
  }

  /** FR : Échec réseau/CORS (pas de statut HTTP). EN : Network/CORS failure (no HTTP status). */
  get isNetwork() {
    return this.status === 0;
  }

  /** FR : Transforme les erreurs de champ en objet `{ champ: message }` (utile pour les formulaires).
   *  EN : Map field errors to a `{ field: message }` object (handy for forms). */
  get fieldErrorMap() {
    return this.fieldErrors.reduce((acc, e) => {
      acc[e.field] = e.message;
      return acc;
    }, /** @type {Record<string,string>} */ ({}));
  }
}

export default ApiError;
