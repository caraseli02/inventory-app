import { getDatabase } from "~~/server/core/db";

/**
 * # Stock Health Analytics API
 *
 * Returns inventory health analysis combining current stock and consumption rates.
 *
 * Query params:
 * - status (optional): Filter by health status (CRITICAL, LOW, HEALTHY, OVERSTOCKED, etc.)
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const { status } = query;

  const db = getDatabase();

  let sql = `
    SELECT
      product_id,
      current_stock,
      avg_daily_consumption,
      days_until_stockout,
      health_status,
      last_updated
    FROM stock_health
    WHERE 1=1
  `;

  const params: any[] = [];

  if (status) {
    sql += ` AND health_status = ?`;
    params.push(String(status).toUpperCase());
  }

  sql += ` ORDER BY
    CASE health_status
      WHEN 'CRITICAL' THEN 1
      WHEN 'OUT_OF_STOCK' THEN 2
      WHEN 'LOW' THEN 3
      WHEN 'HEALTHY' THEN 4
      WHEN 'OVERSTOCKED' THEN 5
      ELSE 6
    END,
    days_until_stockout ASC`;

  const rows = db.prepare(sql).all(...params);

  return {
    success: true,
    data: rows,
  };
});
