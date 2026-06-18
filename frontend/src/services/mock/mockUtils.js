/** Helpers shared by the mock service implementations. */
import { config } from '@/config/env';
import { ApiError } from '@/lib/apiError';

/** Resolve `value` after the configured mock latency, to exercise loading UI. */
export function simulate(value) {
  const resolved = typeof value === 'function' ? value() : value;
  return new Promise((resolve) => {
    setTimeout(() => resolve(resolved), config.mockLatency);
  });
}

/** Reject with an ApiError after the configured latency. */
export function simulateError(message, { status = 400, fieldErrors = [] } = {}) {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new ApiError(message, { status, fieldErrors })), config.mockLatency);
  });
}

/** Deep clone so callers never mutate the mock store by reference. */
export function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

/** Offset-paginate an array into a `Paginated<T>` shape. */
export function paginate(items, page = 1, pageSize = items.length || 1) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    meta: { page: safePage, pageSize, total, totalPages },
  };
}
