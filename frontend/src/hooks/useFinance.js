/** React Query hook for finance data (period-driven). */
import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/finance.service';
import { queryKeys } from '@/lib/queryKeys';

/**
 * @param {{ period?: string, from?: string, to?: string }} [params]
 * Period one of: all|today|week|month|year|custom. For custom, pass from/to.
 */
export function useFinance(params) {
  return useQuery({
    queryKey: queryKeys.finance.data(params),
    queryFn: () => financeService.getFinanceData(params),
    placeholderData: (prev) => prev, // keep amounts visible while switching period
  });
}
