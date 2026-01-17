# 05. Policy Gates - Decision Points and Rules

## What Are Policy Gates?

Policy gates are **checkpoints** that every action proposal must pass through. They are:
- **Sequential** - evaluated in order, early exit on failure
- **Pure functions** - no side effects, deterministic
- **Single-purpose** - one policy = one invariant
- **Auditable** - each decision is recorded as an event

```
            ┌────────────────────────────────────────────────────────┐
            │                    POLICY GATES                         │
            │                                                         │
ActionProposed ─▶ [Confidence] ─▶ [Reorder] ─▶ [Business] ─▶ [Coord] ─▶ Authorized
            │         │              │             │            │       │
            │         ▼              ▼             ▼            ▼       │
            │    NeedsReview    NeedsReview    Rejected    Suppressed   │
            └────────────────────────────────────────────────────────────┘
```

## Gate #1: Confidence Policy

**File**: `server/policies/confidencePolicy.ts`

**Purpose**: Route uncertain AI recommendations to human review.

```typescript
const AUTO_APPROVE_THRESHOLD = 0.7;

export function requiresHumanReview(confidence: number): boolean {
  return confidence < AUTO_APPROVE_THRESHOLD;
}
```

**Logic**:
- Confidence < 0.7 → needs human review
- Confidence >= 0.7 → can proceed (other gates may still block)

**Example**:
```typescript
// Agent proposes with confidence 0.65
requiresHumanReview(0.65)  // true → ActionRequiresHumanReview

// Agent proposes with confidence 0.85
requiresHumanReview(0.85)  // false → proceed to next gate
```

**Why separate?**
- Easy to adjust threshold without touching workflow
- Clear audit trail (threshold is explicit)
- Easy to A/B test different thresholds

## Gate #2: Reorder Policy

**File**: `server/policies/reorderPolicy.ts`

**Purpose**: Control when inventory orders need human approval.

```typescript
export function requiresHumanReviewForReorder(actionType: string): boolean {
  if (actionType === "REORDER") {
    return true;  // ALL reorders need human review
  }
  return false;
}
```

**Logic**: ALL reorders require human approval, regardless of confidence.

**Reasoning**:
- Inventory orders cost real money
- AI might miss context (holidays, promotions, supply issues)
- Humans catch edge cases

**Future enhancements** (documented in file):
```typescript
// Could be enhanced to:
// - Auto-approve orders under $100
// - Auto-approve for certain product categories
// - Different rules during business hours
```

## Gate #3: Business Rules Policy

**File**: `server/policies/businessRulesPolicy.ts`

**Purpose**: Enforce hard constraints that must ALWAYS hold.

```typescript
type BusinessRuleResult = { ok: true } | { ok: false; reason: string };

export function isAllowedBusinessRule(input: {
  actionType: "REORDER" | "PRICE_INCREASE" | "PRICE_DECREASE";
  suggestedValueCents: number;
}): BusinessRuleResult {
  // Reorders pass this gate (handled by reorder policy)
  if (input.actionType === "REORDER") {
    return { ok: true };
  }

  const delta = Math.abs(input.suggestedValueCents);

  // Invalid delta (non-numeric or <= 0)
  if (!Number.isFinite(delta) || delta < 1) {
    return { ok: false, reason: "INVALID_PRICE_DELTA" };
  }

  // Delta too large (> $5.00 change)
  if (delta > 500) {
    return { ok: false, reason: "PRICE_DELTA_TOO_LARGE" };
  }

  return { ok: true };
}
```

**Rules**:
1. Reorders always pass (business rules don't constrain them)
2. Price delta must be valid number > 0
3. Price delta must be ≤ 500 cents ($5.00)

**Example**:
```typescript
// Valid price decrease
isAllowedBusinessRule({ actionType: "PRICE_DECREASE", suggestedValueCents: 50 })
// { ok: true }

// Too large price change
isAllowedBusinessRule({ actionType: "PRICE_INCREASE", suggestedValueCents: 600 })
// { ok: false, reason: "PRICE_DELTA_TOO_LARGE" }

// Invalid delta
isAllowedBusinessRule({ actionType: "PRICE_DECREASE", suggestedValueCents: 0 })
// { ok: false, reason: "INVALID_PRICE_DELTA" }
```

## Gate #4: Coordination Policy

**File**: `server/policies/coordinationPolicy.ts`

**Purpose**: Prevent conflicting actions that cause operational churn.

```typescript
// Check if price change is allowed today
export function canChangePriceToday(input: { productId: string; ts: string }): boolean {
  const day = dayKey(input.ts);  // Extract YYYY-MM-DD
  const row = db.prepare(`
    SELECT 1 FROM daily_price_changes
    WHERE product_id = ? AND day = ? LIMIT 1
  `).get(input.productId, day);
  return !row;  // true if no record exists
}

// Record that price changed today
export function markPriceChangedToday(input: { productId: string; ts: string }): void {
  const day = dayKey(input.ts);
  db.prepare(`
    INSERT INTO daily_price_changes (product_id, day)
    VALUES (?, ?)
    ON CONFLICT(product_id, day) DO NOTHING
  `).run(input.productId, day);
}
```

**Rule**: Only ONE price change per product per calendar day.

**Why?**
- Prevents price thrashing (up-down-up-down)
- Customers expect stable prices
- Reduces confusion for staff

**Example**:
```typescript
// 10:00 AM - First price change
canChangePriceToday({ productId: "milk", ts: "2024-01-15T10:00:00Z" })  // true
// Price changes, markPriceChangedToday() called

// 3:00 PM - Second attempt same day
canChangePriceToday({ productId: "milk", ts: "2024-01-15T15:00:00Z" })  // false
// ActionSuppressed event emitted

// Next day - Allowed again
canChangePriceToday({ productId: "milk", ts: "2024-01-16T10:00:00Z" })  // true
```

## How Gates Work Together in Workflow

From `server/core/workflow.ts`:

```typescript
function emitAndProcessActionProposed(ts, productId, proposal, causationId) {
  // Record proposal
  appendEvent({ type: "ActionProposed", ... });

  // Gate 1: Confidence
  if (requiresHumanReview(proposal.confidence)) {
    appendEvent({ type: "ActionRequiresHumanReview", reason: "LOW_CONFIDENCE" });
    return;  // STOP HERE
  }

  // Gate 2: Reorder Policy
  if (requiresHumanReviewForReorder(proposal.actionType)) {
    appendEvent({ type: "ActionRequiresHumanReview", reason: "REORDER_REQUIRES_APPROVAL" });
    return;  // STOP HERE
  }

  // Gate 3: Business Rules
  const rule = isAllowedBusinessRule({ ... });
  if (!rule.ok) {
    appendEvent({ type: "ActionRejected", reason: rule.reason });
    return;  // STOP HERE
  }

  // Gate 4: Coordination (only for price changes)
  if (proposal.actionType === "PRICE_INCREASE" || proposal.actionType === "PRICE_DECREASE") {
    if (!canChangePriceToday({ productId, ts })) {
      appendEvent({ type: "ActionSuppressed", reason: "PRICE_ALREADY_CHANGED_TODAY" });
      return;  // STOP HERE
    }
  }

  // PASSED ALL GATES
  appendEvent({ type: "ActionAuthorized", ... });
  executeAuthorizedAction(ts, proposal);
}
```

## Event Outcomes by Gate

| Gate | Pass | Fail Event | Fail Reason |
|------|------|------------|-------------|
| Confidence | Continue | `ActionRequiresHumanReview` | `LOW_CONFIDENCE` |
| Reorder | Continue | `ActionRequiresHumanReview` | `REORDER_REQUIRES_APPROVAL` |
| Business Rules | Continue | `ActionRejected` | `INVALID_PRICE_DELTA`, `PRICE_DELTA_TOO_LARGE` |
| Coordination | Continue | `ActionSuppressed` | `PRICE_ALREADY_CHANGED_TODAY` |
| All Gates | `ActionAuthorized` | — | — |

## Testing Policy Gates

Policies are pure functions → easy to test:

```typescript
// tests/policies.test.ts

describe("confidencePolicy", () => {
  it("should require review for low confidence", () => {
    expect(requiresHumanReview(0.5)).toBe(true);
    expect(requiresHumanReview(0.69)).toBe(true);
  });

  it("should auto-approve high confidence", () => {
    expect(requiresHumanReview(0.7)).toBe(false);
    expect(requiresHumanReview(0.95)).toBe(false);
  });

  it("should handle boundary exactly", () => {
    expect(requiresHumanReview(0.7)).toBe(false);  // threshold
    expect(requiresHumanReview(0.6999)).toBe(true);
  });
});
```

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | Policies = product rules (pricing limits, approval flows) |
| **Spec Creation** | Each policy has clear input/output contract |
| **Systems Architecture** | Policies are isolated modules, easy to swap/test |
| **Context Engineering** | Policies receive minimal context needed for decision |
| **Workflow Orchestration** | Policies ARE the control flow decision points |

## Key Files

- `server/policies/confidencePolicy.ts` - Gate #1
- `server/policies/reorderPolicy.ts` - Gate #2
- `server/policies/businessRulesPolicy.ts` - Gate #3
- `server/policies/coordinationPolicy.ts` - Gate #4
- `tests/policies.test.ts` - All policy tests

## Mental Model

Think of policies as **security checkpoints at an airport**:
- Each checkpoint has ONE job (ID, bags, metal detector)
- Fail any checkpoint → stopped
- Pass all checkpoints → board plane
- Each decision is recorded (audit)
- Rules are posted (transparent)
