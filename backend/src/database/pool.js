'use strict';

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl,
  max: config.db.max,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Pin every connection to the business timezone (Ghana / Africa/Accra) at
  // startup, so now(), TIMESTAMPTZ rendering and date_trunc() buckets all use
  // Ghana local time. Set via the startup `options` param (no extra round-trip).
  options: `-c timezone=${config.timezone}`,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', err);
});

/**
 * Run a parameterized query. Always use $1, $2... placeholders — never string
 * interpolation — to stay safe from SQL injection.
 */
// FR : Exécute une requête SQL paramétrée (toujours $1,$2…).
// EN : Run a parameterized SQL query (always $1,$2…).
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (config.env === 'development') {
    logger.debug(`query ${Date.now() - start}ms rows=${res.rowCount}`);
  }
  return res;
}

/**
 * Run a set of statements inside a single transaction. The callback receives a
 * dedicated client; commit/rollback is handled automatically.
 */
// FR : Exécute un callback dans une transaction (commit/rollback auto).
// EN : Run a callback inside a transaction (auto commit/rollback).
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
