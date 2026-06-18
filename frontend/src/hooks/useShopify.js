/** React Query hooks for the Shopify integration. */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopifyService } from '@/services/shopify.service';
import { queryKeys } from '@/lib/queryKeys';

export function useShopifySettings() {
  return useQuery({
    queryKey: queryKeys.shopify.settings,
    queryFn: () => shopifyService.getSettings(),
  });
}

export function useUpdateShopifySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => shopifyService.updateSettings(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shopify.settings }),
  });
}

export function useSyncHistory(type) {
  return useQuery({
    queryKey: queryKeys.shopify.history(type),
    queryFn: () => shopifyService.getHistory(type),
  });
}

export function useCheckConnection() {
  return useMutation({
    mutationFn: () => shopifyService.checkConnection(),
  });
}

export function useRegisterWebhooks() {
  return useMutation({
    mutationFn: () => shopifyService.registerWebhooks(),
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind) => shopifyService.sync(kind),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shopify.history });
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      qc.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}
