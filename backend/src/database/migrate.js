'use strict';

const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');
const logger = require('../utils/logger');

/** Apply the full schema. Idempotent — uses CREATE ... IF NOT EXISTS. */
// FR : Applique le schéma SQL (idempotent).
// EN : Apply the SQL schema (idempotent).
async function migrate() {
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  logger.info('Applying schema.sql ...');
  await pool.query(sql);
  logger.info('Schema applied successfully.');
}

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed', err);
      process.exit(1);
    });
}

module.exports = migrate;
