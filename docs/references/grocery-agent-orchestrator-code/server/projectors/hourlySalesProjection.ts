import { db } from "../core/db.js";

/**
 * # Hourly Sales Projector
 *
 * Purpose:
 * - Track sales at hourly granularity
 * - Enable peak-hour analysis and real-time dashboards
 *
 * Called when:
 * - StockLevelChanged event with reason "SALE"
 *
 * Projection rule:
 * - Extract hour from timestamp (truncate to "YYYY-MM-DDTHH")
 * - Increment total_sold by absolute delta
 * - Increment transaction_count by 1
 */
export function projectHourlySales(input: {
  productId: string;
  delta: number;
  reason: string;
  ts: string;
}): void {
  // Only track sales (negative delta with SALE reason)
  if (input.reason !== "SALE" || input.delta >= 0) {
    return;
  }

  // Extract hour from ISO timestamp: "2025-01-15T14:30:00Z" → "2025-01-15T14"
  const hour = input.ts.slice(0, 13);
  const soldAmount = Math.abs(input.delta);

  db.prepare(`
    INSERT INTO hourly_sales (product_id, hour, total_sold, transaction_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(product_id, hour) DO UPDATE SET
      total_sold = hourly_sales.total_sold + excluded.total_sold,
      transaction_count = hourly_sales.transaction_count + 1
  `).run(input.productId, hour, soldAmount);
}
