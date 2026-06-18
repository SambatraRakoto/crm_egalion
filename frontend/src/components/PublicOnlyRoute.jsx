import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { LoadingState } from '@/components/feedback/LoadingState';

/**
 * Wraps auth screens (login/register/…). Authenticated users are bounced to the
 * app (or back to wherever they were trying to go before being redirected).
 */
export default function PublicOnlyRoute() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) return <LoadingState fullscreen />;

  if (isAuthenticated) {
    const dest = location.state?.from?.pathname || '/';
    return <Navigate to={dest} replace />;
  }

  return <Outlet />;
}
