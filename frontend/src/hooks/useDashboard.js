/** React Query hook for the analytics dashboard bundle. */
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { queryKeys } from '@/lib/queryKeys';

/**
 * FR : Hook du tableau de bord, filtré par période et par statut de livraison.
 * EN : Dashboard hook, filtered by period and by delivery status.
 * @param {string} [period] one of: all|today|week|month|year
 * @param {string} [status] a delivery-status display label, or 'all'
 */
export function useDashboard(period = 'all', status = 'all') {
  return useQuery({
    queryKey: queryKeys.dashboard.data(period, status),
    queryFn: () => dashboardService.getDashboardData({ period, status }),
    placeholderData: (prev) => prev, // keep previous data while switching filters
  });
}
