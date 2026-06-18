'use strict';

const crypto = require('crypto');

/** Generate a cryptographically random opaque token (hex). */
// FR : Génère un jeton opaque aléatoire.
// EN : Generate a random opaque token.
function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Deterministic SHA-256 hash, used to store refresh/reset tokens at rest. */
// FR : Calcule le hash SHA-256 hexadécimal.
// EN : Compute the hex SHA-256 hash.
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = { randomToken, sha256 };
