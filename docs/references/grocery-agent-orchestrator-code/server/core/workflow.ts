import { nanoid } from "nanoid";
import { appendEvent } from "./eventStore.js";
import { projectStockLevelChanged } from "../projectors/stockProjection.js";
import { projectDailySales } from "../projectors/salesProjection.js";
import { proposeActionsForProduct } from "../agents/recommendationAgent.js";
import { requiresHumanReview } from "../policies/confidencePolicy.js";
import { isAllowedBusinessRule } from "../policies/businessRulesPolicy.js";
import { canChangePriceToday, markPriceChangedToday } from "../policies/coordinationPolicy.js";
import { requiresHumanReviewForReorder } from "../policies/reorderPolicy.js";
import { isWithinBusinessHours } from "../policies/timeOfDayPolicy.js";
import { db } from "./db.js";
import type {
  ActionProposedPayload,
  EventEnvelope,
  HumanDecisionRecordedPayload,
  ProductDiscontinuedPayload,
  StockLevelChangedPayload,
} from "./types.js";
import { projectHourlySales } from "../projectors/hourlySalesProjection.js";

/**
 * # Workflow Orchestrator (Event → Policy → Execution)
 *
 * This file coordinates the end‑to‑end flow:
 * - event ingestion
 * - projection updates
 * - agent proposals
 * - policy gates
 * - authorization + execution
 *
 * Invariants enforced here:
 * - All state changes are represented as events.
 * - Agents only propose; policies decide; execution is dumb.
 * - Every decision (approve/reject/suppress/review) is auditable.
 */

/**
 * Standard ISO timestamp helper.
 */
function nowIso(): string {
  return new Date().toISOString();
}

// helper function to check if a product is discontinued
  function isProductDiscontinued(productId: string): boolean {
    const row = db.prepare(`SELECT 1 FROM discontinued_products WHERE product_id = ?`).get(productId);
    return row !== undefined;
  }

/**
 * Update the action_state projection.
 *
 * Note: this is derived state, not a source of truth. Each update here
 * corresponds to an immutable event in the event log.
 */
function recordActionState(actionId: string, productId: string, actionType: string, status: string, ts: string): void {
  db.prepare(`
    INSERT INTO action_state (action_id, product_id, action_type, status, ts)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(action_id) DO UPDATE SET status = excluded.status, ts = excluded.ts
  `).run(actionId, productId, actionType, status, ts);
}

/**
 * Ingest a stock change and trigger the full workflow.
 *
 * Flow:
 * 1) Append StockLevelChanged event (fact)
 * 2) Update projections
 * 3) Ask agent for proposals
 * 4) Process each proposal through policy gates
 */
export function handleStockLevelChanged(input: {
  productId: string;
  delta: number;
  reason: "SALE" | "DELIVERY" | "ADJUSTMENT";
  threshold?: number;
  source?: string;
}): { eventId: string; proposedActionIds: string[] } {
  const ts = nowIso();
  const event: EventEnvelope<"StockLevelChanged", StockLevelChangedPayload> = {
    id: nanoid(),
    type: "StockLevelChanged",
    ts,
    aggregateType: "Product",
    aggregateId: input.productId,
    payload: {
      productId: input.productId,
      delta: input.delta,
      reason: input.reason,
      threshold: input.threshold,
      source: input.source,
    },
  };

  appendEvent(event);

  // Projection updates (rebuildable)
  projectStockLevelChanged(ts, event.payload);
  projectDailySales(ts, event.payload);
  projectHourlySales({
  productId: input.productId,
  delta: input.delta,
  reason: input.reason,
  ts,
});

  // Skip proposals for discontinued products
  if (isProductDiscontinued(input.productId)) {
    return { eventId: event.id, proposedActionIds: [] };
  }

  // Agent proposes actions (bounded)
  const proposals = proposeActionsForProduct({
    ts,
    productId: input.productId,
    experimentId: "GROCERY_OPT_V1",
    variant: "A",
  });

  for (const proposal of proposals) {
    emitAndProcessActionProposed(ts, input.productId, proposal, event.id);
  }

  return { eventId: event.id, proposedActionIds: proposals.map((p) => p.actionId) };
}

/**
 * Take one ActionProposed payload and run all policy gates in order.
 *
 * Outcomes:
 * - ActionRequiresHumanReview
 * - ActionRejected
 * - ActionSuppressed
 * - ActionAuthorized → execution
 */
function emitAndProcessActionProposed(ts: string, productId: string, proposal: ActionProposedPayload, causationId: string): void {
  const proposedEvent: EventEnvelope<"ActionProposed", ActionProposedPayload> = {
    id: nanoid(),
    type: "ActionProposed",
    ts,
    aggregateType: "Action",
    aggregateId: proposal.actionId,
    correlationId: `product:${productId}`,
    causationId,
    payload: proposal,
  };

  appendEvent(proposedEvent);
  recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "PROPOSED", ts);

  // Policy Gate 1: confidence
  if (requiresHumanReview(proposal.confidence)) {
    appendEvent({
      id: nanoid(),
      type: "ActionRequiresHumanReview",
      ts,
      aggregateType: "Action",
      aggregateId: proposal.actionId,
      correlationId: proposedEvent.correlationId,
      causationId: proposedEvent.id,
      payload: { actionId: proposal.actionId, reason: "LOW_CONFIDENCE" },
    });
    recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "NEEDS_HUMAN_REVIEW", ts);
    return;
  }

  // Policy Gate 1b: reorder policy (all reorders need human review)
  if (requiresHumanReviewForReorder(proposal.actionType)) {
    appendEvent({
      id: nanoid(),
      type: "ActionRequiresHumanReview",
      ts,
      aggregateType: "Action",
      aggregateId: proposal.actionId,
      correlationId: proposedEvent.correlationId,
      causationId: proposedEvent.id,
      payload: { actionId: proposal.actionId, reason: "REORDER_REQUIRES_APPROVAL" },
    });
    recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "NEEDS_HUMAN_REVIEW", ts);
    return;
  }

  // Policy Gate 2: business rules
  const rule = isAllowedBusinessRule({ actionType: proposal.actionType, suggestedValueCents: proposal.suggestedValueCents });
  if (!rule.ok) {
    appendEvent({
      id: nanoid(),
      type: "ActionRejected",
      ts,
      aggregateType: "Action",
      aggregateId: proposal.actionId,
      correlationId: proposedEvent.correlationId,
      causationId: proposedEvent.id,
      payload: { actionId: proposal.actionId, reason: rule.reason },
    });
    recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "REJECTED", ts);
    return;
  }

  // Policy Gate 4: coordination (one price change per product per day)
  if (proposal.actionType === "PRICE_INCREASE" || proposal.actionType === "PRICE_DECREASE") {
    if (!canChangePriceToday({ productId: proposal.productId, ts })) {
      appendEvent({
        id: nanoid(),
        type: "ActionSuppressed",
        ts,
        aggregateType: "Action",
        aggregateId: proposal.actionId,
        correlationId: proposedEvent.correlationId,
        causationId: proposedEvent.id,
        payload: { actionId: proposal.actionId, reason: "PRICE_ALREADY_CHANGED_TODAY" },
      });
      recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "SUPPRESSED", ts);
      return;
    }

    // Policy Gate 5: time of day (price changes only during business hours)
    if (!isWithinBusinessHours(ts)) {
      appendEvent({
        id: nanoid(),
        type: "ActionSuppressed",
        ts,
        aggregateType: "Action",
        aggregateId: proposal.actionId,
        correlationId: proposedEvent.correlationId,
        causationId: proposedEvent.id,
        payload: { actionId: proposal.actionId, reason: "OUTSIDE_BUSINESS_HOURS" },
      });
      recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "SUPPRESSED", ts);
      return;
    }
  }

  appendEvent({
    id: nanoid(),
    type: "ActionAuthorized",
    ts,
    aggregateType: "Action",
    aggregateId: proposal.actionId,
    correlationId: proposedEvent.correlationId,
    causationId: proposedEvent.id,
    payload: { actionId: proposal.actionId },
  });
  recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "AUTHORIZED", ts);

  // Execution (dumb) – do the side-effect now for MVP
  executeAuthorizedAction(ts, proposal);
}

/**
 * Record a human decision and continue the workflow.
 *
 * - Rejected → ActionRejected
 * - Approved → ActionAuthorized + execution
 */
export function handleHumanDecision(
  input: HumanDecisionRecordedPayload,
): { ok: true } | { ok: false; reason: "NOT_FOUND" | "MISSING_PROPOSAL" } {
  const ts = nowIso();

  appendEvent({
    id: nanoid(),
    type: "HumanDecisionRecorded",
    ts,
    aggregateType: "Action",
    aggregateId: input.actionId,
    payload: input,
  });

  const action = db
    .prepare(`SELECT action_id, product_id, action_type, status FROM action_state WHERE action_id = ?`)
    .get(input.actionId) as { action_id: string; product_id: string; action_type: string; status: string } | undefined;

  if (!action) return { ok: false, reason: "NOT_FOUND" };

  if (input.decision === "REJECTED") {
    appendEvent({
      id: nanoid(),
      type: "ActionRejected",
      ts,
      aggregateType: "Action",
      aggregateId: input.actionId,
      payload: { actionId: input.actionId, reason: "HUMAN_REJECTED" },
    });
    recordActionState(input.actionId, action.product_id, action.action_type, "REJECTED", ts);
    return { ok: true };
  }

  // If human approves, authorize and execute
  appendEvent({
    id: nanoid(),
    type: "ActionAuthorized",
    ts,
    aggregateType: "Action",
    aggregateId: input.actionId,
    payload: { actionId: input.actionId },
  });
  recordActionState(input.actionId, action.product_id, action.action_type, "AUTHORIZED", ts);

  // For MVP we need the proposal payload to execute; easiest: find it from events
  // (In a bigger system you'd keep projections/materialized views for proposals.)
  const proposalRow = db
    .prepare(`SELECT payload FROM events WHERE type = 'ActionProposed' AND aggregate_id = ? ORDER BY ts ASC LIMIT 1`)
    .get(input.actionId) as { payload: string } | undefined;

  if (!proposalRow) return { ok: false, reason: "MISSING_PROPOSAL" };

  const proposal = JSON.parse(proposalRow.payload) as ActionProposedPayload;
  executeAuthorizedAction(ts, proposal);

  return { ok: true };
}

/**
 * A function to handle the ProductDiscontinued event
 *
 * This will:
 * - Append the ProductDiscontinued event
 * - Update the discontinued_products projection
 */

export function handleProductDiscontinued(input: ProductDiscontinuedPayload): { eventId: string } {
  const ts = nowIso();
  const event: EventEnvelope<"ProductDiscontinued", ProductDiscontinuedPayload> = {
    id: nanoid(),
    type: "ProductDiscontinued",
    ts,
    aggregateType: "Product",
    aggregateId: input.productId,
    payload: {
      productId: input.productId,
      reason: input.reason,
      discontinuedBy: input.discontinuedBy,
    },
  };

  appendEvent(event);

  // Update the discontinued_products projection
  db.prepare(`
    INSERT INTO discontinued_products (product_id, reason, discontinued_by, discontinued_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET reason = excluded.reason, discontinued_at = excluded.discontinued_at, source = excluded.source
  `).run(input.productId, input.reason, ts, input.discontinuedBy);

  return { eventId: event.id };
}

/**
 * Execute authorized actions.
 *
 * IMPORTANT:
 * - No policies here.
 * - Only side effects + events.
 */
function executeAuthorizedAction(ts: string, proposal: ActionProposedPayload): void {
  if (proposal.actionType === "REORDER") {
    appendEvent({
      id: nanoid(),
      type: "ReorderPlaced",
      ts,
      aggregateType: "Product",
      aggregateId: proposal.productId,
      payload: { productId: proposal.productId, actionId: proposal.actionId, notes: proposal.reason },
    });
    recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "EXECUTED", ts);
    return;
  }

  if (proposal.actionType === "PRICE_DECREASE" || proposal.actionType === "PRICE_INCREASE") {
    executePriceChange(ts, proposal);
  }
}

/**
 * Execute a price change and emit the PriceChanged event.
 * Updates projections after the event is written.
 */
function executePriceChange(ts: string, proposal: ActionProposedPayload): void {
  const existing = db
    .prepare(`SELECT price_cents FROM product_prices WHERE product_id = ?`)
    .get(proposal.productId) as { price_cents: number } | undefined;

  const current = existing?.price_cents ?? 500;
  const delta = Math.abs(proposal.suggestedValueCents);
  const next = proposal.actionType === "PRICE_DECREASE"
    ? Math.max(1, current - delta)
    : current + delta;

  appendEvent({
    id: nanoid(),
    type: "PriceChanged",
    ts,
    aggregateType: "Product",
    aggregateId: proposal.productId,
    payload: { productId: proposal.productId, oldPriceCents: current, newPriceCents: next, actionId: proposal.actionId },
  });

  db.prepare(`
    INSERT INTO product_prices (product_id, price_cents, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET price_cents = excluded.price_cents, updated_at = excluded.updated_at
  `).run(proposal.productId, next, ts);

  markPriceChangedToday({ productId: proposal.productId, ts });
  recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "EXECUTED", ts);
}


