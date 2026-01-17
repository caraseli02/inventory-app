import { handleHumanDecision } from "~~/server/core/workflow";

/**
 * Normalize incoming decision strings to our canonical enum.
 * Accepts "approve"/"approved" and "reject"/"rejected" in any casing.
 */
function normalizeDecision(raw: string): "APPROVED" | "REJECTED" | null {
  const normalized = raw.toUpperCase();
  if (normalized === "APPROVED" || normalized === "APPROVE") {
    return "APPROVED";
  }
  if (normalized === "REJECTED" || normalized === "REJECT") {
    return "REJECTED";
  }
  return null;
}

/**
 * # Human Decision Ingress (HTTP)
 *
 * This route records a human approval/rejection for an action that
 * required review.
 *
 * Important:
 * - HTTP is ingress only; no business logic here.
 * - We validate/normalize input, then delegate to the workflow.
 */
export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as any;
  const actionId = body?.actionId as string | undefined;
  const reviewerId = (body?.reviewerId ?? body?.humanId) as string | undefined;
  const decisionRaw = body?.decision as string | undefined;

  // Basic input validation.
  if (!actionId || !reviewerId || !decisionRaw) {
    throw createError({
      statusCode: 400,
      message: "Missing required fields: actionId, decision, reviewerId (or humanId)",
    });
  }

  // Normalize decision to canonical enum.
  const decision = normalizeDecision(decisionRaw);
  if (!decision) {
    throw createError({
      statusCode: 400,
      message: "Invalid decision (use APPROVED/REJECTED or approve/reject)",
    });
  }

  // Delegate to core workflow (emits events + updates projections).
  const result = handleHumanDecision({ actionId, decision, reviewerId });

  // Map workflow errors to HTTP status codes.
  if (!result.ok) {
    if (result.reason === "NOT_FOUND") {
      throw createError({ statusCode: 404, message: `Action ${actionId} not found` });
    }
    throw createError({ statusCode: 409, message: `Action ${actionId} is missing proposal data` });
  }

  return {
    success: true,
    actionId,
    decision: decision.toLowerCase(),
  };
});
