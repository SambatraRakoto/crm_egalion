/** Authentication & user-identity types (JWT backend). */

export type RoleName = 'super_admin' | 'admin' | 'manager' | 'finance' | 'agent' | 'viewer';

export interface Role {
  id: number;
  name: RoleName;
  description?: string;
}

/** The authenticated user as returned by `/auth/me`, `/auth/login`, `/users/:id`. */
export interface User {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: RoleName[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

/** Payload of `POST /auth/login`. */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** Payload of `POST /auth/register`. */
export interface RegisterPayload {
  email: string;
  password: string;
  fullName?: string;
}

/** Successful auth response — the user plus a JWT pair. */
export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/** Response of `POST /auth/refresh` (rotating refresh token). */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}
