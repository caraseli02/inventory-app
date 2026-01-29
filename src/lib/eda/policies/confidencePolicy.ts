const AUTO_APPROVE_THRESHOLD = 0.7;

/**
 * # Confidence Policy (Gate #1)
 *
 * Purpose:
 * - Route low/medium-confidence proposals to human review.
 * - Keep the policy deterministic and simple (no AI here).
 *
 * This is intentionally minimal:
 * - If confidence < threshold → requires human review.
 * - Otherwise → can auto-approve (other policies may still reject/suppress).
 *
 * Why a separate module:
 * - One policy = one invariant.
 * - Makes it easy to audit or adjust thresholds without touching workflow logic.
 */
export function requiresHumanReview(confidence: number): boolean {
  return confidence < AUTO_APPROVE_THRESHOLD;
}
