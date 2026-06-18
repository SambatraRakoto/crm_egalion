'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config');

// FR : Hache un mot de passe (bcrypt).
// EN : Hash a password (bcrypt).
function hash(plain) {
  return bcrypt.hash(plain, config.security.bcryptRounds);
}

// FR : Compare un mot de passe à son hash.
// EN : Compare a password to its hash.
function compare(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

module.exports = { hash, compare };
