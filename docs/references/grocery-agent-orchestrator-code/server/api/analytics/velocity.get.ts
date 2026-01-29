import { getDatabase } from "~~/server/core/db";

/**
 * # Product Velocity Analytics API
 *
 * Returns sales velocity metrics for products over time windows.
 *
 * Query params:
 * - productId (optional): Filter by specific product
 * - windowDays (optional): Filter by window (7 or 30)
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const { productId, windowDays } = query;

  const db = getDatabase();

  let sql = `
    SELECT
      product_id,
      window_days,
      units_sold,
      avg_per_day,
      first_sale_ts,
      last_sale_ts,
      last_updated
    FROM product_velocity
    WHERE 1=1
  `;

  const params: any[] = [];

  if (productId) {
    sql += ` AND product_id = ?`;
    params.push(productId);
  }

  if (windowDays) {
    sql += ` AND window_days = ?`;
    params.push(parseInt(String(windowDays), 10));
  }

  sql += ` ORDER BY avg_per_day DESC`;

  const rows = db.prepare(sql).all(...params);

  return {
    success: true,
    data: rows,
  };
});
