# 04. Workflow Orchestration - The Heart of the System

## The Core Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW ORCHESTRATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   External     ┌──────────┐    ┌────────────┐    ┌─────────────┐            │
│   Trigger  ──▶ │  Event   │ ──▶│ Projection │ ──▶│    Agent    │            │
│   (HTTP)       │ Ingest   │    │  Updates   │    │  Proposals  │            │
│                └──────────┘    └────────────┘    └──────┬──────┘            │
│                     │                                    │                   │
│                     ▼                                    ▼                   │
│              StockLevelChanged              ┌─────────────────────┐         │
│                                             │   POLICY GATES      │         │
│                                             │  (Sequential)       │         │
│                                             │                     │         │
│                                             │  1. Confidence      │         │
│                                             │  2. Reorder Policy  │         │
│                                             │  3. Business Rules  │         │
│                                             │  4. Coordination    │         │
│                                             └──────────┬──────────┘         │
│                                                        │                    │
│                                    ┌───────────────────┼───────────────────┐│
│                                    ▼                   ▼                   ▼│
│                              NeedsReview         Authorized          Rejected│
│                                    │                   │              Suppressed
│                                    ▼                   ▼                    │
│                              Human Decision      ┌──────────┐               │
│                                    │             │ Execute  │               │
│                                    ▼             └────┬─────┘               │
│                              Approved?               │                      │
│                                 │                    ▼                      │
│                                 └──────────▶  PriceChanged                  │
│                                               ReorderPlaced                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File: `server/core/workflow.ts`

This is the **brain** of the system - 337 lines that orchestrate everything.

## Main Entry Point: handleStockLevelChanged

```typescript
// Lines 64-106
export function handleStockLevelChanged(input: {
  productId: string;
  delta: number;
  reason: "SALE" | "DELIVERY" | "ADJUSTMENT";
  threshold?: number;
  source?: string;
}): { eventId: string; proposedActionIds: string[] } {
  const ts = nowIso();

  // Step 1: Create and append the fact event
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

  appendEvent(event);  // Fact is now permanent

  // Step 2: Update projections (derived state)
  projectStockLevelChanged(ts, event.payload);
  projectDailySales(ts, event.payload);

  // Step 3: Agent proposes actions
  const proposals = proposeActionsForProduct({
    ts,
    productId: input.productId,
    experimentId: "GROCERY_OPT_V1",
    variant: "A",
  });

  // Step 4: Each proposal goes through policy gates
  for (const proposal of proposals) {
    emitAndProcessActionProposed(ts, input.productId, proposal, event.id);
  }

  return { eventId: event.id, proposedActionIds: proposals.map((p) => p.actionId) };
}
```

**Key insight**: Each step is explicit and traceable.

## Policy Gate Processing

```typescript
// Lines 117-213
function emitAndProcessActionProposed(
  ts: string,
  productId: string,
  proposal: ActionProposedPayload,
  causationId: string
): void {
  // First: Record that a proposal was made
  const proposedEvent = { ... };
  appendEvent(proposedEvent);
  recordActionState(proposal.actionId, ..., "PROPOSED", ts);

  // Gate 1: Confidence check
  if (requiresHumanReview(proposal.confidence)) {
    appendEvent({ type: "ActionRequiresHumanReview", ... });
    recordActionState(..., "NEEDS_HUMAN_REVIEW", ts);
    return;  // Stop here, wait for human
  }

  // Gate 2: Reorder policy (all reorders need review)
  if (requiresHumanReviewForReorder(proposal.actionType)) {
    appendEvent({ type: "ActionRequiresHumanReview", ... });
    recordActionState(..., "NEEDS_HUMAN_REVIEW", ts);
    return;
  }

  // Gate 3: Business rules
  const rule = isAllowedBusinessRule({
    actionType: proposal.actionType,
    suggestedValueCents: proposal.suggestedValueCents
  });
  if (!rule.ok) {
    appendEvent({ type: "ActionRejected", reason: rule.reason, ... });
    recordActionState(..., "REJECTED", ts);
    return;
  }

  // Gate 4: Coordination (one price change per day)
  if (proposal.actionType === "PRICE_INCREASE" || proposal.actionType === "PRICE_DECREASE") {
    if (!canChangePriceToday({ productId: proposal.productId, ts })) {
      appendEvent({ type: "ActionSuppressed", ... });
      recordActionState(..., "SUPPRESSED", ts);
      return;
    }
  }

  // Passed all gates!
  appendEvent({ type: "ActionAuthorized", ... });
  recordActionState(..., "AUTHORIZED", ts);

  // Execute immediately
  executeAuthorizedAction(ts, proposal);
}
```

**Critical pattern**: Early return after each gate. Clear, sequential evaluation.

## Human Decision Flow

```typescript
// Lines 221-277
export function handleHumanDecision(
  input: HumanDecisionRecordedPayload,
): { ok: true } | { ok: false; reason: "NOT_FOUND" | "MISSING_PROPOSAL" } {
  const ts = nowIso();

  // Record the human's decision as an event (first-class citizen)
  appendEvent({
    type: "HumanDecisionRecorded",
    aggregateId: input.actionId,
    payload: input,
  });

  // Look up the action
  const action = db.prepare(`SELECT ... FROM action_state WHERE action_id = ?`)
    .get(input.actionId);

  if (!action) return { ok: false, reason: "NOT_FOUND" };

  if (input.decision === "REJECTED") {
    appendEvent({ type: "ActionRejected", reason: "HUMAN_REJECTED", ... });
    recordActionState(..., "REJECTED", ts);
    return { ok: true };
  }

  // Human approved - authorize and execute
  appendEvent({ type: "ActionAuthorized", ... });
  recordActionState(..., "AUTHORIZED", ts);

  // Find original proposal to execute
  const proposalRow = db.prepare(`SELECT payload FROM events WHERE type = 'ActionProposed'...`)
    .get(input.actionId);

  const proposal = JSON.parse(proposalRow.payload);
  executeAuthorizedAction(ts, proposal);

  return { ok: true };
}
```

## Execution Layer

```typescript
// Lines 286-302
function executeAuthorizedAction(ts: string, proposal: ActionProposedPayload): void {
  // No policies here - just side effects

  if (proposal.actionType === "REORDER") {
    appendEvent({ type: "ReorderPlaced", ... });
    recordActionState(..., "EXECUTED", ts);
    return;
  }

  if (proposal.actionType === "PRICE_DECREASE" || proposal.actionType === "PRICE_INCREASE") {
    executePriceChange(ts, proposal);
  }
}
```

**Key principle**: Execution is DUMB. No business logic, no decisions. Just do what was authorized.

## Action State Projection

```typescript
// Lines 47-53
function recordActionState(actionId, productId, actionType, status, ts): void {
  db.prepare(`
    INSERT INTO action_state (action_id, product_id, action_type, status, ts)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(action_id) DO UPDATE SET status = excluded.status, ts = excluded.ts
  `).run(actionId, productId, actionType, status, ts);
}
```

This is a **projection** - derived from events, used for queries. Could be rebuilt from event log.

## The Architectural Invariants

1. **Agents propose only** - Never mutate state directly
2. **Policies are gates** - Pure functions, return yes/no
3. **Execution is dumb** - No decisions, just side effects
4. **Everything is an event** - Including human decisions

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | Workflow = the product feature (automation + oversight) |
| **Spec Creation** | Event types + policy rules = formal spec |
| **Systems Architecture** | Clear separation of concerns |
| **Context Engineering** | Agent gets context, policies get facts |
| **Workflow Orchestration** | This IS workflow orchestration |

## Key Files

- `server/core/workflow.ts` - Main orchestration logic
- `server/policies/*.ts` - Policy gate implementations
- `server/agents/recommendationAgent.ts` - Proposal generation

## Mental Model

Think of the workflow as an **assembly line with quality control**:
- Raw material (event) enters
- Processed (projections updated, agent proposes)
- Quality checks (policy gates)
- Approved items continue to packaging (execution)
- Rejected items go to review pile (human queue)
