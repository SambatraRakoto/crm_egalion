/** Auth-related mutations not tied to session state (change password). */
import { useMutation } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload) => authService.changePassword(payload),
  });
}
