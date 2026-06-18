'use strict';

const { query, transaction } = require('../database/pool');

const SAFE_COLUMNS = `id, full_name, email, phone, is_active, last_login_at, created_at, updated_at`;

// FR : Récupère un utilisateur par email (avec hash).
// EN : Fetch a user by email (with hash).
async function findByEmail(email) {
  const { rows } = await query(
    `SELECT id, full_name, email, phone, password_hash, is_active FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  return rows[0] || null;
}

// FR : Récupère un utilisateur par id.
// EN : Fetch a user by id.
async function findById(id) {
  const { rows } = await query(`SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

// FR : Récupère un utilisateur par id (avec hash).
// EN : Fetch a user by id (with hash).
async function findByIdWithHash(id) {
  const { rows } = await query(`SELECT id, password_hash FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

// FR : Rôles d'un utilisateur.
// EN : Roles of a user.
async function getRoles(userId) {
  const { rows } = await query(
    `SELECT r.slug FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.slug);
}

/** Fetch roles for many users at once: returns { userId: [slug] }. */
// FR : Rôles de plusieurs utilisateurs (par lot).
// EN : Roles of several users (batched).
async function getRolesForUsers(userIds) {
  if (!userIds.length) return {};
  const { rows } = await query(
    `SELECT ur.user_id, r.slug FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ANY($1::uuid[])`,
    [userIds]
  );
  return rows.reduce((acc, r) => {
    (acc[r.user_id] = acc[r.user_id] || []).push(r.slug);
    return acc;
  }, {});
}

/** Create a user and assign roles atomically. */
// FR : Crée un utilisateur et lui assigne ses rôles.
// EN : Create a user and assign roles.
async function create({ fullName, email, phone, passwordHash, roleSlugs }) {
  return transaction(async (client) => {
    const userRes = await client.query(
      `INSERT INTO users (full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING ${SAFE_COLUMNS}`,
      [fullName, email, phone || null, passwordHash]
    );
    const user = userRes.rows[0];

    if (roleSlugs && roleSlugs.length) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE slug = ANY($2::text[])`,
        [user.id, roleSlugs]
      );
    }
    return user;
  });
}

// FR : Met à jour des champs utilisateur.
// EN : Update user fields.
async function update(id, fields) {
  const allowed = ['full_name', 'phone', 'is_active'];
  const sets = [];
  const params = [];
  let i = 1;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i++}`);
      params.push(fields[key]);
    }
  }
  if (!sets.length) return findById(id);
  params.push(id);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${SAFE_COLUMNS}`,
    params
  );
  return rows[0] || null;
}

// FR : Remplace les rôles d'un utilisateur.
// EN : Replace a user's roles.
async function setRoles(userId, roleSlugs) {
  return transaction(async (client) => {
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    if (roleSlugs && roleSlugs.length) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE slug = ANY($2::text[])`,
        [userId, roleSlugs]
      );
    }
  });
}

// FR : Met à jour le hash du mot de passe.
// EN : Update the password hash.
async function updatePassword(id, passwordHash) {
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
}

// FR : Met à jour la date de dernière connexion.
// EN : Update the last-login timestamp.
async function touchLastLogin(id) {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

// FR : Supprime un utilisateur.
// EN : Delete a user.
async function remove(id) {
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount > 0;
}

// FR : Liste paginée/recherchée des utilisateurs.
// EN : Paginated/searched user list.
async function list({ limit, offset, search }) {
  const params = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE full_name ILIKE $1 OR email ILIKE $1`;
  }
  const totalRes = await query(`SELECT COUNT(*)::int AS n FROM users ${where}`, params);
  const rowsRes = await query(
    `SELECT ${SAFE_COLUMNS} FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { total: totalRes.rows[0].n, rows: rowsRes.rows };
}

module.exports = {
  findByEmail,
  findById,
  findByIdWithHash,
  getRoles,
  getRolesForUsers,
  create,
  update,
  setRoles,
  updatePassword,
  touchLastLogin,
  remove,
  list,
};
