/** React Query hooks for ShaQ delivery events + outbound flows. */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shaqService } from '@/services/shaq.service';
import { queryKeys } from '@/lib/queryKeys';

export function useShaqEvents(params) {
  return useQuery({
    queryKey: queryKeys.shaq.events(params),
    queryFn: () => shaqService.listEvents(params),
    placeholderData: (prev) => prev,
  });
}

export function useOrderEvents(orderId) {
  return useQuery({
    queryKey: queryKeys.shaq.orderEvents(orderId),
    queryFn: () => shaqService.eventsForOrder(orderId),
    enabled: Boolean(orderId),
  });
}

/** Invalidate orders + ShaQ events after an outbound operation. */
function useInvalidateShaq() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.orders.all });
    qc.invalidateQueries({ queryKey: queryKeys.shaq.all });
  };
}

/** (1) Send a CRM order to ShaQ. */
export function useShipOrder() {
  const invalidate = useInvalidateShaq();
  return useMutation({
    mutationFn: (orderId) => shaqService.shipOrder(orderId),
    onSuccess: invalidate,
  });
}

/** (2) Import packages from ShaQ into the CRM. */
export function useImportPackages() {
  const invalidate = useInvalidateShaq();
  return useMutation({
    mutationFn: () => shaqService.importPackages(),
    onSuccess: invalidate,
  });
}

/** (3) Poll ShaQ and update CRM statuses. */
export function useSyncStatuses() {
  const invalidate = useInvalidateShaq();
  return useMutation({
    mutationFn: () => shaqService.syncStatuses(),
    onSuccess: invalidate,
  });
}
