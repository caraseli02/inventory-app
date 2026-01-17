import { getDatabase } from "~~/server/core/db";

/**
 * # Decision Latency Analytics API
 *
 * Returns metrics about time from proposal to human decision.
 *
 * Query params:
 * - productId (optional): Filter by product
 * - limit (optional): Max results (default 100)
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const { productId, limit = "100" } = query;

  const db = getDatabase();

  let sql = `
    SELECT
      action_id,
      product_id,
      action_type,
      confidence,
      proposed_at,
      decided_at,
      latency_seconds,
      decision,
      last_updated
    FROM decision_latency
    WHERE decided_at IS NOT NULL
  `;

  const params: any[] = [];

  if (productId) {
    sql += ` AND product_id = ?`;
    params.push(productId);
  }

  sql += ` ORDER BY proposed_at DESC LIMIT ?`;
  params.push(Math.min(500, Math.max(1, parseInt(String(limit), 10))));

  const rows = db.prepare(sql).all(...params);

  // Also compute summary statistics
  const summary = db
    .prepare(
      `SELECT
        COUNT(*) as total_decisions,
        AVG(latency_seconds) as avg_latency,
        MIN(latency_seconds) as min_latency,
        MAX(latency_seconds) as max_latency
       FROM decision_latency
       WHERE decided_at IS NOT NULL ${productId ? "AND product_id = ?" : ""}`
    )
    .get(...(productId ? [productId] : []));

  return {
    success: true,
    data: rows,
    summary,
  };
});
