/** React Query hooks for orders. */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersService } from '@/services/orders.service';
import { queryKeys } from '@/lib/queryKeys';

/** @param {import('@/types').OrderListParams} [params] */
export function useOrders(params) {
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => ordersService.getAll(params),
  });
}

export function useOrder(id) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => ordersService.getById(id),
    enabled: Boolean(id),
  });
}

/** Invalidate the whole orders cache after a write. */
function useInvalidateOrders() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.orders.all });
}

export function useCreateOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (payload) => ordersService.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: ({ id, payload }) => ordersService.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (id) => ordersService.remove(id),
    onSuccess: invalidate,
  });
}

export function useArchiveOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (id) => ordersService.archive(id),
    onSuccess: invalidate,
  });
}

export function useRestoreOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (id) => ordersService.restore(id),
    onSuccess: invalidate,
  });
}

export function useBulkUpdateOrders() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (payload) => ordersService.bulkUpdate(payload),
    onSuccess: invalidate,
  });
}
