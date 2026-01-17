import Database from "better-sqlite3";

const DB_PATH = process.env.GROCERY_DB_PATH ?? "grocery.db";

export const db = new Database(DB_PATH);

export function getDatabase(): Database {
  return db;
}

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  ts TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT,
  causation_id TEXT,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events (aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts);

CREATE TABLE IF NOT EXISTS stock_levels (
  product_id TEXT PRIMARY KEY,
  quantity INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_prices (
  product_id TEXT PRIMARY KEY,
  price_cents INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS action_state (
  action_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  ts TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_state_status ON action_state (status);
CREATE INDEX IF NOT EXISTS idx_action_state_product ON action_state (product_id);

CREATE TABLE IF NOT EXISTS daily_price_changes (
  product_id TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (product_id, day)
);

-- New projection: Daily sales aggregation
CREATE TABLE IF NOT EXISTS daily_sales (
  product_id TEXT NOT NULL,
  day TEXT NOT NULL,
  total_sold INTEGER NOT NULL DEFAULT 0,
  total_delivered INTEGER NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day)
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_day ON daily_sales (day);

-- Hourly sales projection (more granular than daily)
CREATE TABLE IF NOT EXISTS hourly_sales (
  product_id TEXT NOT NULL,
  hour TEXT NOT NULL,           -- Format: "2025-01-15T14" (YYYY-MM-DDTHH)
  total_sold INTEGER NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, hour)
);

CREATE INDEX IF NOT EXISTS idx_hourly_sales_hour ON hourly_sales (hour);

-- Analytics projections (independent consumer)
-- These are rebuilt by a separate analytics consumer reading the same events

-- Product velocity: Sales rate over time windows
CREATE TABLE IF NOT EXISTS product_velocity (
  product_id TEXT NOT NULL,
  window_days INTEGER NOT NULL,
  units_sold INTEGER NOT NULL DEFAULT 0,
  avg_per_day REAL NOT NULL DEFAULT 0,
  first_sale_ts TEXT,
  last_sale_ts TEXT,
  last_updated TEXT NOT NULL,
  PRIMARY KEY (product_id, window_days)
);

-- Stock health: Inventory analysis
CREATE TABLE IF NOT EXISTS stock_health (
  product_id TEXT PRIMARY KEY,
  current_stock INTEGER NOT NULL,
  avg_daily_consumption REAL NOT NULL DEFAULT 0,
  days_until_stockout REAL,
  health_status TEXT NOT NULL,
  last_updated TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_health_status ON stock_health (health_status);

-- Agent performance: Confidence vs approval metrics
CREATE TABLE IF NOT EXISTS agent_performance (
  confidence_bucket TEXT PRIMARY KEY,
  total_proposals INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  approval_rate REAL NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL
);

-- Decision latency: Time from proposal to human decision
CREATE TABLE IF NOT EXISTS decision_latency (
  action_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  confidence REAL NOT NULL,
  proposed_at TEXT NOT NULL,
  decided_at TEXT,
  latency_seconds INTEGER,
  decision TEXT,
  last_updated TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decision_latency_product ON decision_latency (product_id);
CREATE INDEX IF NOT EXISTS idx_decision_latency_decided ON decision_latency (decided_at);

-- Discontinued products projection
CREATE TABLE IF NOT EXISTS discontinued_products (
  product_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  discontinued_by TEXT NOT NULL,
  discontinued_at TEXT NOT NULL
);

`);
