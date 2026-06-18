/** React Query hooks for user/RBAC management (admin). */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '@/services/users.service';
import { queryKeys } from '@/lib/queryKeys';

export function useUsers(params) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersService.getAll(params),
  });
}

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.users.roles,
    queryFn: () => usersService.getRoles(),
  });
}

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.users.all });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (payload) => usersService.create(payload),
    onSuccess: invalidate,
  });
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id) => usersService.remove(id),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, payload }) => usersService.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useSetUserRoles() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, roles }) => usersService.setRoles(id, roles),
    onSuccess: invalidate,
  });
}

export function useSetUserActive() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, isActive }) => usersService.setActive(id, isActive),
    onSuccess: invalidate,
  });
}
