/**
 * Orders service.
 *
 * Mock mode keeps an in-memory copy of the generated orders so edits/archives
 * persist for the session. Real mode calls `/orders` (paginated) and normalizes
 * the snake_case rows into the UI `Order` shape. Both return UI-shaped objects.
 */
import { config } from '@/config/env';
import { http } from '@/api/httpClient';
import { endpoints } from '@/api/endpoints';
import { simulate } from '@/services/mock/mockUtils';
import { ORDERS, STATUS_CATEGORIES } from '@/lib/mockData';
import { categoryForStatus, displayForCanonical, canonicalForDisplay } from '@/lib/orderStatus';

/** @typedef {import('@/types').Order} Order */

// Mutable mock store (cloned so the generator's array stays pristine).
let mockOrders = ORDERS.map((o) => ({ ...o }));

const rate = () => config.usdToGhs;
// GHS is the base currency (stored backend value); USD is derived = GHS / rate.
const ghsToUsd = (ghsVal) => Number((Number(ghsVal || 0) / rate()).toFixed(2));
const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');

function normalizeItem(it) {
  return {
    id: it.id,
    productId: it.product_id ?? it.productId ?? null,
    name: it.product_name ?? it.name ?? '',
    sku: it.sku,
    quantity: Number(it.quantity ?? 1),
    unitPriceUSD: Number(it.unit_price ?? it.unitPrice ?? 0),
  };
}

/**
 * Normalize a raw backend order row (snake_case, canonical status) into the UI
 * `Order` shape. Adjust the field mapping here if the API payload changes.
 * @param {any} row
 * @returns {Order}
 */
export function normalizeOrder(row) {
  if (!row) return row;
  // Already in UI shape (mock store) — pass through.
  if (row.amountUSD !== undefined && row.customer !== undefined) return row;

  const items = Array.isArray(row.items) ? row.items.map(normalizeItem) : undefined;
  const canonical = row.delivery_status ?? row.status ?? 'pending';
  const display = displayForCanonical(canonical);
  // Stored backend amounts are in GHS (base currency); USD is derived.
  const amountGhs = Number(row.order_amount ?? 0);
  const deliveryGhs = Number(row.delivery_cost ?? 0);
  const shaqGhs = Number(row.shaq_cost ?? 0);
  // First line item (from the list query's LATERAL join, or the items array).
  // Product name only — never fall back to the order number (keeps the Product
  // column coherent; the UI shows "—" when there is no product).
  const firstName = row.first_product ?? items?.[0]?.name ?? '';
  const quantity = Number(row.first_quantity ?? row.total_quantity ?? items?.[0]?.quantity ?? 0);
  const unitPriceGhs = Number(row.first_unit_price ?? items?.[0]?.unitPriceUSD ?? 0);
  // commission ShaQ = 5% × order amount (dynamic).
  const commissionGhs = Number((amountGhs * 0.05).toFixed(2));

  return {
    id: row.id,
    shopifyId: row.shopify_order_id ?? null,
    shaqTrackingId: row.shaq_tracking_id ?? null,
    orderNumber: row.order_number ?? null,
    customer: row.customer_name ?? '',
    phone: row.customer_phone ?? '',
    region: row.region ?? '',
    product: firstName,
    quantity,
    // Total units across all line items (for multi-product orders).
    totalQuantity: Number(row.total_quantity ?? quantity ?? 0),
    unitPriceGHS: unitPriceGhs,
    unitPriceUSD: ghsToUsd(unitPriceGhs),
    items,
    status: display,
    category: categoryForStatus(display),
    amountGHS: amountGhs,
    amountUSD: ghsToUsd(amountGhs),
    deliveryCostGHS: deliveryGhs,
    deliveryCostUSD: ghsToUsd(deliveryGhs),
    commissionShaqGHS: commissionGhs,
    commissionShaqUSD: ghsToUsd(commissionGhs),
    shaqCostGHS: shaqGhs,
    shaqCostUSD: ghsToUsd(shaqGhs),
    date: dateOnly(row.ordered_at || row.created_at),
    updatedAt: dateOnly(row.updated_at || row.ordered_at || row.created_at),
    deliveredAt: dateOnly(row.delivered_at),
    // Raw timestamps (untruncated) for precise duration math.
    orderedAtRaw: row.ordered_at || row.created_at || null,
    deliveredAtRaw: row.delivered_at || null,
    notes: row.notes ?? '',
    archived: Boolean(row.archived),
  };
}

/** Map a UI edit/create payload to the backend order body. */
function toApiPayload(payload = {}) {
  const body = {};
  if (payload.customer !== undefined) body.customerName = payload.customer;
  if (payload.phone !== undefined) body.customerPhone = payload.phone;
  if (payload.email !== undefined) body.customerEmail = payload.email;
  if (payload.region !== undefined) body.region = payload.region;
  if (payload.city !== undefined) body.city = payload.city;
  if (payload.address !== undefined) body.deliveryAddress = payload.address;
  // Amounts are entered/stored in GHS (base currency) → backend columns.
  if (payload.amountGHS !== undefined) body.orderAmount = Number(payload.amountGHS);
  else if (payload.amountUSD !== undefined) body.orderAmount = Number(payload.amountUSD);
  if (payload.deliveryCostGHS !== undefined) body.deliveryCost = Number(payload.deliveryCostGHS);
  else if (payload.deliveryCostUSD !== undefined) body.deliveryCost = Number(payload.deliveryCostUSD);
  if (payload.shaqCostGHS !== undefined) body.shaqCost = Number(payload.shaqCostGHS);
  if (payload.paymentMethod !== undefined) body.paymentMethod = payload.paymentMethod;
  if (payload.status !== undefined) body.deliveryStatus = canonicalForDisplay(payload.status);
  if (payload.notes !== undefined) body.notes = payload.notes;
  // FR : Le produit saisi (texte) devient une ligne de commande → alimente la colonne « Product ».
  // EN : The typed product (text) becomes an order line item → feeds the "Product" column.
  if (payload.product) {
    const quantity = Number(payload.quantity) || 1;
    const unitPrice = payload.unitPriceGHS !== undefined
      ? Number(payload.unitPriceGHS)
      : Number((Number(body.orderAmount || 0) / quantity).toFixed(2));
    body.items = [{ productName: payload.product, quantity, unitPrice }];
  }
  return body;
}

/** Fetch every order by walking the paginated endpoint (for client-side views). */
async function fetchAllOrders(params = {}) {
  const all = [];
  let page = 1;
  const limit = 100;
  const MAX_PAGES = 100; // safety cap (10k orders)
  for (; page <= MAX_PAGES; page++) {
    const { data, meta } = await http.getRaw(endpoints.orders.root, { params: { ...params, page, limit } });
    const rows = Array.isArray(data) ? data : data?.items ?? [];
    all.push(...rows.map(normalizeOrder));
    if (!meta || !meta.hasNext) break;
  }
  return all;
}

export const ordersService = {
  /**
   * Full order list. The Orders page filters/paginates client-side, so we fetch
   * every page. Pass params to scope the fetch.
   * @param {import('@/types').OrderListParams} [params]
   * @returns {Promise<Order[]>}
   */
  async getAll(params) {
    if (config.useMock) return simulate(() => mockOrders.map((o) => ({ ...o })));
    return fetchAllOrders(params);
  },

  /** Single page of orders with pagination meta (for server-paginated views). */
  async getPage(params) {
    if (config.useMock) {
      return simulate(() => ({ items: mockOrders.map((o) => ({ ...o })), meta: null }));
    }
    const { data, meta } = await http.getRaw(endpoints.orders.root, { params });
    const rows = Array.isArray(data) ? data : data?.items ?? [];
    return { items: rows.map(normalizeOrder), meta };
  },

  /** @returns {Promise<Order>} */
  async getById(id) {
    if (config.useMock) {
      return simulate(() => {
        const found = mockOrders.find((o) => o.id === id);
        return found ? { ...found } : null;
      });
    }
    return normalizeOrder(await http.get(endpoints.orders.byId(id)));
  },

  /**
   * @param {object} payload UI order fields (customer, phone, region, status, …).
   * @returns {Promise<Order>}
   */
  async create(payload) {
    if (config.useMock) {
      return simulate(() => {
        const id = `ORD-${String(10000 + mockOrders.length).padStart(5, '0')}`;
        const status = payload.status || 'Pending';
        // GHS is the base currency; USD is derived.
        const amountGHS = Number(payload.amountGHS ?? payload.amountUSD) || 0;
        const deliveryGHS = Number(payload.deliveryCostGHS ?? payload.deliveryCostUSD) || 0;
        const order = {
          id,
          shopifyId: null,
          customer: payload.customer || '',
          phone: payload.phone || '',
          region: payload.region || '',
          product: payload.product || '',
          status,
          category: categoryForStatus(status),
          amountGHS,
          amountUSD: ghsToUsd(amountGHS),
          deliveryCostGHS: deliveryGHS,
          deliveryCostUSD: ghsToUsd(deliveryGHS),
          commissionShaqGHS: Number((amountGHS * 0.05).toFixed(2)),
          commissionShaqUSD: ghsToUsd(amountGHS * 0.05),
          shaqCostGHS: 0,
          shaqCostUSD: 0,
          quantity: 1,
          unitPriceGHS: amountGHS,
          unitPriceUSD: ghsToUsd(amountGHS),
          date: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
          deliveredAt: ['Delivered', 'Confirmed'].includes(status) ? new Date().toISOString().slice(0, 10) : '',
          notes: payload.notes || '',
          archived: false,
        };
        mockOrders = [order, ...mockOrders];
        return { ...order };
      });
    }
    return normalizeOrder(await http.post(endpoints.orders.root, toApiPayload(payload)));
  },

  /**
   * @param {string} id
   * @param {object} payload UI fields (customer, phone, region, status, notes).
   * @returns {Promise<Order>}
   */
  async update(id, payload) {
    if (config.useMock) {
      return simulate(() => {
        mockOrders = mockOrders.map((o) =>
          o.id === id
            ? {
                ...o,
                ...payload,
                category: payload.status ? categoryForStatus(payload.status) : o.category,
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : o,
        );
        return { ...mockOrders.find((o) => o.id === id) };
      });
    }
    return normalizeOrder(await http.put(endpoints.orders.byId(id), toApiPayload(payload)));
  },

  /** @returns {Promise<void>} */
  async remove(id) {
    if (config.useMock) {
      return simulate(() => {
        mockOrders = mockOrders.filter((o) => o.id !== id);
      });
    }
    await http.delete(endpoints.orders.byId(id));
  },

  async archive(id) {
    if (config.useMock) {
      return simulate(() => {
        mockOrders = mockOrders.map((o) => (o.id === id ? { ...o, archived: true } : o));
      });
    }
    await http.patch(endpoints.orders.archive(id));
  },

  async restore(id) {
    if (config.useMock) {
      return simulate(() => {
        mockOrders = mockOrders.map((o) => (o.id === id ? { ...o, archived: false } : o));
      });
    }
    await http.patch(endpoints.orders.restore(id));
  },

  /**
   * Apply a bulk change. Dispatches to the three dedicated backend routes
   * (/bulk/status, /bulk/archive, /bulk/notes) depending on which fields are set.
   * @param {import('@/types').OrderBulkPayload} payload
   */
  async bulkUpdate(payload) {
    const { ids = [], status, notes, archived } = payload;
    if (config.useMock) {
      const set = new Set(ids);
      return simulate(() => {
        mockOrders = mockOrders.map((o) => {
          if (!set.has(o.id)) return o;
          const next = { ...o };
          if (status) {
            next.status = status;
            next.category = categoryForStatus(status);
          }
          if (notes !== undefined) next.notes = notes;
          if (archived !== undefined) next.archived = archived;
          next.updatedAt = new Date().toISOString().slice(0, 10);
          return next;
        });
      });
    }
    const calls = [];
    if (status !== undefined) {
      calls.push(http.patch(endpoints.orders.bulkStatus, { ids, status: canonicalForDisplay(status) }));
    }
    if (archived !== undefined) {
      calls.push(http.patch(endpoints.orders.bulkArchive, { ids, archived }));
    }
    if (notes !== undefined) {
      calls.push(http.patch(endpoints.orders.bulkNotes, { ids, notes }));
    }
    await Promise.all(calls);
  },
};

export { STATUS_CATEGORIES };
export default ordersService;
