/**
 * # Reorder Policy (Gate for inventory orders)
 *
 * Purpose:
 * - Control when reorder actions require human approval
 * - Inventory orders cost money, so we may want human oversight
 *
 * Current rules:
 * - ALL reorders require human review (regardless of confidence)
 *
 * Why this makes sense:
 * - Ordering inventory has real financial impact
 * - Even high-confidence AI recommendations should be verified
 * - Humans can catch context the AI doesn't see (holidays, promotions, etc.)
 *
 * You can modify this to be more nuanced:
 * - Only require review for orders above certain quantity
 * - Auto-approve for certain product categories
 * - Time-based rules (auto-approve during business hours)
 */

export function requiresHumanReviewForReorder(actionType: string): boolean {
  // ALL reorders require human review
  if (actionType === "REORDER") {
    return true;
  }
  return false;
}

/**
 * Future enhancement ideas:
 *
 * export function requiresHumanReviewForReorder(input: {
 *   actionType: string;
 *   productId: string;
 *   currentStock: number;
 *   estimatedCost?: number;
 * }): boolean {
 *   if (input.actionType !== "REORDER") return false;
 *
 *   // Auto-approve small reorders
 *   if (input.estimatedCost && input.estimatedCost < 100) return false;
 *
 *   // Auto-approve for non-critical stock levels
 *   if (input.currentStock > 5) return false;
 *
 *   // Everything else needs review
 *   return true;
 * }
 */
