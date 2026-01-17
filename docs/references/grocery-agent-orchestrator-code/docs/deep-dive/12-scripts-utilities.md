# 12. Scripts and Utilities - Replay and Helper Tools

## The Replay Script

**File**: `scripts/replay.mjs`

**Purpose**: Rebuild ALL projections from the immutable event log.

```bash
# Default usage
pnpm replay

# Specify database
pnpm replay -- --db /path/to/grocery.db

# Help
pnpm replay -- --help
```

## Why Replay Exists

In event sourcing, the replay script proves a critical property:

```
DELETE all projections + REPLAY all events = SAME STATE
```

This guarantees:
- Projections are truly derived
- No hidden state outside events
- Recovery from corruption
- Schema migration capability

## Script Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      replay.mjs                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Parse arguments (--db path)                              │
│                     ↓                                        │
│  2. Open database                                            │
│                     ↓                                        │
│  3. Ensure schema exists                                     │
│                     ↓                                        │
│  4. BEGIN TRANSACTION                                        │
│                     ↓                                        │
│  5. DELETE all projections                                   │
│      - stock_levels                                          │
│      - product_prices                                        │
│      - action_state                                          │
│      - daily_price_changes                                   │
│      - daily_sales                                           │
│      - product_velocity                                      │
│      - stock_health                                          │
│      - agent_performance                                     │
│      - decision_latency                                      │
│                     ↓                                        │
│  6. Rebuild main projections                                 │
│      - rebuildStockLevels()                                  │
│      - rebuildPrices()                                       │
│      - rebuildActionState()                                  │
│      - rebuildDailySales()                                   │
│                     ↓                                        │
│  7. Rebuild analytics projections                            │
│      - rebuildAnalytics()                                    │
│                     ↓                                        │
│  8. COMMIT TRANSACTION                                       │
│                     ↓                                        │
│  9. Output JSON summary                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Rebuild Functions

### rebuildStockLevels

```javascript
function rebuildStockLevels(db) {
  // 1. Get all StockLevelChanged events in chronological order
  const rows = db.prepare(`
    SELECT ts, payload FROM events
    WHERE type = 'StockLevelChanged'
    ORDER BY ts ASC
  `).all();

  // 2. Build state in memory
  const levels = new Map();
  for (const row of rows) {
    const payload = JSON.parse(row.payload);
    const prev = levels.get(payload.productId)?.quantity ?? 0;
    const next = Math.max(0, prev + payload.delta);
    levels.set(payload.productId, { quantity: next, updatedAt: row.ts });
  }

  // 3. Write to projection table
  for (const [productId, state] of levels) {
    db.prepare(`INSERT INTO stock_levels ...`).run(productId, state.quantity, ...);
  }

  return { eventCount: rows.length, productCount: levels.size };
}
```

### rebuildPrices

```javascript
function rebuildPrices(db) {
  // Read PriceChanged events
  const rows = db.prepare(`
    SELECT ts, payload FROM events
    WHERE type = 'PriceChanged'
    ORDER BY ts ASC
  `).all();

  const prices = new Map();
  const daily = new Set();  // Track daily changes

  for (const row of rows) {
    const payload = JSON.parse(row.payload);
    prices.set(payload.productId, {
      priceCents: payload.newPriceCents,
      updatedAt: row.ts
    });
    daily.add(`${payload.productId}:${dayKey(row.ts)}`);
  }

  // Write product_prices
  // Write daily_price_changes

  return { eventCount, productCount, dayEntries };
}
```

### rebuildActionState

```javascript
function rebuildActionState(db) {
  const rows = db.prepare(`
    SELECT type, ts, aggregate_id, payload
    FROM events
    WHERE type IN (
      'ActionProposed',
      'ActionRequiresHumanReview',
      'ActionAuthorized',
      'ActionRejected',
      'ActionSuppressed',
      'ReorderPlaced',
      'PriceChanged'
    )
    ORDER BY ts ASC
  `).all();

  const actions = new Map();

  for (const row of rows) {
    if (row.type === "ActionProposed") {
      actions.set(payload.actionId, {
        productId: ...,
        actionType: ...,
        status: "PROPOSED",
        ts: row.ts
      });
    }
    else if (row.type === "ActionRequiresHumanReview") {
      updateStatus(payload.actionId, "NEEDS_HUMAN_REVIEW", row.ts);
    }
    else if (row.type === "ActionAuthorized") {
      updateStatus(payload.actionId, "AUTHORIZED", row.ts);
    }
    // ... other transitions
  }

  // Write to action_state
  return { eventCount, actionCount };
}
```

### rebuildDailySales

```javascript
function rebuildDailySales(db) {
  const rows = db.prepare(`
    SELECT ts, payload FROM events
    WHERE type = 'StockLevelChanged'
    ORDER BY ts ASC
  `).all();

  const sales = new Map();  // key: "productId:day"

  for (const row of rows) {
    const payload = JSON.parse(row.payload);
    const day = row.ts.slice(0, 10);  // YYYY-MM-DD
    const key = `${payload.productId}:${day}`;

    const current = sales.get(key) ?? { totalSold: 0, totalDelivered: 0, count: 0 };

    if (payload.reason === "SALE" && payload.delta < 0) {
      current.totalSold += Math.abs(payload.delta);
    } else if (payload.reason === "DELIVERY" && payload.delta > 0) {
      current.totalDelivered += payload.delta;
    }
    current.count++;

    sales.set(key, current);
  }

  // Write to daily_sales
  return { eventCount, dayProductCount };
}
```

### rebuildAnalytics

```javascript
function rebuildAnalytics(db) {
  // 1. Product velocity (from StockLevelChanged)
  // 2. Decision latency (from ActionProposed + HumanDecisionRecorded)
  // 3. Stock health (from stock_levels + product_velocity)
  // 4. Agent performance (from decision_latency)

  return {
    velocityRecords: ...,
    latencyRecords: ...,
    healthRecords: ...,
    performanceBuckets: ...
  };
}
```

## Transaction Safety

```javascript
const results = db.transaction(() => {
  // Delete all projections
  db.exec(`DELETE FROM stock_levels; DELETE FROM ...`);

  // Rebuild all projections
  const stock = rebuildStockLevels(db);
  // ...

  return results;
})();
```

**Why transaction?** If anything fails, the database rolls back to its previous state.

## Output Format

```json
{
  "ok": true,
  "db": "/path/to/grocery.db",
  "stock": {
    "eventCount": 1234,
    "productCount": 50
  },
  "prices": {
    "eventCount": 100,
    "productCount": 45,
    "dayEntries": 200
  },
  "actions": {
    "eventCount": 500,
    "actionCount": 250
  },
  "sales": {
    "eventCount": 1234,
    "dayProductCount": 150
  },
  "analytics": {
    "velocityRecords": 100,
    "latencyRecords": 50,
    "healthRecords": 50,
    "performanceBuckets": 5
  }
}
```

## When to Use Replay

### 1. Schema Migration

```bash
# After changing projection logic
# 1. Update code
# 2. Run replay
pnpm replay
```

### 2. Corruption Recovery

```bash
# If projection seems wrong
pnpm replay
# State rebuilt from immutable events
```

### 3. Debugging

```bash
# Compare projection to expected
pnpm replay
# Check if results match expectations
```

### 4. New Consumer

```bash
# Added new projection table
# 1. Add table schema to db.ts
# 2. Add rebuild function to replay.mjs
# 3. Run replay
pnpm replay
```

## API Rebuild Endpoints

For on-demand rebuilds:

```bash
# Rebuild sales projections
curl -X POST http://localhost:3000/api/sales/rebuild

# Rebuild analytics projections
curl -X POST http://localhost:3000/api/analytics/rebuild
```

## Helper Functions

### dayKey

```javascript
function dayKey(ts) {
  return String(ts).slice(0, 10);  // "2025-01-15T10:30:00Z" → "2025-01-15"
}
```

### safeJsonParse

```javascript
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;  // Graceful failure
  }
}
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `GROCERY_DB_PATH` | Database file location | `grocery.db` |

```bash
# Use environment variable
GROCERY_DB_PATH=/data/prod.db pnpm replay

# Or command line argument
pnpm replay -- --db /data/prod.db
```

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | Replay enables safe schema changes |
| **Spec Creation** | Replay validates event → projection mapping |
| **Systems Architecture** | Replay proves projections are derived |
| **Context Engineering** | Rebuilt projections = fresh context |
| **Workflow Orchestration** | Replay resets workflow state correctly |

## Key Files

- `scripts/replay.mjs` - Main replay script
- `package.json` - `pnpm replay` script definition
- `server/core/db.ts` - Schema definitions

## Mental Model

The replay script is like a **video editor's render function**:
- Source footage = events (never changes)
- Timeline edits = projection logic
- Rendered video = projections
- Re-render = replay (same source, same output)
