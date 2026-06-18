'use strict';

const userService = require('../services/user.service');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, paginationMeta } = require('../utils/response');
const { AUDIT_ACTION } = require('../utils/constants');

// FR : GET /users — liste paginée.
// EN : GET /users — paginated list.
const list = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } = await userService.list(req.query);
  return success(res, { message: 'Liste des utilisateurs', data: rows, meta: paginationMeta({ page, limit, total }) });
});

// FR : GET /users/roles — liste des rôles.
// EN : GET /users/roles — roles list.
const listRoles = asyncHandler(async (req, res) =>
  success(res, { message: 'Liste des rôles', data: await userService.listRoles() }));

// FR : GET /users/:id — détail d'un utilisateur.
// EN : GET /users/:id — user detail.
const getOne = asyncHandler(async (req, res) =>
  success(res, { message: 'Détails de l\'utilisateur', data: await userService.getById(req.params.id) }));

// FR : PUT /users/:id — met à jour le profil.
// EN : PUT /users/:id — update profile.
const update = asyncHandler(async (req, res) => {
  const user = await userService.update(req.params.id, req.body);
  await auditService.record(req, { action: AUDIT_ACTION.USER_UPDATE, entityType: 'user', entityId: user.id });
  return success(res, { message: 'Utilisateur mis à jour', data: user });
});

// FR : PATCH /users/:id/roles — définit les rôles.
// EN : PATCH /users/:id/roles — set roles.
const setRoles = asyncHandler(async (req, res) => {
  const user = await userService.setRoles(req.params.id, req.body.roles);
  await auditService.record(req, {
    action: AUDIT_ACTION.USER_UPDATE,
    entityType: 'user',
    entityId: user.id,
    metadata: { roles: req.body.roles },
  });
  return success(res, { message: 'Rôles mis à jour', data: user });
});

// FR : PATCH /users/:id/active — active/désactive.
// EN : PATCH /users/:id/active — activate/deactivate.
const setActive = asyncHandler(async (req, res) => {
  const user = await userService.setActive(req.user.id, req.params.id, req.body.isActive);
  await auditService.record(req, {
    action: AUDIT_ACTION.USER_UPDATE,
    entityType: 'user',
    entityId: user.id,
    metadata: { isActive: req.body.isActive },
  });
  return success(res, { message: user.isActive ? 'Compte activé' : 'Compte désactivé', data: user });
});

// FR : DELETE /users/:id — supprime un utilisateur.
// EN : DELETE /users/:id — delete a user.
const remove = asyncHandler(async (req, res) => {
  await userService.remove(req.user.id, req.params.id);
  await auditService.record(req, { action: AUDIT_ACTION.USER_DELETE, entityType: 'user', entityId: req.params.id });
  return success(res, { message: 'Utilisateur supprimé' });
});

module.exports = { list, listRoles, getOne, update, setRoles, setActive, remove };
