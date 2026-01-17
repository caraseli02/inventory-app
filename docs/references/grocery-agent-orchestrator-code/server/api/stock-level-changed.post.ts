import { getDatabase } from "~~/server/core/db";
import { handleStockLevelChanged } from "~~/server/core/workflow";

/**
 * # Stock Level Change Ingress (HTTP)
 *
 * This route is the external entry point for stock updates.
 *
 * Important:
 * - HTTP is *ingress only*; no business rules live here.
 * - We validate/normalize inputs, then hand off to core workflow.
 * - The workflow is responsible for emitting events and applying policies.
 */
export default defineEventHandler(async (event) => {
  // Parse JSON body from the request.
  const body = (await readBody(event)) as any;

  // Required: productId
  const productId = body?.productId as string | undefined;
  if (!productId) {
    throw createError({ statusCode: 400, message: "Missing required field: productId" });
  }

  // Optional metadata that becomes part of the StockLevelChanged event.
  const source = typeof body?.source === "string" ? body.source : undefined;
  const threshold = typeof body?.threshold === "number" ? Math.trunc(body.threshold) : undefined;

  // Normalize reason to the known enum values.
  const reasonRaw = typeof body?.reason === "string" ? body.reason : undefined;
  const reason =
    reasonRaw === "SALE" || reasonRaw === "DELIVERY" || reasonRaw === "ADJUSTMENT" ? reasonRaw : "ADJUSTMENT";

  // Either accept an explicit delta, or derive it from current/previous levels.
  let delta: number | undefined;
  if (typeof body?.delta === "number") {
    delta = Math.trunc(body.delta);
  } else if (typeof body?.currentLevel === "number") {
    const currentLevel = Math.trunc(body.currentLevel);

    // If previousLevel isn't provided, use the projection as the baseline.
    const previousLevel =
      typeof body?.previousLevel === "number"
        ? Math.trunc(body.previousLevel)
        : ((getDatabase()
            .prepare(`SELECT quantity FROM stock_levels WHERE product_id = ?`)
            .get(productId) as { quantity: number } | undefined)?.quantity ?? 0);

    delta = currentLevel - previousLevel;
  }

  // Missing delta (or currentLevel) is a hard error.
  if (delta === undefined || !Number.isFinite(delta)) {
    throw createError({
      statusCode: 400,
      message: "Missing required field: delta (or provide currentLevel)",
    });
  }

  // Delegate to core workflow (events + policies + execution).
  const result = handleStockLevelChanged({ productId, delta, reason, threshold, source });

  // Return a minimal confirmation + IDs for tracing.
  return {
    success: true,
    eventId: result.eventId,
    proposedActionIds: result.proposedActionIds,
    message: "Stock level change recorded",
  };
});
