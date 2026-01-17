import { getDatabase } from "~~/server/core/db";

/**
 * # Pending Actions Query (HTTP)
 *
 * This route exposes a read‑only view of action_state (projection).
 * It is used by humans/UIs to see which actions need review or were executed.
 *
 * Important:
 * - This is a query endpoint only (no mutations).
 * - It reads projections and the event log for context.
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const { productId, status = "NEEDS_HUMAN_REVIEW", limit = "100" } = query;

  const db = getDatabase();

  // Normalize inputs for predictable queries.
  const normalizedStatus = String(status).toUpperCase();
  const normalizedLimit = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 100));

  // Query action_state projection and attach the ActionProposed payload (context).
  const stmt = productId
    ? db.prepare(`
        SELECT
          a.action_id,
          a.product_id,
          a.action_type,
          a.status,
          a.ts,
          (
            SELECT payload
            FROM events
            WHERE type = 'ActionProposed' AND aggregate_id = a.action_id
            ORDER BY ts ASC
            LIMIT 1
          ) AS proposed_payload
        FROM action_state a
        WHERE a.product_id = ? AND a.status = ?
        ORDER BY a.ts DESC
        LIMIT ?
      `)
    : db.prepare(`
        SELECT
          a.action_id,
          a.product_id,
          a.action_type,
          a.status,
          a.ts,
          (
            SELECT payload
            FROM events
            WHERE type = 'ActionProposed' AND aggregate_id = a.action_id
            ORDER BY ts ASC
            LIMIT 1
          ) AS proposed_payload
        FROM action_state a
        WHERE a.status = ?
        ORDER BY a.ts DESC
        LIMIT ?
      `);

  // Execute query with optional product filter.
  const rows = productId
    ? (stmt.all(productId as string, normalizedStatus, normalizedLimit) as any[])
    : (stmt.all(normalizedStatus, normalizedLimit) as any[]);

  // Shape the response and parse the proposal payload JSON.
  const actions = rows.map((row) => {
    const proposed = row.proposed_payload ? JSON.parse(row.proposed_payload) : null;
    return {
      id: row.action_id,
      productId: row.product_id,
      actionType: row.action_type,
      status: row.status,
      ts: row.ts,
      proposed,
    };
  });

  return {
    actions,
    count: actions.length,
  };
});
