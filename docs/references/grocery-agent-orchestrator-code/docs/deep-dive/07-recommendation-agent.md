# 07. Recommendation Agent - AI Proposal Generation

## The Agent's Role

The recommendation agent is the "AI brain" of the system, but with a strict constraint:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT CONTRACT                                │
│                                                                  │
│  ✅ CAN: Read context (projections, events)                     │
│  ✅ CAN: Generate proposals with confidence + reasoning          │
│  ✅ CAN: Include experiment metadata for A/B testing            │
│                                                                  │
│  ❌ CANNOT: Write to database                                    │
│  ❌ CANNOT: Enforce business rules                               │
│  ❌ CANNOT: Execute actions                                      │
│  ❌ CANNOT: Bypass policy gates                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Philosophy**: "Agents suggest. Policies decide. Execution runs."

## File: `server/agents/recommendationAgent.ts`

## Context Gathering

The agent needs information to make recommendations. It reads from projections (fast, derived state):

### Read Current Stock

```typescript
function readCurrentStock(productId: string): number {
  const row = db.prepare(`
    SELECT quantity FROM stock_levels WHERE product_id = ?
  `).get(productId);
  return row?.quantity ?? 0;
}
```

### Read Reorder Threshold

```typescript
function readReorderThreshold(productId: string): number {
  // Read from the most recent StockLevelChanged event
  const row = db.prepare(`
    SELECT payload FROM events
    WHERE type = 'StockLevelChanged' AND aggregate_id = ?
    ORDER BY ts DESC LIMIT 1
  `).get(productId);

  if (!row) return DEFAULT_REORDER_THRESHOLD;  // 10

  const payload = JSON.parse(row.payload);
  return payload.threshold ?? DEFAULT_REORDER_THRESHOLD;
}
```

**Why read from events?** The threshold is part of the event payload (the fact), not just projection state.

### Read Current Price

```typescript
function readCurrentPriceCents(productId: string): number {
  const row = db.prepare(`
    SELECT price_cents FROM product_prices WHERE product_id = ?
  `).get(productId);
  return row?.price_cents ?? 500;  // Default $5.00
}
```

## The Main Function: proposeActionsForProduct

```typescript
export function proposeActionsForProduct(input: {
  ts: string;           // Current timestamp
  productId: string;    // Which product
  experimentId: string; // For A/B testing
  variant: string;      // Which variant
}): ActionProposedPayload[] {

  // Gather context
  const currentStock = readCurrentStock(input.productId);
  const threshold = readReorderThreshold(input.productId);

  const proposals: ActionProposedPayload[] = [];

  // Decision logic...
  return proposals;
}
```

## Decision Logic

### Scenario 1: Low Stock → Propose REORDER

```typescript
if (currentStock <= threshold) {
  const isCritical = currentStock <= threshold * 0.5;

  proposals.push({
    actionId: nanoid(),
    productId: input.productId,
    actionType: "REORDER",
    suggestedValueCents: 0,  // Not applicable for reorders
    confidence: isCritical ? 0.92 : 0.68,
    reason: isCritical
      ? `Stock critically low (${currentStock}/${threshold}). Recommend reorder now.`
      : `Stock below threshold (${currentStock}/${threshold}). Consider reorder.`,
    experimentId: input.experimentId,
    variant: input.variant,
  });

  return proposals;  // Don't propose anything else
}
```

**Confidence levels**:
- Critical (stock ≤ 50% of threshold): 0.92 (high confidence)
- Low but not critical: 0.68 (will likely need human review)

### Scenario 2: Overstocked → Propose PRICE_DECREASE

```typescript
if (currentStock >= threshold * 3) {
  const currentPriceCents = readCurrentPriceCents(input.productId);

  // 10% decrease, capped between 25 and 200 cents
  const deltaCents = Math.min(200, Math.max(25, Math.round(currentPriceCents * 0.1)));

  proposals.push({
    actionId: nanoid(),
    productId: input.productId,
    actionType: "PRICE_DECREASE",
    suggestedValueCents: deltaCents,
    confidence: 0.74,  // Above auto-approve threshold
    reason: `Overstocked (${currentStock} units vs threshold ${threshold}). Suggest price decrease by ${deltaCents} cents.`,
    experimentId: input.experimentId,
    variant: input.variant,
  });
}
```

**Price calculation**: 10% of current price, bounded to $0.25 - $2.00 range.

### Scenario 3: Normal Stock → No Proposals

```typescript
// Stock is between threshold and threshold*3
return [];  // Nothing to propose
```

## The ActionProposedPayload

```typescript
{
  actionId: string;            // Unique ID for this proposal
  productId: string;           // Which product
  actionType: "REORDER" | "PRICE_INCREASE" | "PRICE_DECREASE";
  suggestedValueCents: number; // Price delta (for price actions)
  confidence: number;          // 0.0 to 1.0
  reason: string;              // Human-readable explanation
  experimentId: string;        // For A/B testing
  variant: string;             // Which experiment variant
}
```

## Confidence Scores

The agent outputs confidence to help policies and humans:

| Confidence | Meaning | Likely Outcome |
|------------|---------|----------------|
| < 0.7 | Low confidence | Human review required |
| 0.7 - 0.8 | Medium confidence | Auto-approved (if passes other gates) |
| > 0.8 | High confidence | Auto-approved (if passes other gates) |

**Current implementation**:
- Critical reorder: 0.92
- Non-critical reorder: 0.68 (needs review)
- Price decrease: 0.74 (auto-approve possible)

## Experiment Metadata

Every proposal includes:
```typescript
experimentId: "GROCERY_OPT_V1",
variant: "A"
```

**Why?**
- Compare outcomes across variants
- No schema changes needed for experiments
- Analytics can segment by experiment

## How Agent Integrates with Workflow

From `server/core/workflow.ts`:

```typescript
export function handleStockLevelChanged(input) {
  // ... append event, update projections ...

  // Step 3: Ask agent for proposals
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

  return { eventId: event.id, proposedActionIds: proposals.map(p => p.actionId) };
}
```

## Example Trace

```
Input: Stock dropped from 10 to 3 (threshold: 10)

Agent gathers context:
  - currentStock: 3
  - threshold: 10
  - isCritical: true (3 <= 5)

Agent proposes:
  {
    actionId: "act-xyz789",
    productId: "milk",
    actionType: "REORDER",
    confidence: 0.92,
    reason: "Stock critically low (3/10). Recommend reorder now."
  }

Workflow emits:
  - ActionProposed event
  - Passes confidence gate (0.92 >= 0.7)
  - Hits reorder gate → ActionRequiresHumanReview (all reorders need review)
```

## Design Principles

### 1. No Side Effects

The agent is a pure function of context → proposals. It doesn't change anything.

### 2. Explainable Reasoning

The `reason` field explains WHY the agent made this recommendation:
```
"Stock critically low (3/10). Recommend reorder now."
```

Humans can read this and decide.

### 3. Bounded Actions

The agent only proposes within safe bounds:
- Price deltas capped at $2.00
- Only REORDER, PRICE_INCREASE, PRICE_DECREASE (no arbitrary actions)

### 4. Context Engineering

The agent gets exactly what it needs:
- Current stock (from projection)
- Threshold (from events)
- Current price (from projection)

No more, no less.

## Future Enhancements

The agent could be enhanced with:
- Historical velocity (from analytics projections)
- Seasonal patterns
- Competitor pricing
- Weather data (for perishables)

But the CONTRACT stays the same: propose only, never execute.

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | Agent = the automation feature |
| **Spec Creation** | ActionProposedPayload is the contract |
| **Systems Architecture** | Agent is isolated, testable, swappable |
| **Context Engineering** | Agent receives curated context |
| **Workflow Orchestration** | Agent plugs into workflow, never owns it |

## Key Files

- `server/agents/recommendationAgent.ts` - This file
- `server/core/workflow.ts` - Where agent is called
- `server/core/types.ts` - ActionProposedPayload definition

## Mental Model

The agent is like a **consultant**:
- Reviews the data (context)
- Makes recommendations (proposals)
- Provides reasoning (explanations)
- Has no authority to act (can't execute)
- Client (workflow/policies) decides what to do
