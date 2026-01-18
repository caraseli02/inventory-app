import { appendEvent } from "./eventStore";
import { projectStockLevelChanged } from "../projectors/stockProjection";
import { projectDailySales } from "../projectors/salesProjection";
import { proposeActionsForProduct } from "../agents/recommendationAgent";
import { requiresHumanReview } from "../policies/confidencePolicy";
import { isAllowedBusinessRule } from "../policies/businessRulesPolicy";
import { canChangePriceToday, markPriceChangedToday } from "../policies/coordinationPolicy";
import { requiresHumanReviewForReorder } from "../policies/reorderPolicy";
import { isWithinBusinessHours } from "../policies/timeOfDayPolicy";
import { db } from "./db";
import type {
  ActionProposedPayload,
  EventEnvelope,
  HumanDecisionRecordedPayload,
  ProductDiscontinuedPayload,
  StockLevelChangedPayload,
} from "./types";
import { projectHourlySales } from "../projectors/hourlySalesProjection";

/**
 * # Workflow Orchestrator (Supabase Version)
 */

function nowIso(): string {
  return new Date().toISOString();
}

async function isProductDiscontinued(productId: string): Promise<boolean> {
  const { data, error } = await db
    .from('discontinued_products')
    .select('product_id')
    .eq('product_id', productId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

async function recordActionState(actionId: string, productId: string, actionType: string, status: string, ts: string): Promise<void> {
  const { error } = await db
    .from('action_state')
    .upsert({
      action_id: actionId,
      product_id: productId,
      action_type: actionType,
      status: status,
      ts: ts
    });
  
  if (error) throw error;
}

export async function handleStockLevelChanged(input: {
  productId: string;
  delta: number;
  reason: "SALE" | "DELIVERY" | "ADJUSTMENT";
  threshold?: number;
  source?: string;
}): Promise<{ eventId: string; proposedActionIds: string[] }> {
  const ts = nowIso();
  const event: EventEnvelope<"StockLevelChanged", StockLevelChangedPayload> = {
    id: crypto.randomUUID(),
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

  await appendEvent(event);

  // Projection updates
  await projectStockLevelChanged(ts, event.payload);
  await projectDailySales(ts, event.payload);
  await projectHourlySales({
    productId: input.productId,
    delta: input.delta,
    reason: input.reason,
    ts,
  });

  if (await isProductDiscontinued(input.productId)) {
    return { eventId: event.id, proposedActionIds: [] };
  }

  // Agent proposes actions
  const proposals = await proposeActionsForProduct({
    ts,
    productId: input.productId,
    experimentId: "GROCERY_OPT_V1",
    variant: "A",
  });

  for (const proposal of proposals) {
    await emitAndProcessActionProposed(ts, input.productId, proposal, event.id);
  }

  return { eventId: event.id, proposedActionIds: proposals.map((p) => p.actionId) };
}

async function emitAndProcessActionProposed(ts: string, productId: string, proposal: ActionProposedPayload, causationId: string): Promise<void> {
  const proposedEvent: EventEnvelope<"ActionProposed", ActionProposedPayload> = {
    id: crypto.randomUUID(),
    type: "ActionProposed",
    ts,
    aggregateType: "Action",
    aggregateId: proposal.actionId,
    correlationId: `product:${productId}`,
    causationId,
    payload: proposal,
  };

  await appendEvent(proposedEvent);
  await recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "PROPOSED", ts);

  if (requiresHumanReview(proposal.confidence)) {
    await appendEvent({
      id: crypto.randomUUID(),
      type: "ActionRequiresHumanReview",
      ts,
      aggregateType: "Action",
      aggregateId: proposal.actionId,
      correlationId: proposedEvent.correlationId,
      causationId: proposedEvent.id,
      payload: { actionId: proposal.actionId, reason: "LOW_CONFIDENCE" },
    });
    await recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "NEEDS_HUMAN_REVIEW", ts);
    return;
  }

  if (requiresHumanReviewForReorder(proposal.actionType)) {
    await appendEvent({
      id: crypto.randomUUID(),
      type: "ActionRequiresHumanReview",
      ts,
      aggregateType: "Action",
      aggregateId: proposal.actionId,
      correlationId: proposedEvent.correlationId,
      causationId: proposedEvent.id,
      payload: { actionId: proposal.actionId, reason: "REORDER_REQUIRES_APPROVAL" },
    });
    await recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "NEEDS_HUMAN_REVIEW", ts);
    return;
  }

  const rule = isAllowedBusinessRule({ actionType: proposal.actionType, suggestedValueCents: proposal.suggestedValueCents });
  if (!rule.ok) {
    await appendEvent({
      id: crypto.randomUUID(),
      type: "ActionRejected",
      ts,
      aggregateType: "Action",
      aggregateId: proposal.actionId,
      correlationId: proposedEvent.correlationId,
      causationId: proposedEvent.id,
      payload: { actionId: proposal.actionId, reason: rule.reason },
    });
    await recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "REJECTED", ts);
    return;
  }

  if (proposal.actionType === "PRICE_INCREASE" || proposal.actionType === "PRICE_DECREASE") {
    if (!(await canChangePriceToday({ productId: proposal.productId, ts }))) {
      await appendEvent({
        id: crypto.randomUUID(),
        type: "ActionSuppressed",
        ts,
        aggregateType: "Action",
        aggregateId: proposal.actionId,
        correlationId: proposedEvent.correlationId,
        causationId: proposedEvent.id,
        payload: { actionId: proposal.actionId, reason: "PRICE_ALREADY_CHANGED_TODAY" },
      });
      await recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "SUPPRESSED", ts);
      return;
    }

    if (!isWithinBusinessHours(ts)) {
      await appendEvent({
        id: crypto.randomUUID(),
        type: "ActionSuppressed",
        ts,
        aggregateType: "Action",
        aggregateId: proposal.actionId,
        correlationId: proposedEvent.correlationId,
        causationId: proposedEvent.id,
        payload: { actionId: proposal.actionId, reason: "OUTSIDE_BUSINESS_HOURS" },
      });
      await recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "SUPPRESSED", ts);
      return;
    }
  }

  await appendEvent({
    id: crypto.randomUUID(),
    type: "ActionAuthorized",
    ts,
    aggregateType: "Action",
    aggregateId: proposal.actionId,
    correlationId: proposedEvent.correlationId,
    causationId: proposedEvent.id,
    payload: { actionId: proposal.actionId },
  });
  await recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "AUTHORIZED", ts);

  await executeAuthorizedAction(ts, proposal);
}

export async function handleHumanDecision(
  input: HumanDecisionRecordedPayload,
): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" | "MISSING_PROPOSAL" }> {
  const ts = nowIso();

  await appendEvent({
    id: crypto.randomUUID(),
    type: "HumanDecisionRecorded",
    ts,
    aggregateType: "Action",
    aggregateId: input.actionId,
    payload: input,
  });

  const { data: action, error } = await db
    .from('action_state')
    .select('action_id, product_id, action_type, status')
    .eq('action_id', input.actionId)
    .single();

  if (error || !action) return { ok: false, reason: "NOT_FOUND" };

  if (input.decision === "REJECTED") {
    await appendEvent({
      id: crypto.randomUUID(),
      type: "ActionRejected",
      ts,
      aggregateType: "Action",
      aggregateId: input.actionId,
      payload: { actionId: input.actionId, reason: "HUMAN_REJECTED" },
    });
    await recordActionState(input.actionId, action.product_id, action.action_type, "REJECTED", ts);
    return { ok: true };
  }

  await appendEvent({
    id: crypto.randomUUID(),
    type: "ActionAuthorized",
    ts,
    aggregateType: "Action",
    aggregateId: input.actionId,
    payload: { actionId: input.actionId },
  });
  await recordActionState(input.actionId, action.product_id, action.action_type, "AUTHORIZED", ts);

  const { data: proposalRow, error: proposalError } = await db
    .from('events')
    .select('payload')
    .eq('type', 'ActionProposed')
    .eq('aggregate_id', input.actionId)
    .order('ts', { ascending: true })
    .limit(1)
    .single();

  if (proposalError || !proposalRow) return { ok: false, reason: "MISSING_PROPOSAL" };

  const proposal = proposalRow.payload as unknown as ActionProposedPayload;
  await executeAuthorizedAction(ts, proposal);

  return { ok: true };
}

export async function handleProductDiscontinued(input: ProductDiscontinuedPayload): Promise<{ eventId: string }> {
  const ts = nowIso();
  const event: EventEnvelope<"ProductDiscontinued", ProductDiscontinuedPayload> = {
    id: crypto.randomUUID(),
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

  await appendEvent(event);

  const { error } = await db
    .from('discontinued_products')
    .upsert({
      product_id: input.productId,
      reason: input.reason,
      discontinued_by: input.discontinuedBy,
      discontinued_at: ts
    });

  if (error) throw error;

  return { eventId: event.id };
}

async function executeAuthorizedAction(ts: string, proposal: ActionProposedPayload): Promise<void> {
  if (proposal.actionType === "REORDER") {
    await appendEvent({
      id: crypto.randomUUID(),
      type: "ReorderPlaced",
      ts,
      aggregateType: "Product",
      aggregateId: proposal.productId,
      payload: { productId: proposal.productId, actionId: proposal.actionId, notes: proposal.reason },
    });
    await recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "EXECUTED", ts);
    return;
  }

  if (proposal.actionType === "PRICE_DECREASE" || proposal.actionType === "PRICE_INCREASE") {
    await executePriceChange(ts, proposal);
  }
}

async function executePriceChange(ts: string, proposal: ActionProposedPayload): Promise<void> {
  const { data } = await db
    .from('product_prices')
    .select('price_cents')
    .eq('product_id', proposal.productId)
    .single();

  const current = data?.price_cents ?? 500;
  const delta = Math.abs(proposal.suggestedValueCents);
  const next = proposal.actionType === "PRICE_DECREASE"
    ? Math.max(1, current - delta)
    : current + delta;

  await appendEvent({
    id: crypto.randomUUID(),
    type: "PriceChanged",
    ts,
    aggregateType: "Product",
    aggregateId: proposal.productId,
    payload: { productId: proposal.productId, oldPriceCents: current, newPriceCents: next, actionId: proposal.actionId },
  });

  const { error: upsertError } = await db
    .from('product_prices')
    .upsert({
      product_id: proposal.productId,
      price_cents: next,
      updated_at: ts
    });

  if (upsertError) throw upsertError;

  await markPriceChangedToday({ productId: proposal.productId, ts });
  await recordActionState(proposal.actionId, proposal.productId, proposal.actionType, "EXECUTED", ts);
}