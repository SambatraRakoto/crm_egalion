/**
 * Authentication context (JWT, backend-agnostic).
 *
 * Owns the authenticated user, hydrates it from a stored token on load, exposes
 * login/register/logout, and reacts to the `auth:unauthorized` event emitted by
 * the HTTP client when a token refresh fails.
 */
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authService } from '@/services/auth.service';
import { tokenStorage } from '@/lib/tokenStorage';
import { AUTH_UNAUTHORIZED_EVENT } from '@/api/httpClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const isAuthenticated = Boolean(user);

  // Hydrate the session on first load.
  const bootstrap = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    if (!tokenStorage.hasSession()) {
      setUser(null);
      setIsLoadingAuth(false);
      return;
    }
    try {
      const me = await authService.me();
      setUser(me);
    } catch (error) {
      tokenStorage.clear();
      setUser(null);
      if (error?.status && error.status !== 401) setAuthError(error);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // The HTTP client fires this when token refresh fails — drop the session.
  useEffect(() => {
    const onUnauthorized = () => {
      tokenStorage.clear();
      setUser(null);
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthError(null);
    const session = await authService.login(credentials);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const hasRole = useCallback((role) => Boolean(user?.roles?.includes(role)), [user]);

  const value = {
    user,
    isAuthenticated,
    isLoadingAuth,
    authError,
    login,
    logout,
    hasRole,
    refreshUser: bootstrap,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
