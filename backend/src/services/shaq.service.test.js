'use strict';
// Test API (describe/it/expect/vi) is global — see vitest.config.mjs (globals:true).

// Monkey-patch the repo modules' methods. shaq.service references them by
// property at call time, so replacing the methods on the cached module object
// is enough — no module-mock hoisting needed.
const orderRepo = require('../repositories/order.repository');
const eventRepo = require('../repositories/deliveryEvent.repository');
const shaqService = require('./shaq.service');

const ORDER = { id: 'o1', delivery_status: 'dispatched', order_number: '#NA6325' };

beforeEach(() => {
  orderRepo.findByTracking = vi.fn().mockResolvedValue(null);
  orderRepo.findByOrderNumber = vi.fn().mockResolvedValue(null);
  orderRepo.update = vi.fn().mockResolvedValue({});
  orderRepo.setOrderedAtFromEvents = vi.fn().mockResolvedValue(null);
  eventRepo.insert = vi.fn().mockResolvedValue({ id: 'evt-row' });
});

const envelope = (over = {}) => ({
  event: 'package.status_updated',
  event_id: 'evt-1',
  occurred_at: '2026-06-25T18:25:57.000Z',
  data: { status: 'delivered', partner_ref: '#NA6325', tracking_number: 'CA0A7792' },
  ...over,
});

describe('handleWebhook — ShaQ envelope', () => {
  it('reads status from data.status (NOT body.event) and updates the order', async () => {
    orderRepo.findByTracking.mockResolvedValue({ ...ORDER });
    const res = await shaqService.handleWebhook(envelope());
    expect(orderRepo.update).toHaveBeenCalledTimes(1);
    const [, patch] = orderRepo.update.mock.calls[0];
    expect(patch.deliveryStatus).toBe('delivered');
    expect(res.orderUpdated).toBe(true);
  });

  it('stamps delivered_at from the envelope occurred_at when no tracking[] is present', async () => {
    orderRepo.findByTracking.mockResolvedValue({ ...ORDER });
    await shaqService.handleWebhook(envelope());
    const [, patch] = orderRepo.update.mock.calls[0];
    expect(patch.deliveredAt).toBeInstanceOf(Date);
    expect(patch.deliveredAt.getTime()).toBe(new Date('2026-06-25T18:25:57.000Z').getTime());
  });

  it('prefers the tracking[] delivered step over occurred_at (poll payload)', async () => {
    orderRepo.findByOrderNumber.mockImplementation(async (ref) => (ref === '#NA6325' ? { ...ORDER } : null));
    const body = {
      occurred_at: '2026-06-25T18:00:00.000Z',
      data: {
        status: 'delivered', partner_ref: '#NA6325',
        tracking: [
          { name: 'dispatched', date: '2026-06-19T09:00:00.000Z' },
          { name: 'delivered', date: '2026-06-20T10:00:00.000Z' },
        ],
      },
    };
    await shaqService.handleWebhook(body);
    const [, patch] = orderRepo.update.mock.calls[0];
    expect(patch.deliveredAt.getTime()).toBe(new Date('2026-06-20T10:00:00.000Z').getTime());
  });

  it('passes event_id to the event insert', async () => {
    orderRepo.findByTracking.mockResolvedValue({ ...ORDER });
    await shaqService.handleWebhook(envelope());
    expect(eventRepo.insert).toHaveBeenCalledTimes(1);
    expect(eventRepo.insert.mock.calls[0][0].eventId).toBe('evt-1');
  });

  it('is idempotent: a replayed event_id (insert skipped) does NOT re-update', async () => {
    orderRepo.findByTracking.mockResolvedValue({ ...ORDER });
    eventRepo.insert.mockResolvedValue(undefined); // ON CONFLICT DO NOTHING → no row
    const res = await shaqService.handleWebhook(envelope());
    expect(res.duplicate).toBe(true);
    expect(orderRepo.update).not.toHaveBeenCalled();
  });

  it('does not change status for non status-update events (amount_to_collect)', async () => {
    orderRepo.findByTracking.mockResolvedValue({ ...ORDER });
    await shaqService.handleWebhook(envelope({ event: 'package.amount_to_collect_updated', event_id: 'evt-2' }));
    expect(orderRepo.update).not.toHaveBeenCalled();
  });

  it('does not update when the mapped status equals the current one', async () => {
    orderRepo.findByTracking.mockResolvedValue({ ...ORDER, delivery_status: 'delivered' });
    await shaqService.handleWebhook(envelope());
    expect(orderRepo.update).not.toHaveBeenCalled();
  });

  it('matches the order by partner_ref when tracking is unknown', async () => {
    orderRepo.findByOrderNumber.mockImplementation(async (ref) => (ref === '#NA6325' ? { ...ORDER } : null));
    const res = await shaqService.handleWebhook(envelope({ data: { status: 'delivered', partner_ref: '#NA6325' } }));
    expect(res.matchedOrder).toBe('o1');
    expect(orderRepo.update).toHaveBeenCalledTimes(1);
  });

  it('rejects a payload with no status', async () => {
    await expect(
      shaqService.handleWebhook({ event: 'package.status_updated', event_id: 'x', data: {} })
    ).rejects.toThrow();
  });

  it('records the event but does not update when no order matches', async () => {
    const res = await shaqService.handleWebhook(envelope({ data: { status: 'delivered', partner_ref: '#NA-UNKNOWN' } }));
    expect(eventRepo.insert).toHaveBeenCalledTimes(1);
    expect(orderRepo.update).not.toHaveBeenCalled();
    expect(res.matchedOrder).toBeNull();
  });
});
