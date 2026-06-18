'use strict';

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Run after a chain of express-validator rules. Collects errors into the
 * standard error envelope shape.
 */
// FR : Renvoie les erreurs de validation express-validator.
// EN : Return express-validator validation errors.
module.exports = function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({
    field: e.path || e.param,
    message: e.msg,
  }));
  return next(ApiError.unprocessable('Erreur de validation', errors));
};
