/** React Query hook for the admin audit log. */
import { useQuery } from '@tanstack/react-query';
import { auditService } from '@/services/audit.service';
import { queryKeys } from '@/lib/queryKeys';

export function useAuditLogs(params) {
  return useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: () => auditService.list(params),
    placeholderData: (prev) => prev,
  });
}
