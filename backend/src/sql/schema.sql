-- ============================================================================
-- Nuruya CRM — PostgreSQL schema
-- Idempotent: safe to run multiple times.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- AUTH: roles, users, user_roles, refresh_tokens, password_resets
-- ===========================================================================
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(50) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(150) NOT NULL,
  email         VARCHAR(180) NOT NULL UNIQUE,
  phone         VARCHAR(40),
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);

CREATE TABLE IF NOT EXISTS password_resets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);

-- ===========================================================================
-- PRODUCTS
-- ===========================================================================
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_product_id  BIGINT UNIQUE,
  sku                 VARCHAR(100),
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  category            VARCHAR(120),
  price               NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity      INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  product_status      VARCHAR(20) NOT NULL DEFAULT 'active',
  image_url           TEXT,
  shopify_inventory_item_id BIGINT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_product_status CHECK (product_status IN ('active','inactive','draft')),
  CONSTRAINT chk_price_positive CHECK (price >= 0),
  CONSTRAINT chk_stock_positive CHECK (stock_quantity >= 0)
);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (product_status);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (lower(name));
-- For existing databases: add the column if it predates this version.
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_inventory_item_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_products_inventory_item ON products (shopify_inventory_item_id);

-- ===========================================================================
-- ORDERS
-- ===========================================================================
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id BIGINT UNIQUE,
  order_number     VARCHAR(50),
  customer_name    VARCHAR(180),
  customer_phone   VARCHAR(40),
  customer_email   VARCHAR(180),
  region           VARCHAR(120),
  city             VARCHAR(120),
  delivery_address TEXT,
  order_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_cost    NUMERIC(12,2) NOT NULL DEFAULT 0,
  shaq_cost        NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method   VARCHAR(40),
  delivery_status  VARCHAR(30) NOT NULL DEFAULT 'pending',
  shaq_tracking_id VARCHAR(120),
  notes            TEXT,
  archived         BOOLEAN NOT NULL DEFAULT FALSE,
  ordered_at       TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_delivery_status CHECK (delivery_status IN
    ('pending','received','warehouse_received','collected','ready_for_pickup',
     'shipped','assigned','in_transit','dispatched',
     'confirmed','delivered',
     'not_delivered','rescheduled','customer_hold','customer_unreachable','suspected_scam',
     'return_picked','return_in_progress','returned_to_sender','return_to_central',
     'cancelled')),
  CONSTRAINT chk_amounts_positive CHECK (order_amount >= 0 AND delivery_cost >= 0 AND shaq_cost >= 0),
  -- order_number == ShaQ partner_ref (e.g. "#NA-..."): unique so an order is
  -- never imported/created twice. NULLs allowed (multiple un-referenced rows).
  CONSTRAINT uq_orders_order_number UNIQUE (order_number)
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (delivery_status);

-- Idempotent: realign the delivery_status constraint to ShaQ terms on existing
-- databases (CREATE TABLE IF NOT EXISTS above is skipped when the table exists).
-- Migrate any legacy values first, then swap the constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'orders' AND constraint_name = 'chk_delivery_status'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT chk_delivery_status;
  END IF;

  -- Map legacy buckets to the closest ShaQ term (no-op on fresh DBs).
  UPDATE orders SET delivery_status = 'collected'           WHERE delivery_status = 'collection';
  UPDATE orders SET delivery_status = 'in_transit'          WHERE delivery_status = 'transit';
  UPDATE orders SET delivery_status = 'dispatched'          WHERE delivery_status = 'dispatch';
  UPDATE orders SET delivery_status = 'not_delivered'       WHERE delivery_status = 'failed_delivery';
  UPDATE orders SET delivery_status = 'returned_to_sender'  WHERE delivery_status = 'returned';
  UPDATE orders SET delivery_status = 'customer_hold'       WHERE delivery_status = 'issue';

  ALTER TABLE orders ADD CONSTRAINT chk_delivery_status CHECK (delivery_status IN
    ('pending','received','warehouse_received','collected','ready_for_pickup',
     'shipped','assigned','in_transit','dispatched',
     'confirmed','delivered',
     'not_delivered','rescheduled','customer_hold','customer_unreachable','suspected_scam',
     'return_picked','return_in_progress','returned_to_sender','return_to_central',
     'cancelled'));

  -- Idempotent: order_number uniqueness for ShaQ partner_ref dedup (existing DBs).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_orders_order_number') THEN
    ALTER TABLE orders ADD CONSTRAINT uq_orders_order_number UNIQUE (order_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders (archived);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_ordered_at ON orders (ordered_at);
CREATE INDEX IF NOT EXISTS idx_orders_region ON orders (region);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders (shaq_tracking_id);

-- Order line items (links orders <-> products)
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products (id) ON DELETE SET NULL,
  product_name VARCHAR(255),
  sku         VARCHAR(100),
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_item_qty CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

-- ===========================================================================
-- ShaQ delivery events
-- ===========================================================================
CREATE TABLE IF NOT EXISTS delivery_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID REFERENCES orders (id) ON DELETE CASCADE,
  tracking_id  VARCHAR(120),
  status       VARCHAR(30) NOT NULL,
  raw_status   VARCHAR(80),
  description  TEXT,
  payload      JSONB,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_events_order ON delivery_events (order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_events_tracking ON delivery_events (tracking_id);
-- Idempotent: webhook idempotency key. ShaQ sends a unique event_id per push;
-- a partial unique index lets us skip duplicate deliveries (ON CONFLICT DO NOTHING).
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS event_id VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_events_event_id
  ON delivery_events (event_id) WHERE event_id IS NOT NULL;

-- ===========================================================================
-- Shopify settings & sync logs
-- ===========================================================================
CREATE TABLE IF NOT EXISTS shopify_settings (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  store_domain  VARCHAR(255),
  access_token  VARCHAR(255),
  api_version   VARCHAR(20) DEFAULT '2024-10',
  is_connected  BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_settings_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type         VARCHAR(40) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'running',
  records_processed INTEGER NOT NULL DEFAULT 0,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  CONSTRAINT chk_sync_status CHECK (status IN ('running','success','failed','partial'))
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON sync_logs (sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON sync_logs (started_at);

-- ===========================================================================
-- Audit logs
-- ===========================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users (id) ON DELETE SET NULL,
  action       VARCHAR(60) NOT NULL,
  entity_type  VARCHAR(60),
  entity_id    VARCHAR(80),
  metadata     JSONB,
  ip_address   VARCHAR(60),
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);

-- ===========================================================================
-- updated_at triggers
-- ===========================================================================
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
