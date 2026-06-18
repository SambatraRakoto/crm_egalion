'use strict';

const { pool, transaction } = require('./pool');
const password = require('../utils/password');
const { ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

const ROLE_DEFS = [
  { slug: ROLES.SUPER_ADMIN, name: 'Super Admin', description: 'Accès total au système' },
  { slug: ROLES.ADMIN, name: 'Admin', description: 'Administration générale' },
  { slug: ROLES.MANAGER, name: 'Manager', description: 'Gestion des opérations' },
  { slug: ROLES.AGENT, name: 'Agent', description: 'Traitement des commandes' },
  { slug: ROLES.FINANCE, name: 'Finance', description: 'Suivi financier' },
];

const DEMO_PRODUCTS = [
  ['NRY-001', 'Crème hydratante', 'Soin visage', 'Beauté', 120.0, 60.0, 40, 10],
  ['NRY-002', 'Sérum vitamine C', 'Anti-âge', 'Beauté', 180.0, 95.0, 8, 10],
  ['NRY-003', 'Savon naturel', 'Savon artisanal', 'Hygiène', 35.0, 12.0, 0, 5],
  ['NRY-004', 'Huile de ricin', 'Soin cheveux', 'Beauté', 75.0, 30.0, 120, 15],
];

// FR : Insère les données initiales (rôles, super admin, démo).
// EN : Seed initial data (roles, super admin, demo).
async function seed() {
  await transaction(async (client) => {
    // Roles
    for (const r of ROLE_DEFS) {
      await client.query(
        `INSERT INTO roles (slug, name, description) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
        [r.slug, r.name, r.description]
      );
    }
    logger.info(`Seeded ${ROLE_DEFS.length} roles.`);

    // Super admin user
    const adminEmail = 'admin@nuruya.com';
    const adminPass = 'Admin@123';
    const hash = await password.hash(adminPass);
    const userRes = await client.query(
      `INSERT INTO users (full_name, email, password_hash, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      ['Super Admin', adminEmail, hash]
    );
    const adminId = userRes.rows[0].id;

    const roleRes = await client.query('SELECT id FROM roles WHERE slug = $1', [ROLES.SUPER_ADMIN]);
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [adminId, roleRes.rows[0].id]
    );
    logger.info(`Seeded super admin: ${adminEmail} / ${adminPass}`);

    // Demo products — only if the table is empty (sku is not unique).
    const { rows: pCount } = await client.query('SELECT COUNT(*)::int AS n FROM products');
    if (pCount[0].n === 0) {
      for (const p of DEMO_PRODUCTS) {
        await client.query(
          `INSERT INTO products (sku, name, description, category, price, supplier_cost, stock_quantity, low_stock_threshold)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          p
        );
      }
      logger.info(`Seeded ${DEMO_PRODUCTS.length} demo products.`);
    } else {
      logger.info('Products already present, skipping demo products.');
    }

    // Shopify settings singleton
    await client.query(
      `INSERT INTO shopify_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
    );
  });
}

if (require.main === module) {
  seed()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Seed failed', err);
      process.exit(1);
    });
}

module.exports = seed;
