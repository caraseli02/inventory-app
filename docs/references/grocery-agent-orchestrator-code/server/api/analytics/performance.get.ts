import { getDatabase } from "~~/server/core/db";

/**
 * # Agent Performance Analytics API
 *
 * Returns agent performance metrics grouped by confidence buckets.
 *
 * Shows how well the agent's confidence correlates with actual approval rates.
 */
export default defineEventHandler(() => {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT
        confidence_bucket,
        total_proposals,
        approved_count,
        rejected_count,
        approval_rate,
        last_updated
       FROM agent_performance
       ORDER BY confidence_bucket ASC`
    )
    .all();

  return {
    success: true,
    data: rows,
  };
});
