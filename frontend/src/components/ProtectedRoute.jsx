import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { LoadingState } from '@/components/feedback/LoadingState';

/**
 * Guards authenticated routes. While the session is being hydrated it shows a
 * spinner; unauthenticated users are redirected to /login (preserving the
 * intended destination so we can return there after login).
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) return <LoadingState fullscreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
