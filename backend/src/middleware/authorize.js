'use strict';

const ApiError = require('../utils/ApiError');
const { ROLES } = require('../utils/constants');

/**
 * Role-based access control. Pass one or more allowed role slugs.
 * super_admin always passes. Must run after the authenticate middleware.
 */
// FR : Vérifie que l'utilisateur a l'un des rôles autorisés (RBAC).
// EN : Check the user has one of the allowed roles (RBAC).
module.exports = function authorize(...allowed) {
  return function (req, res, next) {
    if (!req.user) return next(ApiError.unauthorized());

    const userRoles = req.user.roles || [];
    if (userRoles.includes(ROLES.SUPER_ADMIN)) return next();

    const ok = allowed.some((role) => userRoles.includes(role));
    if (!ok) {
      return next(ApiError.forbidden('Vous n\'avez pas les permissions requises pour cette action'));
    }
    return next();
  };
};
