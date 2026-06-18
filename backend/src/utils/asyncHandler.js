'use strict';

/** Wrap an async route handler so rejected promises reach the error middleware. */
// FR : Enrobe un handler async pour router les rejets vers le middleware d'erreur.
// EN : Wrap an async handler so rejections reach the error middleware.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
