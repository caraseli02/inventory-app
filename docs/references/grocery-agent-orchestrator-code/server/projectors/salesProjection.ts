import { db } from "../core/db.js";
import type { StockLevelChangedPayload } from "../core/types.js";

/**
 * # Sales Projection (Daily Aggregation)
 *
 * This projection tracks daily sales and deliveries per product.
 *
 * Why this is useful:
 * - Quick dashboard showing "what sold today"
 * - Historical trends without replaying events
 * - Analytics for business decisions
 *
 * What it stores:
 * - product_id: Which product
 * - day: YYYY-MM-DD format
 * - total_sold: Sum of negative deltas (sales)
 * - total_delivered: Sum of positive deltas (deliveries)
 * - transaction_count: How many events
 *
 * Same rules as stock projection:
 * - Derived from events, can be rebuilt
 * - Events are truth, this is just a fast view
 */

/**
 * Extract YYYY-MM-DD from ISO timestamp
 */
function extractDay(ts: string): string {
  return ts.slice(0, 10);
}

/**
 * Apply one StockLevelChanged event to the daily_sales projection.
 *
 * Called during normal operation and during replay.
 */
export function projectDailySales(ts: string, payload: StockLevelChangedPayload): void {
  const day = extractDay(ts);
  const { productId, delta, reason } = payload;

  // Get current values for this product+day
  const existing = db
    .prepare(`SELECT total_sold, total_delivered, transaction_count FROM daily_sales WHERE product_id = ? AND day = ?`)
    .get(productId, day) as { total_sold: number; total_delivered: number; transaction_count: number } | undefined;

  const currentSold = existing?.total_sold ?? 0;
  const currentDelivered = existing?.total_delivered ?? 0;
  const currentCount = existing?.transaction_count ?? 0;

  // Calculate new values based on event
  let newSold = currentSold;
  let newDelivered = currentDelivered;

  if (reason === "SALE" && delta < 0) {
    // Sales are negative deltas - store as positive for readability
    newSold = currentSold + Math.abs(delta);
  } else if (reason === "DELIVERY" && delta > 0) {
    newDelivered = currentDelivered + delta;
  }
  // ADJUSTMENT events don't count as sales or deliveries

  // Upsert the projection
  db.prepare(`
    INSERT INTO daily_sales (product_id, day, total_sold, total_delivered, transaction_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(product_id, day) DO UPDATE SET
      total_sold = excluded.total_sold,
      total_delivered = excluded.total_delivered,
      transaction_count = excluded.transaction_count
  `).run(productId, day, newSold, newDelivered, currentCount + 1);
}

/**
 * Get sales summary for a specific day
 */
export function getDailySales(day: string): Array<{
  productId: string;
  totalSold: number;
  totalDelivered: number;
  transactionCount: number;
}> {
  const rows = db
    .prepare(`
      SELECT product_id, total_sold, total_delivered, transaction_count
      FROM daily_sales
      WHERE day = ?
      ORDER BY total_sold DESC
    `)
    .all(day) as Array<{
      product_id: string;
      total_sold: number;
      total_delivered: number;
      transaction_count: number;
    }>;

  return rows.map(row => ({
    productId: row.product_id,
    totalSold: row.total_sold,
    totalDelivered: row.total_delivered,
    transactionCount: row.transaction_count,
  }));
}

/**
 * Get sales summary for a product across all days
 */
export function getProductSalesHistory(productId: string): Array<{
  day: string;
  totalSold: number;
  totalDelivered: number;
  transactionCount: number;
}> {
  const rows = db
    .prepare(`
      SELECT day, total_sold, total_delivered, transaction_count
      FROM daily_sales
      WHERE product_id = ?
      ORDER BY day DESC
    `)
    .all(productId) as Array<{
      day: string;
      total_sold: number;
      total_delivered: number;
      transaction_count: number;
    }>;

  return rows.map(row => ({
    day: row.day,
    totalSold: row.total_sold,
    totalDelivered: row.total_delivered,
    transactionCount: row.transaction_count,
  }));
}

/**
 * Rebuild entire daily_sales projection from events.
 *
 * Same pattern as stockProjection:
 * 1. Delete all projection data
 * 2. Replay all StockLevelChanged events in order
 */
export function rebuildDailySales(): void {
  // Clear the projection (safe - we'll rebuild from events)
  db.prepare(`DELETE FROM daily_sales`).run();

  // Replay all stock events
  const rows = db
    .prepare(`
      SELECT payload, ts
      FROM events
      WHERE type = 'StockLevelChanged'
      ORDER BY ts ASC
    `)
    .all() as Array<{ payload: string; ts: string }>;

  for (const row of rows) {
    const payload = JSON.parse(row.payload) as StockLevelChangedPayload;
    projectDailySales(row.ts, payload);
  }
}
