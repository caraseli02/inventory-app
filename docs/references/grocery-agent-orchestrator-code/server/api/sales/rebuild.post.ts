import { defineEventHandler } from "h3";
import { rebuildDailySales } from "../../projectors/salesProjection";

/**
 * POST /api/sales/rebuild
 *
 * Rebuild the daily_sales projection from scratch.
 * Demonstrates that projections are derived and rebuildable.
 */
export default defineEventHandler(() => {
  const startTime = Date.now();

  rebuildDailySales();

  const duration = Date.now() - startTime;

  return {
    success: true,
    message: "Daily sales projection rebuilt from events",
    durationMs: duration,
  };
});
