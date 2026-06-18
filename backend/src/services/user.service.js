'use strict';

const userRepo = require('../repositories/user.repository');
const roleRepo = require('../repositories/role.repository');
const ApiError = require('../utils/ApiError');
const { parsePagination } = require('../utils/queryParams');

// FR : Projette un utilisateur en objet public.
// EN : Project a user into a public-safe object.
function publicUser(row, roles) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    roles: roles || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// FR : Liste paginée des utilisateurs avec leurs rôles.
// EN : Paginated list of users with their roles.
async function list(query) {
  const { page, limit, offset } = parsePagination(query);
  const { total, rows } = await userRepo.list({ limit, offset, search: query.search });
  const rolesMap = await userRepo.getRolesForUsers(rows.map((r) => r.id));
  return {
    rows: rows.map((r) => publicUser(r, rolesMap[r.id])),
    page,
    limit,
    total,
  };
}

// FR : Récupère un utilisateur par id avec ses rôles.
// EN : Fetch a user by id with roles.
async function getById(id) {
  const user = await userRepo.findById(id);
  if (!user) throw ApiError.notFound('Utilisateur introuvable');
  const roles = await userRepo.getRoles(id);
  return publicUser(user, roles);
}

// FR : Met à jour le profil (nom, téléphone).
// EN : Update the profile (name, phone).
async function update(id, data) {
  await getById(id);
  const updated = await userRepo.update(id, {
    full_name: data.fullName,
    phone: data.phone,
  });
  const roles = await userRepo.getRoles(id);
  return publicUser(updated, roles);
}

// FR : Remplace les rôles d'un utilisateur.
// EN : Replace a user's roles.
async function setRoles(id, roleSlugs) {
  await getById(id);
  await userRepo.setRoles(id, roleSlugs);
  const roles = await userRepo.getRoles(id);
  const user = await userRepo.findById(id);
  return publicUser(user, roles);
}

// FR : Active/désactive un compte (pas le sien).
// EN : Activate/deactivate an account (not your own).
async function setActive(actorId, id, isActive) {
  if (actorId === id && isActive === false) {
    throw ApiError.badRequest('Vous ne pouvez pas désactiver votre propre compte');
  }
  await getById(id);
  const updated = await userRepo.update(id, { is_active: isActive });
  const roles = await userRepo.getRoles(id);
  return publicUser(updated, roles);
}

// FR : Supprime un utilisateur (pas le sien).
// EN : Delete a user (not your own).
async function remove(actorId, id) {
  if (actorId === id) throw ApiError.badRequest('Vous ne pouvez pas supprimer votre propre compte');
  const ok = await userRepo.remove(id);
  if (!ok) throw ApiError.notFound('Utilisateur introuvable');
}

// FR : Liste tous les rôles disponibles.
// EN : List all available roles.
async function listRoles() {
  return roleRepo.listAll();
}

module.exports = { list, getById, update, setRoles, setActive, remove, listRoles };
