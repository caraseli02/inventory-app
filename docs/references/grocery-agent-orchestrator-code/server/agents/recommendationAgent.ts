import { nanoid } from "nanoid";
import { db } from "../core/db.js";
import type { ActionProposedPayload, StockLevelChangedPayload } from "../core/types.js";

/**
 * # Recommendation Agent (Proposal-Only)
 *
 * This module simulates an "AI agent" that proposes actions.
 *
 * Architectural rules it follows:
 * - It NEVER executes changes (no writes to stock/price tables).
 * - It NEVER enforces policy (no business rules, no human gating).
 * - It ONLY returns `ActionProposed` payloads with confidence + reasoning.
 *
 * This separation keeps the system safe:
 * - Agents suggest.
 * - Policies decide.
 * - Execution runs only after authorization.
 */

/**
 * Default reorder threshold used when we don't have historical context.
 * In a real system this would likely come from a product catalog or config.
 */
const DEFAULT_REORDER_THRESHOLD = 10;

/**
 * Read the most recent threshold from the latest StockLevelChanged event.
 * This keeps the agent dependent on *events* (facts), not API input.
 */
function readReorderThreshold(productId: string): number {
  const row = db
    .prepare(`
      SELECT payload
      FROM events
      WHERE type = 'StockLevelChanged' AND aggregate_id = ?
      ORDER BY ts DESC
      LIMIT 1
    `)
    .get(productId) as { payload: string } | undefined;

  if (!row) return DEFAULT_REORDER_THRESHOLD;

  try {
    const payload = JSON.parse(row.payload) as Partial<StockLevelChangedPayload>;
    const threshold = payload.threshold;
    return Number.isFinite(threshold) && threshold > 0 ? Math.trunc(threshold) : DEFAULT_REORDER_THRESHOLD;
  } catch {
    return DEFAULT_REORDER_THRESHOLD;
  }
}

/**
 * Read current stock from the projection.
 * This is *derived* state, not authoritative truth.
 */
function readCurrentStock(productId: string): number {
  const row = db
    .prepare(`SELECT quantity FROM stock_levels WHERE product_id = ?`)
    .get(productId) as { quantity: number } | undefined;

  return row?.quantity ?? 0;
}

/**
 * Read current price from the price projection.
 * Used only to compute a relative price decrease proposal.
 */
function readCurrentPriceCents(productId: string): number {
  const row = db
    .prepare(`SELECT price_cents FROM product_prices WHERE product_id = ?`)
    .get(productId) as { price_cents: number } | undefined;

  return row?.price_cents ?? 500;
}

/**
 * Produce a list of proposed actions for a given product.
 *
 * IMPORTANT:
 * - This does not write to the DB.
 * - It returns proposals only; policies and workflow decide what happens next.
 *
 * Current heuristic:
 * - If stock <= threshold → propose REORDER (confidence depends on severity).
 * - If stock >= threshold * 3 → propose PRICE_DECREASE (mild confidence).
 *
 * Experiment metadata (`experimentId`, `variant`) is included so you can
 * analyze outcomes across variants later without changing the event schema.
 */
export function proposeActionsForProduct(input: {
  ts: string;
  productId: string;
  experimentId: string;
  variant: string;
}): ActionProposedPayload[] {
  const currentStock = readCurrentStock(input.productId);
  const threshold = readReorderThreshold(input.productId);

  const proposals: ActionProposedPayload[] = [];

  if (currentStock <= threshold) {
    const isCritical = currentStock <= threshold * 0.5;
    proposals.push({
      actionId: nanoid(),
      productId: input.productId,
      actionType: "REORDER",
      suggestedValueCents: 0,
      confidence: isCritical ? 0.92 : 0.68,
      reason: isCritical
        ? `Stock critically low (${currentStock}/${threshold}). Recommend reorder now.`
        : `Stock below threshold (${currentStock}/${threshold}). Consider reorder.`,
      experimentId: input.experimentId,
      variant: input.variant,
    });

    return proposals;
  }

  if (currentStock >= threshold * 3) {
    const currentPriceCents = readCurrentPriceCents(input.productId);
    const deltaCents = Math.min(200, Math.max(25, Math.round(currentPriceCents * 0.1)));

    proposals.push({
      actionId: nanoid(),
      productId: input.productId,
      actionType: "PRICE_DECREASE",
      suggestedValueCents: deltaCents,
      confidence: 0.74,
      reason: `Overstocked (${currentStock} units vs threshold ${threshold}). Suggest price decrease by ${deltaCents} cents.`,
      experimentId: input.experimentId,
      variant: input.variant,
    });
  }

  return proposals;
}
