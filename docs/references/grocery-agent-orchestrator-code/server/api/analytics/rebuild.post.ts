import { rebuildAnalyticsProjections } from "~~/server/consumers/analyticsConsumer";

/**
 * # Rebuild Analytics Projections
 *
 * Deletes all analytics projections and rebuilds them from the event log.
 *
 * This demonstrates:
 * - Analytics projections are independent from main workflow
 * - Projections can be rebuilt anytime from events
 * - Same events → same analytics (determinism)
 */
export default defineEventHandler(async () => {
  try {
    rebuildAnalyticsProjections();

    return {
      success: true,
      message: "Analytics projections rebuilt successfully",
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `Failed to rebuild analytics: ${error.message}`,
    });
  }
});
