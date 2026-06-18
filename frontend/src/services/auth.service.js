/**
 * Authentication service (JWT).
 *
 * In mock mode it accepts any credentials and issues fake tokens so the whole
 * auth flow is exercisable offline. In real mode it calls the backend
 * `/auth/*` endpoints. Either way it returns the same `AuthSession` shape and
 * persists tokens through `tokenStorage`.
 */
import { config } from '@/config/env';
import { http } from '@/api/httpClient';
import { endpoints } from '@/api/endpoints';
import { tokenStorage } from '@/lib/tokenStorage';
import { simulate, simulateError } from '@/services/mock/mockUtils';

/** @typedef {import('@/types').AuthSession} AuthSession */
/** @typedef {import('@/types').User} User */

const MOCK_USER = /** @type {User} */ ({
  id: 1,
  email: 'admin@nuruya.com',
  fullName: 'Ops Admin',
  isActive: true,
  roles: ['admin'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  lastLoginAt: new Date().toISOString(),
});

function mockSession(email) {
  return {
    user: { ...MOCK_USER, email: email || MOCK_USER.email },
    accessToken: `mock-access-${Date.now()}`,
    refreshToken: `mock-refresh-${Date.now()}`,
  };
}

export const authService = {
  /**
   * @param {import('@/types').LoginCredentials} credentials
   * @returns {Promise<AuthSession>}
   */
  async login(credentials) {
    if (config.useMock) {
      if (!credentials.email || !credentials.password) {
        return simulateError('Email and password are required', { status: 422 });
      }
      const session = await simulate(() => mockSession(credentials.email));
      tokenStorage.setTokens(session);
      return session;
    }
    const session = await http.post(endpoints.auth.login, credentials, { auth: false });
    tokenStorage.setTokens(session);
    return session;
  },

  /** @returns {Promise<User>} */
  async me() {
    if (config.useMock) return simulate(() => ({ ...MOCK_USER }));
    return http.get(endpoints.auth.me);
  },

  async logout() {
    try {
      if (!config.useMock) {
        const refreshToken = tokenStorage.getRefreshToken();
        await http.post(endpoints.auth.logout, { refreshToken });
      } else {
        await simulate(true);
      }
    } finally {
      tokenStorage.clear();
    }
  },

  /** @param {import('@/types').ChangePasswordPayload} payload */
  async changePassword(payload) {
    if (config.useMock) return simulate({ message: 'Password changed' });
    return http.post(endpoints.auth.changePassword, payload);
  },

  /** @param {import('@/types').ForgotPasswordPayload} payload */
  async forgotPassword(payload) {
    if (config.useMock) return simulate({ message: 'If the account exists, an email was sent.' });
    return http.post(endpoints.auth.forgotPassword, payload, { auth: false });
  },

  /** @param {import('@/types').ResetPasswordPayload} payload */
  async resetPassword(payload) {
    if (config.useMock) return simulate({ message: 'Password reset' });
    return http.post(endpoints.auth.resetPassword, payload, { auth: false });
  },
};

export default authService;
