# UI Guide

## Overview

The UI visualizes the event-sourced grocery orchestrator system in real-time, helping you understand how events flow through the system and how the agent-human collaboration works.

## Pages

### 🏠 Dashboard (`/`)

The dashboard shows the **current state** of all products, derived entirely from events.

**Key Concepts to Observe:**
- Stock levels are **projections** rebuilt from `StockLevelChanged` events
- Color coding shows stock status (green = healthy, yellow = low, red = critical)
- Auto-refreshes every 5 seconds to show real-time changes
- The event count shows how many events created this state

**What to Learn:**
- Current state is not stored directly - it's computed from events
- Multiple events for the same product update the projection
- This demonstrates the "events as source of truth" principle

---

### 📜 Events (`/events`)

The event log viewer shows the **immutable history** of everything that happened.

**Key Concepts to Observe:**
- Events are append-only (you can't delete or modify them)
- Each event has:
  - **Type**: What kind of thing happened
  - **Aggregate**: Which entity it affects (e.g., "Product → milk")
  - **Payload**: The data (stock delta, confidence, etc.)
  - **Timestamp**: When it occurred
  - **Correlation ID**: Links related events together

**Color Coding:**
- 🔵 Blue: Stock changes
- 🟣 Purple: Agent proposals
- 🟢 Green: Authorized/executed actions
- 🔴 Red: Rejected actions
- 🟡 Yellow: Suppressed actions
- 🟠 Orange: Human review required

**What to Learn:**
- Filter by type or product to trace a workflow
- Expand payload to see the raw event data
- Watch how one stock event triggers multiple downstream events:
  1. `StockLevelChanged` (external system)
  2. `ActionProposed` (agent thinks we should reorder)
  3. `HumanReviewRequired` (policy gates it)
  4. `HumanDecisionRecorded` (you approve)
  5. `ActionAuthorized` → `ActionExecuted` (system executes)

---

### ⚡ Pending Actions (`/actions`)

This is the **human-in-the-loop** interface where you review and approve agent proposals.

**Key Concepts to Observe:**
- Actions appear here when:
  - Agent confidence < 70%
  - Business rules require review
  - Coordination policies intervene
- Each action shows:
  - **Confidence score**: How sure the agent is
  - **Reason**: Why the agent proposed this
  - **Suggested change**: What it wants to do
  - **Experiment info**: A/B test variant

**Workflows You'll See:**

1. **Low-Confidence Reorder** (confidence ~68%)
   - Stock below threshold
   - Agent proposes reorder
   - Requires human approval

2. **Price Decrease** (confidence ~74%)
   - Stock > 3× threshold (overstocked)
   - Agent suggests price reduction
   - May require approval depending on threshold

**What to Learn:**
- Click **Approve** to authorize the action → watch it execute immediately
- Click **Reject** to record the rejection → action won't execute
- After approval, go to Events to see the chain:
  - `HumanDecisionRecorded` (your click)
  - `ActionAuthorized` (workflow authorizes it)
  - `ActionExecuted` (side effect happens)
  - `PriceChanged` (if it was a price action)

---

## Real-Time Features

All pages auto-refresh:
- **Dashboard**: Every 5 seconds
- **Events**: Every 3 seconds
- **Actions**: Every 5 seconds

This lets you see the system evolve in real-time as events are processed.

---

## Learning Exercises

### Exercise 1: Trace a Complete Workflow

1. Go to **Dashboard** → note the stock level for "milk"
2. Post a stock event that drops it below threshold:
   ```bash
   curl -X POST http://localhost:3001/api/stock-level-changed \
     -H "Content-Type: application/json" \
     -d '{"productId": "milk", "delta": -5, "reason": "SALE"}'
   ```
3. Go to **Events** → find the `StockLevelChanged` event
4. Wait ~1 second → see `ActionProposed` appear (agent ran)
5. Go to **Actions** → see the reorder proposal
6. Click **Approve**
7. Go back to **Events** → trace the full chain

**What you learned:** How events trigger agents → policies → human review → execution

---

### Exercise 2: Understand Event Sourcing

1. Go to **Dashboard** → note current stock levels
2. Open terminal and run:
   ```bash
   pnpm replay
   ```
3. Watch the script rebuild projections from scratch
4. Go back to **Dashboard** → same state!

**What you learned:** State can be rebuilt entirely from events (time-travel, audit trail, debugging)

---

### Exercise 3: Policy Gates in Action

1. Create a price change for a product:
   ```bash
   curl -X POST http://localhost:3001/api/stock-level-changed \
     -H "Content-Type: application/json" \
     -d '{"productId": "test-product", "delta": 500, "reason": "DELIVERY", "threshold": 10}'
   ```
2. Stock is now 500 units, threshold is 10 → 50× overstocked
3. Go to **Actions** → agent proposed price decrease
4. Approve it
5. Try to trigger another price change the same day (post another large stock increase)
6. Go to **Events** → see `ActionSuppressed` (coordination policy blocked it)

**What you learned:** Policies enforce business rules (max 1 price change per day per product)

---

### Exercise 4: Confidence Thresholds

Edit `server/policies/confidencePolicy.ts`:
```typescript
export function requiresHumanReview(confidence: number): boolean {
  return confidence < 0.9;  // Changed from 0.7
}
```

Now most proposals will require human review! Experiment with different thresholds to see how it affects automation vs. human involvement.

---

## Quick Reference

### Add Stock
```bash
curl -X POST http://localhost:3001/api/stock-level-changed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "my-product",
    "delta": 100,
    "reason": "DELIVERY",
    "threshold": 20
  }'
```

### Simulate Sale
```bash
curl -X POST http://localhost:3001/api/stock-level-changed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "my-product",
    "delta": -15,
    "reason": "SALE"
  }'
```

### Rebuild Projections
```bash
pnpm replay
```

### Add Sample Data
```bash
./scripts/add-sample-data.sh
```

---

## What Makes This Architecture Special

1. **Events Never Change**: You have a complete audit trail forever
2. **State is Derived**: Projections can be rebuilt, modified, or versioned
3. **Time Travel**: Rebuild state at any point in history
4. **Agent + Human**: AI makes proposals, policies gate them, humans decide
5. **Testable**: Replay events to test changes without affecting production
6. **Observable**: The UI makes invisible event flows visible

Explore, experiment, and break things - you can always rebuild from events! 🚀
