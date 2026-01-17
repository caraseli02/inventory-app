# 03. Event Types - Contracts and Data Structures

## Event Envelope Pattern

Every event follows the same envelope structure:

```typescript
// server/core/types.ts (lines 3-12)
export type EventEnvelope<TType extends string, TPayload> = {
  id: string;              // Unique ID (nanoid)
  type: TType;             // Event type name
  ts: string;              // ISO timestamp
  aggregateType: string;   // "Product" or "Action"
  aggregateId: string;     // Entity this belongs to
  correlationId?: string;  // Groups related events
  causationId?: string;    // What caused this event
  payload: TPayload;       // Type-specific data
};
```

**Why this pattern?**
- Consistent metadata across all events
- Easy to query by type, aggregate, time
- Tracing via correlationId/causationId

## Core Events

### 1. StockLevelChanged

**Purpose**: Records when stock quantity changes (the triggering fact)

```typescript
// server/core/types.ts (lines 14-22)
export const StockLevelChangedPayload = z.object({
  productId: z.string(),
  delta: z.number().int(),                              // +5 for delivery, -3 for sale
  reason: z.enum(["SALE", "DELIVERY", "ADJUSTMENT"]),
  threshold: z.number().int().positive().optional(),    // Reorder threshold
  source: z.string().optional(),                        // Where this came from
});
```

**Example**:
```json
{
  "id": "evt-abc123",
  "type": "StockLevelChanged",
  "ts": "2024-01-15T10:30:00Z",
  "aggregateType": "Product",
  "aggregateId": "milk-2pct",
  "payload": {
    "productId": "milk-2pct",
    "delta": -5,
    "reason": "SALE",
    "threshold": 10
  }
}
```

### 2. ActionProposed

**Purpose**: Records an AI agent's recommendation

```typescript
// server/core/types.ts (lines 24-35)
export const ActionProposedPayload = z.object({
  actionId: z.string(),
  productId: z.string(),
  actionType: z.enum(["REORDER", "PRICE_INCREASE", "PRICE_DECREASE"]),
  suggestedValueCents: z.number().int(),  // e.g., 50 = $0.50 price change
  confidence: z.number().min(0).max(1),   // Agent's confidence (0.0 - 1.0)
  reason: z.string(),                      // Explanation for humans
  experimentId: z.string(),               // For A/B testing
  variant: z.string(),                    // Which variant
});
```

**Example**:
```json
{
  "type": "ActionProposed",
  "aggregateType": "Action",
  "aggregateId": "act-xyz789",
  "correlationId": "product:milk-2pct",
  "causationId": "evt-abc123",
  "payload": {
    "actionId": "act-xyz789",
    "productId": "milk-2pct",
    "actionType": "PRICE_DECREASE",
    "suggestedValueCents": 50,
    "confidence": 0.85,
    "reason": "Stock low (5 units), below threshold (10). Suggest price decrease to slow sales.",
    "experimentId": "GROCERY_OPT_V1",
    "variant": "A"
  }
}
```

**Key insight**: Agent provides `confidence` and `reason` - policies use confidence, humans use reason.

### 3. HumanDecisionRecorded

**Purpose**: Records a human's approval/rejection of an action

```typescript
// server/core/types.ts (lines 37-43)
export const HumanDecisionRecordedPayload = z.object({
  actionId: z.string(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewerId: z.string(),  // Who made the decision (audit trail)
});
```

**Example**:
```json
{
  "type": "HumanDecisionRecorded",
  "aggregateType": "Action",
  "aggregateId": "act-xyz789",
  "payload": {
    "actionId": "act-xyz789",
    "decision": "APPROVED",
    "reviewerId": "user-john"
  }
}
```

## Workflow Events (Defined in workflow.ts)

### 4. ActionRequiresHumanReview

```typescript
payload: { actionId: string, reason: "LOW_CONFIDENCE" | "REORDER_REQUIRES_APPROVAL" }
```

### 5. ActionAuthorized

```typescript
payload: { actionId: string }
```

### 6. ActionRejected

```typescript
payload: { actionId: string, reason: string }
// Reasons: "EXCEEDS_MAX_DELTA", "HUMAN_REJECTED", etc.
```

### 7. ActionSuppressed

```typescript
payload: { actionId: string, reason: "PRICE_ALREADY_CHANGED_TODAY" }
```

### 8. ReorderPlaced

```typescript
payload: { productId: string, actionId: string, notes: string }
```

### 9. PriceChanged

```typescript
payload: {
  productId: string,
  oldPriceCents: number,
  newPriceCents: number,
  actionId: string
}
```

## Event Flow Diagram

```
External Trigger (POS, Inventory System)
            ↓
    StockLevelChanged
            ↓
    ActionProposed (Agent)
            ↓
    ┌───────┴───────┐
    ↓               ↓
Low Confidence   High Confidence
    ↓               ↓
ActionRequires   Business Rule
HumanReview      Check
    ↓               ↓
HumanDecision    ┌──┴──┐
Recorded         ↓     ↓
    ↓          Pass   Fail
    ↓           ↓      ↓
    ↓     Coord.   ActionRejected
    ↓     Check
    ↓       ↓
    └───────┼───────┐
            ↓       ↓
         Pass    ActionSuppressed
            ↓
    ActionAuthorized
            ↓
    ┌───────┴───────┐
    ↓               ↓
ReorderPlaced   PriceChanged
```

## Validation with Zod

Events use Zod schemas for runtime validation:

```typescript
// When receiving external input
const validated = StockLevelChangedPayload.parse(body);
// Throws if invalid, returns typed object if valid
```

**Benefits**:
- Runtime type safety
- Clear error messages
- TypeScript types inferred

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | Events = product features (tracking, auditing) |
| **Spec Creation** | Zod schemas = formal contracts |
| **Systems Architecture** | Events decouple producers from consumers |
| **Context Engineering** | Payload contains decision-relevant context |
| **Workflow Orchestration** | Event types drive state machine transitions |

## Key Files

- `server/core/types.ts` - Type definitions and Zod schemas
- `server/core/workflow.ts` - Event emission logic

## Mental Model

Events are like **legal documents**:
- Clear, precise language (type + payload)
- Cannot be changed after signing (immutable)
- Form a chain of causation (causationId)
- Grouped by case (correlationId)
