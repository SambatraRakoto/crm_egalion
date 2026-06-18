/**
 * Shared API primitives.
 *
 * The Node/Express backend wraps every response in a standard envelope:
 *   success: { success: true,  message, data }
 *   failure: { success: false, message, errors }
 * The HTTP client unwraps `data` for callers; these types document the contract.
 */

/** Standard success envelope returned by the backend. */
export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

/** Field-level validation error (express-validator shape). */
export interface ApiFieldError {
  field: string;
  message: string;
}

/** Standard failure envelope returned by the backend. */
export interface ApiFailure {
  success: false;
  message: string;
  errors?: ApiFieldError[];
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

/** Cursor/offset pagination metadata. */
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** A paginated list response (already unwrapped from the envelope). */
export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

/** Common query params for list endpoints. */
export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Dashboard/finance period presets understood by the backend. */
export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';

/** Monetary amount expressed in both currencies the UI supports. */
export interface Money {
  usd: number;
  ghs: number;
}

export type Currency = 'USD' | 'GHS';
