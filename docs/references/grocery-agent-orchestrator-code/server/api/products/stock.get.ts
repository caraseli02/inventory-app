import { defineEventHandler } from "h3";
import { db } from "../../core/db";

/**
 * # All Products Stock Query (HTTP)
 *
 * Read-only endpoint returning the current stock projection for all products.
 * Useful for dashboards or sanity checks.
 *
 * Note: This reads from `stock_levels` (projection), not the event log.
 */
export default defineEventHandler(() => {
  const products = db
    .prepare(`
      SELECT product_id, quantity, updated_at
      FROM stock_levels
      ORDER BY updated_at DESC
    `)
    .all() as Array<{ product_id: string; quantity: number; updated_at: string }>;

  return products.map((row) => ({
    productId: row.product_id,
    quantity: row.quantity,
    updatedAt: row.updated_at,
  }));
});
