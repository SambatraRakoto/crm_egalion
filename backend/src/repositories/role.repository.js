'use strict';

const { query } = require('../database/pool');

// FR : Liste tous les rôles.
// EN : List all roles.
async function listAll() {
  const { rows } = await query('SELECT id, slug, name, description FROM roles ORDER BY id');
  return rows;
}

module.exports = { listAll };
