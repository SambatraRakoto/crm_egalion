'use strict';

const userRepo = require('../repositories/user.repository');
const tokenRepo = require('../repositories/token.repository');
const password = require('../utils/password');
const jwtUtil = require('../utils/jwt');
const { randomToken, sha256 } = require('../utils/crypto');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const { ROLES } = require('../utils/constants');

// FR : Calcule la date d'expiration du refresh token (miroir de JWT_REFRESH_EXPIRES).
// EN : Compute the refresh-token expiry date (mirrors JWT_REFRESH_EXPIRES).
function refreshExpiryDate() {
  // Mirror JWT_REFRESH_EXPIRES for the DB row. Supports "7d"/"24h"/seconds.
  const raw = config.jwt.refreshExpires;
  const m = /^(\d+)([dhms])?$/.exec(String(raw));
  let ms = 7 * 24 * 60 * 60 * 1000;
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2] || 's';
    const mult = { d: 86400000, h: 3600000, m: 60000, s: 1000 }[unit];
    ms = n * mult;
  }
  return new Date(Date.now() + ms);
}

// FR : Génère et stocke une paire access/refresh pour un utilisateur.
// EN : Generate and store an access/refresh token pair for a user.
async function buildTokens(user, roles) {
  const accessToken = jwtUtil.signAccessToken({ sub: user.id, email: user.email, roles });
  const opaque = randomToken();
  const refreshToken = jwtUtil.signRefreshToken({ sub: user.id, jti: sha256(opaque).slice(0, 16) });
  // Store a hash of the signed refresh token so a DB leak can't reuse it.
  await tokenRepo.saveRefresh({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: refreshExpiryDate(),
  });
  return { accessToken, refreshToken };
}

// FR : Projette un utilisateur en objet public (sans champs sensibles).
// EN : Project a user into a public-safe object (no sensitive fields).
function publicUser(user, roles) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    isActive: user.is_active,
    roles,
  };
}

// FR : Crée un utilisateur (réservé aux admins).
// EN : Create a user (admin-only).
async function register({ fullName, email, phone, password: plain, roles }) {
  const existing = await userRepo.findByEmail(email);
  if (existing) throw ApiError.conflict('Un utilisateur avec cet email existe déjà');

  const passwordHash = await password.hash(plain);
  const roleSlugs = roles && roles.length ? roles : [ROLES.AGENT];
  const user = await userRepo.create({ fullName, email, phone, passwordHash, roleSlugs });
  const userRoles = await userRepo.getRoles(user.id);
  return publicUser(user, userRoles);
}

// FR : Authentifie par email/mot de passe; renvoie l'utilisateur + jetons.
// EN : Authenticate by email/password; return the user + tokens.
async function login({ email, password: plain }) {
  const user = await userRepo.findByEmail(email);
  if (!user) throw ApiError.unauthorized('Identifiants invalides');
  if (!user.is_active) throw ApiError.forbidden('Ce compte est désactivé');

  const ok = await password.compare(plain, user.password_hash);
  if (!ok) throw ApiError.unauthorized('Identifiants invalides');

  const roles = await userRepo.getRoles(user.id);
  const tokens = await buildTokens(user, roles);
  await userRepo.touchLastLogin(user.id);
  return { user: publicUser(user, roles), ...tokens };
}

// FR : Révoque le refresh token fourni (déconnexion).
// EN : Revoke the given refresh token (logout).
async function logout(refreshToken) {
  if (refreshToken) await tokenRepo.revokeRefresh(sha256(refreshToken));
}

// FR : Vérifie et fait tourner le refresh token; renvoie une paire fraîche.
// EN : Verify and rotate the refresh token; return a fresh pair.
async function refresh(refreshToken) {
  if (!refreshToken) throw ApiError.unauthorized('Refresh token manquant');

  let payload;
  try {
    payload = jwtUtil.verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Refresh token invalide ou expiré');
  }

  const stored = await tokenRepo.findRefresh(sha256(refreshToken));
  if (!stored) throw ApiError.unauthorized('Refresh token révoqué ou inconnu');

  const user = await userRepo.findById(payload.sub);
  if (!user || !user.is_active) throw ApiError.unauthorized('Utilisateur introuvable ou inactif');

  // Rotate: revoke the old token, issue a fresh pair.
  await tokenRepo.revokeRefresh(sha256(refreshToken));
  const roles = await userRepo.getRoles(user.id);
  const tokens = await buildTokens(user, roles);
  return { user: publicUser(user, roles), ...tokens };
}

// FR : Change le mot de passe après vérification; révoque les sessions.
// EN : Change the password after verifying the current one; revoke sessions.
async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await userRepo.findByIdWithHash(userId);
  if (!user) throw ApiError.notFound('Utilisateur introuvable');

  const ok = await password.compare(currentPassword, user.password_hash);
  if (!ok) throw ApiError.badRequest('Le mot de passe actuel est incorrect');

  const hash = await password.hash(newPassword);
  await userRepo.updatePassword(userId, hash);
  await tokenRepo.revokeAllForUser(userId); // force re-login everywhere
}

/**
 * Request a password reset. Returns the opaque token to the caller (in a real
 * deployment this is emailed, never returned in the API response).
 */
// FR : Génère un jeton de réinitialisation (renvoyé hors prod).
// EN : Generate a password-reset token (returned in non-prod).
async function requestPasswordReset(email) {
  const user = await userRepo.findByEmail(email);
  if (!user) return null; // do not reveal whether the email exists

  const opaque = randomToken(24);
  await tokenRepo.savePasswordReset({
    userId: user.id,
    tokenHash: sha256(opaque),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
  });
  return opaque;
}

// FR : Réinitialise le mot de passe via un jeton valide.
// EN : Reset the password using a valid token.
async function resetPassword({ token, newPassword }) {
  const reset = await tokenRepo.findPasswordReset(sha256(token));
  if (!reset) throw ApiError.badRequest('Lien de réinitialisation invalide ou expiré');

  const hash = await password.hash(newPassword);
  await userRepo.updatePassword(reset.user_id, hash);
  await tokenRepo.markResetUsed(reset.id);
  await tokenRepo.revokeAllForUser(reset.user_id);
}

// FR : Renvoie le profil public de l'utilisateur courant.
// EN : Return the current user's public profile.
async function me(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw ApiError.notFound('Utilisateur introuvable');
  const roles = await userRepo.getRoles(userId);
  return publicUser(user, roles);
}

module.exports = {
  register,
  login,
  logout,
  refresh,
  changePassword,
  requestPasswordReset,
  resetPassword,
  me,
};
