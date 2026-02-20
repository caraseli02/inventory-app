-- Migration: Create orders and conversation_history tables
-- For WhatsApp AI Agent feature (spec: docs/specs/whatsapp_agent.md)

-- ============================================================
-- orders table
-- Stock is NOT deducted on order creation — only on confirmation
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT UNIQUE NOT NULL,           -- human-readable e.g. "ORD-047"
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,                  -- from WhatsApp (E.164 format)
  items           JSONB NOT NULL DEFAULT '[]',    -- [{ product_id, name, qty, unit_price }]
  total_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  pickup_time     TEXT,                           -- free text e.g. "tomorrow 10am"
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-increment order number sequence
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Auto-generate order_number if not provided
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD-' || LPAD(nextval('order_number_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indices
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_phone      ON orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- ============================================================
-- conversation_history table
-- Stores per-customer multi-turn WhatsApp conversation context
-- ============================================================
CREATE TABLE IF NOT EXISTS conversation_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,              -- WhatsApp phone (E.164)
  messages     JSONB NOT NULL DEFAULT '[]',       -- [{ role, content, timestamp }]
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER conversation_history_updated_at
  BEFORE UPDATE ON conversation_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_conversation_phone ON conversation_history (phone_number);

-- Enable Realtime for orders (owner sees new orders instantly in app)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
