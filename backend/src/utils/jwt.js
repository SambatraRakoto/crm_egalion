'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

// FR : Signe un access token JWT.
// EN : Sign a JWT access token.
function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessExpires });
}

// FR : Signe un refresh token JWT.
// EN : Sign a JWT refresh token.
function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpires });
}

// FR : Vérifie un access token JWT.
// EN : Verify a JWT access token.
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

// FR : Vérifie un refresh token JWT.
// EN : Verify a JWT refresh token.
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
