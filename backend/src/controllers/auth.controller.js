'use strict';

const authService = require('../services/auth.service');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AUDIT_ACTION } = require('../utils/constants');

// FR : POST /auth/register — crée un utilisateur (admin).
// EN : POST /auth/register — create a user (admin).
const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  await auditService.record(req, {
    action: AUDIT_ACTION.USER_CREATE,
    entityType: 'user',
    entityId: user.id,
    metadata: { email: user.email, roles: user.roles },
  });
  return success(res, { status: 201, message: 'Utilisateur créé avec succès', data: user });
});

// FR : POST /auth/login — authentifie et renvoie les jetons.
// EN : POST /auth/login — authenticate and return tokens.
const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  await auditService.record(req, {
    action: AUDIT_ACTION.USER_LOGIN,
    entityType: 'user',
    entityId: result.user.id,
  });
  return success(res, { message: 'Connexion réussie', data: result });
});

// FR : POST /auth/refresh — rafraîchit la paire de jetons.
// EN : POST /auth/refresh — refresh the token pair.
const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  return success(res, { message: 'Token rafraîchi', data: result });
});

// FR : POST /auth/logout — déconnecte (révoque le refresh).
// EN : POST /auth/logout — log out (revoke refresh).
const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  await auditService.record(req, { action: AUDIT_ACTION.USER_LOGOUT, entityType: 'user', entityId: req.user && req.user.id });
  return success(res, { message: 'Déconnexion réussie' });
});

// FR : POST /auth/change-password — change le mot de passe.
// EN : POST /auth/change-password — change the password.
const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  return success(res, { message: 'Mot de passe modifié avec succès' });
});

// FR : POST /auth/forgot-password — demande un lien de réinitialisation.
// EN : POST /auth/forgot-password — request a reset link.
const forgotPassword = asyncHandler(async (req, res) => {
  const token = await authService.requestPasswordReset(req.body.email);
  // In production the token is emailed; exposed here only in non-prod for testing.
  const data = process.env.NODE_ENV === 'production' ? null : { resetToken: token };
  return success(res, {
    message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
    data,
  });
});

// FR : POST /auth/reset-password — réinitialise via jeton.
// EN : POST /auth/reset-password — reset via token.
const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  return success(res, { message: 'Mot de passe réinitialisé avec succès' });
});

// FR : GET /auth/me — profil de l'utilisateur courant.
// EN : GET /auth/me — current user's profile.
const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  return success(res, { message: 'OK', data: user });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  me,
};
