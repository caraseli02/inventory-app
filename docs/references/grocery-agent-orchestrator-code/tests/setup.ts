import Database from "better-sqlite3";
import { beforeEach, afterEach } from "vitest";

/**
 * Test Setup Helpers
 *
 * Why in-memory database for tests?
 * - Each test starts fresh (isolation)
 * - No cleanup needed between tests
 * - Fast - no disk I/O
 * - Doesn't pollute production data
 */

let testDb: Database.Database | null = null;

/**
 * Create a fresh in-memory database with schema
 */
export function createTestDatabase(): Database.Database {
  const db = new Database(":memory:");

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

    CREATE TABLE IF NOT EXISTS daily_sales (
      product_id TEXT NOT NULL,
      day TEXT NOT NULL,
      total_sold INTEGER NOT NULL DEFAULT 0,
      total_delivered INTEGER NOT NULL DEFAULT 0,
      transaction_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (product_id, day)
    );


    -- Hourly sales projection
    CREATE TABLE IF NOT EXISTS hourly_sales (
      product_id TEXT NOT NULL,
      hour TEXT NOT NULL,
      total_sold INTEGER NOT NULL DEFAULT 0,
      transaction_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (product_id, hour)
    );

    -- Analytics projections
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

    CREATE TABLE IF NOT EXISTS stock_health (
      product_id TEXT PRIMARY KEY,
      current_stock INTEGER NOT NULL,
      avg_daily_consumption REAL NOT NULL DEFAULT 0,
      days_until_stockout REAL,
      health_status TEXT NOT NULL,
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_performance (
      confidence_bucket TEXT PRIMARY KEY,
      total_proposals INTEGER NOT NULL DEFAULT 0,
      approved_count INTEGER NOT NULL DEFAULT 0,
      rejected_count INTEGER NOT NULL DEFAULT 0,
      approval_rate REAL NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL
    );

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

    -- Discontinued products projection
    CREATE TABLE IF NOT EXISTS discontinued_products (
      product_id TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      discontinued_by TEXT NOT NULL,
      discontinued_at TEXT NOT NULL
    );
  `);

  return db;
}

/**
 * Get the current test database instance
 */
export function getTestDb(): Database.Database {
  if (!testDb) {
    throw new Error("Test database not initialized. Call setupTestDb() first.");
  }
  return testDb;
}

/**
 * Setup function to be called in beforeEach
 */
export function setupTestDb(): Database.Database {
  testDb = createTestDatabase();
  return testDb;
}

/**
 * Cleanup function to be called in afterEach
 */
export function cleanupTestDb(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

/**
 * Helper to insert a test event directly
 */
export function insertTestEvent(
  db: Database.Database,
  event: {
    id?: string;
    type: string;
    ts: string;
    aggregateType?: string;
    aggregateId?: string;
    correlationId?: string;
    causationId?: string;
    payload: unknown;
  }
): void {
  const nanoid = () => Math.random().toString(36).substring(2, 15);

  db.prepare(`
    INSERT INTO events (id, type, ts, aggregate_type, aggregate_id, correlation_id, causation_id, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id ?? nanoid(),
    event.type,
    event.ts,
    event.aggregateType ?? "TEST",
    event.aggregateId ?? nanoid(),
    event.correlationId ?? null,
    event.causationId ?? null,
    JSON.stringify(event.payload)
  );
}

/**
 * Helper to count events in the database
 */
export function countEvents(db: Database.Database, type?: string): number {
  if (type) {
    return (db.prepare(`SELECT COUNT(*) as count FROM events WHERE type = ?`).get(type) as { count: number }).count;
  }
  return (db.prepare(`SELECT COUNT(*) as count FROM events`).get() as { count: number }).count;
}

/**
 * Helper to get stock level from projection
 */
export function getStockLevel(db: Database.Database, productId: string): number | null {
  const row = db.prepare(`SELECT quantity FROM stock_levels WHERE product_id = ?`).get(productId) as { quantity: number } | undefined;
  return row?.quantity ?? null;
}

/**
 * Helper to apply a stock event (insert event + update projection)
 */
export function applyStockEvent(
  db: Database.Database,
  productId: string,
  delta: number,
  reason: string,
  ts: string
): void {
  // Insert the event
  insertTestEvent(db, {
    type: "StockLevelChanged",
    ts,
    aggregateType: "Product",
    aggregateId: productId,
    payload: { productId, delta, reason },
  });

  // Update the projection
  const existing = db
    .prepare(`SELECT quantity FROM stock_levels WHERE product_id = ?`)
    .get(productId) as { quantity: number } | undefined;

  const current = existing?.quantity ?? 0;
  const next = Math.max(0, current + delta);

  db.prepare(`
    INSERT INTO stock_levels (product_id, quantity, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET
      quantity = excluded.quantity,
      updated_at = excluded.updated_at
  `).run(productId, next, ts);
}
