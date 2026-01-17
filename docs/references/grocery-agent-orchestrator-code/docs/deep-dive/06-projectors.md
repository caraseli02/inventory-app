# 06. Projectors - Derived State from Events

## What Are Projectors?

Projectors transform the immutable event log into queryable state:

```
Events (Source of Truth)          Projections (Derived State)
┌─────────────────────────┐       ┌─────────────────────────┐
│ StockLevelChanged       │       │ stock_levels            │
│   delta: -5             │  ───▶ │   milk: 45 units        │
│   delta: +20            │       │   bread: 100 units      │
│   delta: -3             │       └─────────────────────────┘
└─────────────────────────┘

Why?
- Events: Complete history, immutable
- Projections: Current state, fast queries
```

## Key Properties

| Property | Meaning |
|----------|---------|
| **Derived** | Computed from events, not stored independently |
| **Rebuildable** | Delete → replay events → same state |
| **Disposable** | Can be deleted without data loss |
| **Optimized** | Fast reads for common queries |

## Stock Projection

**File**: `server/projectors/stockProjection.ts`

**Purpose**: Maintain current stock level per product.

### The Core Function

```typescript
export function projectStockLevelChanged(
  ts: string,
  payload: StockLevelChangedPayload
): number {
  // Get current projected quantity
  const existing = db.prepare(`
    SELECT quantity FROM stock_levels WHERE product_id = ?
  `).get(payload.productId);

  const current = existing?.quantity ?? 0;

  // Apply delta (clamped to >= 0)
  const next = Math.max(0, current + payload.delta);

  // Upsert projection
  db.prepare(`
    INSERT INTO stock_levels (product_id, quantity, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET
      quantity = excluded.quantity,
      updated_at = excluded.updated_at
  `).run(payload.productId, next, ts);

  return next;
}
```

**Important**: Stock is clamped to ≥ 0 in the projection, but events store raw deltas.

### The Rebuild Function

```typescript
export function rebuildStockLevels(): void {
  // 1. Delete all projection rows (NOT events!)
  db.prepare(`DELETE FROM stock_levels`).run();

  // 2. Replay events in order
  const rows = db.prepare(`
    SELECT payload, ts FROM events
    WHERE type = 'StockLevelChanged'
    ORDER BY ts ASC
  `).all();

  // 3. Apply each event to rebuild state
  for (const row of rows) {
    const payload = JSON.parse(row.payload);
    projectStockLevelChanged(row.ts, payload);
  }
}
```

**This is the proof**: Same events → same state.

### Query Convenience

```typescript
export function getCurrentStockLevel(productId: string): number {
  const row = db.prepare(`
    SELECT quantity FROM stock_levels WHERE product_id = ?
  `).get(productId);
  return row?.quantity ?? 0;
}
```

## Sales Projection

**File**: `server/projectors/salesProjection.ts`

**Purpose**: Daily aggregation of sales and deliveries.

### The Core Function

```typescript
export function projectDailySales(
  ts: string,
  payload: StockLevelChangedPayload
): void {
  const day = ts.slice(0, 10);  // YYYY-MM-DD
  const { productId, delta, reason } = payload;

  // Get current values
  const existing = db.prepare(`
    SELECT total_sold, total_delivered, transaction_count
    FROM daily_sales WHERE product_id = ? AND day = ?
  `).get(productId, day);

  let newSold = existing?.total_sold ?? 0;
  let newDelivered = existing?.total_delivered ?? 0;
  const currentCount = existing?.transaction_count ?? 0;

  // Categorize based on reason
  if (reason === "SALE" && delta < 0) {
    newSold += Math.abs(delta);  // Store as positive
  } else if (reason === "DELIVERY" && delta > 0) {
    newDelivered += delta;
  }
  // ADJUSTMENT events don't count

  // Upsert
  db.prepare(`
    INSERT INTO daily_sales (...) VALUES (...)
    ON CONFLICT(product_id, day) DO UPDATE SET ...
  `).run(productId, day, newSold, newDelivered, currentCount + 1);
}
```

### Query Functions

```typescript
// Get all sales for a specific day
export function getDailySales(day: string): Array<{
  productId: string;
  totalSold: number;
  totalDelivered: number;
  transactionCount: number;
}>

// Get history for a specific product
export function getProductSalesHistory(productId: string): Array<{
  day: string;
  totalSold: number;
  ...
}>
```

## action_state Projection

**Location**: `server/core/workflow.ts` (inline)

**Purpose**: Track current status of each action in the workflow.

```typescript
function recordActionState(
  actionId: string,
  productId: string,
  actionType: string,
  status: string,
  ts: string
): void {
  db.prepare(`
    INSERT INTO action_state (action_id, product_id, action_type, status, ts)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(action_id) DO UPDATE SET
      status = excluded.status,
      ts = excluded.ts
  `).run(actionId, productId, actionType, status, ts);
}
```

**Status values**: `PROPOSED`, `NEEDS_HUMAN_REVIEW`, `AUTHORIZED`, `REJECTED`, `SUPPRESSED`, `EXECUTED`

## daily_price_changes Projection

**Location**: `server/policies/coordinationPolicy.ts`

**Purpose**: Track which products had price changes today (for coordination).

```typescript
// Record a price change
export function markPriceChangedToday(input: { productId: string; ts: string }): void {
  const day = input.ts.slice(0, 10);
  db.prepare(`
    INSERT INTO daily_price_changes (product_id, day)
    VALUES (?, ?)
    ON CONFLICT DO NOTHING
  `).run(input.productId, day);
}

// Check if allowed
export function canChangePriceToday(input: { productId: string; ts: string }): boolean {
  const day = input.ts.slice(0, 10);
  const row = db.prepare(`
    SELECT 1 FROM daily_price_changes
    WHERE product_id = ? AND day = ?
  `).get(input.productId, day);
  return !row;  // true if no record
}
```

## The Rebuild Script

**File**: `scripts/replay.mjs`

```javascript
// Delete all projections
db.prepare("DELETE FROM stock_levels").run();
db.prepare("DELETE FROM product_prices").run();
db.prepare("DELETE FROM action_state").run();
db.prepare("DELETE FROM daily_price_changes").run();
db.prepare("DELETE FROM daily_sales").run();

// Replay events
const events = db.prepare("SELECT * FROM events ORDER BY ts ASC").all();
for (const event of events) {
  // Apply each event to rebuild projections
}
```

**Usage**:
```bash
pnpm replay           # Rebuild default database
pnpm replay -- --db ./test.db  # Rebuild specific database
```

## Projection Design Principles

### 1. One Projection, One Purpose

```
stock_levels      → Current stock (for agents)
daily_sales       → Analytics (for dashboards)
action_state      → Workflow status (for humans)
daily_price_changes → Coordination (for policies)
```

### 2. Events Own the Logic

The projection logic is just "apply this delta":
```typescript
const next = Math.max(0, current + payload.delta);
```

The business logic (why the delta happened) is in the event:
```json
{ "delta": -5, "reason": "SALE", "productId": "milk" }
```

### 3. Never Store Non-Recoverable Data

If data can't be rebuilt from events, it shouldn't be in a projection.

❌ Bad: Storing "notes" field only in projection
✅ Good: "notes" stored in event payload

## When Projections Go Wrong

If a projection is corrupted or has bugs:

1. **Fix the projector logic** (if needed)
2. **Rebuild**: `pnpm replay`
3. **Verify**: Same events → same state

This is why event sourcing is powerful for debugging.

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | Projections enable features (dashboards, queries) |
| **Spec Creation** | Projection schema = query contract |
| **Systems Architecture** | Clean separation: events vs views |
| **Context Engineering** | Fast context access for agents/policies |
| **Workflow Orchestration** | action_state tracks workflow progress |

## Key Files

- `server/projectors/stockProjection.ts` - Stock levels
- `server/projectors/salesProjection.ts` - Daily sales
- `server/core/workflow.ts` - action_state (inline)
- `server/policies/coordinationPolicy.ts` - daily_price_changes
- `scripts/replay.mjs` - Rebuild script

## Mental Model

Projections are like **spreadsheet views**:
- Raw data = events (rows of transactions)
- View = projection (pivot table, sum, current balance)
- Change view formula → rebuild view
- Raw data never changes
