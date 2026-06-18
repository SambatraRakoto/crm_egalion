'use strict';

const { query } = require('../database/pool');

// ---- Refresh tokens ----
// FR : Stocke le hash d'un refresh token.
// EN : Store a refresh-token hash.
async function saveRefresh({ userId, tokenHash, expiresAt }) {
  const { rows } = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id`,
    [userId, tokenHash, expiresAt]
  );
  return rows[0];
}

// FR : Cherche un refresh token actif par hash.
// EN : Find an active refresh token by hash.
async function findRefresh(tokenHash) {
  const { rows } = await query(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  return rows[0] || null;
}

// FR : Révoque un refresh token.
// EN : Revoke a refresh token.
async function revokeRefresh(tokenHash) {
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [tokenHash]);
}

// FR : Révoque tous les refresh tokens d'un utilisateur.
// EN : Revoke all of a user's refresh tokens.
async function revokeAllForUser(userId) {
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

// ---- Password resets ----
// FR : Stocke le hash d'un jeton de réinitialisation.
// EN : Store a password-reset token hash.
async function savePasswordReset({ userId, tokenHash, expiresAt }) {
  const { rows } = await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id`,
    [userId, tokenHash, expiresAt]
  );
  return rows[0];
}

// FR : Cherche un jeton de réinitialisation valide.
// EN : Find a valid password-reset token.
async function findPasswordReset(tokenHash) {
  const { rows } = await query(
    `SELECT * FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  return rows[0] || null;
}

// FR : Marque un jeton de réinitialisation comme utilisé.
// EN : Mark a password-reset token as used.
async function markResetUsed(id) {
  await query('UPDATE password_resets SET used_at = now() WHERE id = $1', [id]);
}

module.exports = {
  saveRefresh,
  findRefresh,
  revokeRefresh,
  revokeAllForUser,
  savePasswordReset,
  findPasswordReset,
  markResetUsed,
};
