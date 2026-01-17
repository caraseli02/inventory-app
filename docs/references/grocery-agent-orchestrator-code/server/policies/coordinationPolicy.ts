import { db } from "../core/db.js";

/**
 * # Coordination Policy (Gate #3)
 *
 * Purpose:
 * - Prevent conflicting actions that would cause operational churn.
 * - Keep coordination deterministic by relying on projections derived from events.
 *
 * Current invariant:
 * - Only one price change per product per calendar day.
 *
 * This is enforced using the `daily_price_changes` projection table.
 */

/**
 * Convert an ISO timestamp to `YYYY-MM-DD`.
 * This is our “day bucket” for price-change coordination.
 */
function dayKey(ts: string): string {
  return ts.slice(0, 10);
}

/**
 * Check if a product is allowed to change price today.
 * Returns true when no price change has been recorded for the same day.
 */
export function canChangePriceToday(input: { productId: string; ts: string }): boolean {
  const day = dayKey(input.ts);
  const row = db
    .prepare(`SELECT 1 FROM daily_price_changes WHERE product_id = ? AND day = ? LIMIT 1`)
    .get(input.productId, day);
  return !row;
}

/**
 * Record that a price change happened today for a product.
 * This is called after a `PriceChanged` event is emitted.
 */
export function markPriceChangedToday(input: { productId: string; ts: string }): void {
  const day = dayKey(input.ts);
  db.prepare(`
    INSERT INTO daily_price_changes (product_id, day)
    VALUES (?, ?)
    ON CONFLICT(product_id, day) DO NOTHING
  `).run(input.productId, day);
}
