type BusinessRuleResult = { ok: true } | { ok: false; reason: string };

/**
 * # Business Rules Policy (Gate #2)
 *
 * Purpose:
 * - Enforce hard constraints that must *always* hold.
 * - Keep rules deterministic and explainable.
 *
 * This policy is intentionally narrow for the MVP:
 * - REORDER is always allowed here (other policies may still block it).
 * - Price changes must be within a reasonable delta.
 *
 * If you add new invariants, add them here (one per rule) rather than
 * embedding them in the agent or execution layer.
 */
export function isAllowedBusinessRule(input: {
  actionType: "REORDER" | "PRICE_INCREASE" | "PRICE_DECREASE";
  suggestedValueCents: number;
}): BusinessRuleResult {
  // Reorders are always permitted by this policy.
  if (input.actionType === "REORDER") {
    return { ok: true };
  }

  // For price changes, treat suggestedValueCents as a delta.
  const delta = Math.abs(input.suggestedValueCents);

  // Reject non-numeric or zero/negative deltas.
  if (!Number.isFinite(delta) || delta < 1) {
    return { ok: false, reason: "INVALID_PRICE_DELTA" };
  }

  // Reject extremely large price moves (hard safety bound).
  if (delta > 500) {
    return { ok: false, reason: "PRICE_DELTA_TOO_LARGE" };
  }

  return { ok: true };
}
