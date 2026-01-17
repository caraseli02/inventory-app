# 10. Analytics Consumer - Independent Event Stream Reader

## The Big Idea

The analytics consumer demonstrates a core concept from Part III of "Designing Event-Driven Systems":

**Multiple consumers can read the same event stream, each building their own projections.**

```
                    ┌────────────────────────────┐
                    │      Events Table          │
                    │   (Single Source of Truth) │
                    └────────────┬───────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │ Main Workflow   │ │ Analytics       │ │ Future Consumer │
    │ Consumer        │ │ Consumer        │ │ (e.g., ML)      │
    ├─────────────────┤ ├─────────────────┤ ├─────────────────┤
    │ stock_levels    │ │ product_velocity│ │ ???             │
    │ product_prices  │ │ stock_health    │ │                 │
    │ action_state    │ │ agent_performance│ │                 │
    │ daily_sales     │ │ decision_latency│ │                 │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

## File: `server/consumers/analyticsConsumer.ts`

## Key Properties

| Property | Main Workflow | Analytics Consumer |
|----------|---------------|-------------------|
| **Purpose** | Operational state | Business insights |
| **Coupling** | Tight (real-time) | Loose (can lag) |
| **Consistency** | Immediate | Eventual |
| **Affect workflow?** | Yes | No |
| **Rebuild independently?** | Yes | Yes |

## Projections Built

### 1. Product Velocity

**Table**: `product_velocity`

**Purpose**: Track sales rate over time windows.

```sql
CREATE TABLE product_velocity (
  product_id TEXT,
  window_days INTEGER,      -- 7 or 30
  units_sold INTEGER,
  avg_per_day REAL,
  first_sale_ts TEXT,
  last_sale_ts TEXT,
  last_updated TEXT,
  PRIMARY KEY (product_id, window_days)
);
```

**Derivation**:
```typescript
function updateProductVelocity(db, event) {
  const { productId, delta, reason } = event.payload;

  // Only track sales (negative delta with reason SALE)
  if (reason !== "SALE" || delta >= 0) return;

  const unitsSold = Math.abs(delta);

  // Update both 7-day and 30-day windows
  for (const windowDays of [7, 30]) {
    // Calculate running average per day
    const avgPerDay = totalUnits / Math.min(daysDiff, windowDays);
    // Update projection...
  }
}
```

**Example output**:
```
| product_id | window_days | units_sold | avg_per_day |
|------------|-------------|------------|-------------|
| milk-2pct  | 7           | 140        | 20.0        |
| milk-2pct  | 30          | 500        | 16.7        |
```

### 2. Stock Health

**Table**: `stock_health`

**Purpose**: Inventory risk analysis.

```sql
CREATE TABLE stock_health (
  product_id TEXT PRIMARY KEY,
  current_stock INTEGER,
  avg_daily_consumption REAL,
  days_until_stockout REAL,
  health_status TEXT,       -- HEALTHY, LOW, CRITICAL, OUT_OF_STOCK
  last_updated TEXT
);
```

**Derivation** (combines data sources):
```typescript
function computeStockHealth(db) {
  // Join stock_levels with product_velocity
  const products = db.prepare(`
    SELECT sl.product_id, sl.quantity, pv.avg_per_day
    FROM stock_levels sl
    LEFT JOIN product_velocity pv
      ON sl.product_id = pv.product_id
      AND pv.window_days = 7
  `).all();

  for (const product of products) {
    const daysUntilStockout = currentStock / avgDailyConsumption;

    let healthStatus;
    if (daysUntilStockout < 2) healthStatus = "CRITICAL";
    else if (daysUntilStockout < 7) healthStatus = "LOW";
    else if (daysUntilStockout < 30) healthStatus = "HEALTHY";
    else healthStatus = "OVERSTOCKED";

    // Insert into stock_health...
  }
}
```

**Health Status Logic**:
| Days Until Stockout | Status |
|---------------------|--------|
| < 2 days | CRITICAL |
| 2-7 days | LOW |
| 7-30 days | HEALTHY |
| > 30 days | OVERSTOCKED |
| No consumption data, 0 stock | OUT_OF_STOCK |

### 3. Agent Performance

**Table**: `agent_performance`

**Purpose**: Track AI agent accuracy by confidence level.

```sql
CREATE TABLE agent_performance (
  confidence_bucket TEXT PRIMARY KEY,  -- "0.9-1.0", "0.8-0.9", etc.
  total_proposals INTEGER,
  approved_count INTEGER,
  rejected_count INTEGER,
  approval_rate REAL,
  last_updated TEXT
);
```

**Derivation**:
```typescript
function computeAgentPerformance(db) {
  const buckets = [
    { name: "0.9-1.0", min: 0.9, max: 1.0 },
    { name: "0.8-0.9", min: 0.8, max: 0.9 },
    // ...
  ];

  for (const bucket of buckets) {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN decision = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN decision = 'REJECTED' THEN 1 ELSE 0 END) as rejected
      FROM decision_latency
      WHERE confidence >= ? AND confidence < ?
        AND decision IS NOT NULL
    `).get(bucket.min, bucket.max);

    const approvalRate = stats.approved / stats.total;
    // Insert into agent_performance...
  }
}
```

**Insight**: Higher confidence should correlate with higher approval rates.

### 4. Decision Latency

**Table**: `decision_latency`

**Purpose**: Track time from proposal to human decision.

```sql
CREATE TABLE decision_latency (
  action_id TEXT PRIMARY KEY,
  product_id TEXT,
  action_type TEXT,
  confidence REAL,
  proposed_at TEXT,
  decided_at TEXT,
  latency_seconds INTEGER,
  decision TEXT,
  last_updated TEXT
);
```

**Two-Phase Recording**:

**Phase 1**: When action is proposed
```typescript
function recordProposalForLatency(db, event) {
  const { actionId, productId, actionType, confidence } = event.payload;

  db.prepare(`
    INSERT OR REPLACE INTO decision_latency
    (action_id, product_id, action_type, confidence, proposed_at, last_updated)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actionId, productId, actionType, confidence, event.ts, event.ts);
}
```

**Phase 2**: When human decides
```typescript
function updateDecisionLatency(db, event) {
  const { actionId, decision } = event.payload;

  const existing = db.prepare(`
    SELECT proposed_at FROM decision_latency WHERE action_id = ?
  `).get(actionId);

  if (existing) {
    const latencySeconds = (decidedTime - proposedTime) / 1000;

    db.prepare(`
      UPDATE decision_latency
      SET decided_at = ?, latency_seconds = ?, decision = ?
      WHERE action_id = ?
    `).run(event.ts, latencySeconds, decision, actionId);
  }
}
```

## The Rebuild Process

```typescript
export function rebuildAnalyticsProjections(database?: Database): void {
  const db = database ?? defaultDb;

  // 1. Clear all analytics projections
  db.prepare("DELETE FROM product_velocity").run();
  db.prepare("DELETE FROM stock_health").run();
  db.prepare("DELETE FROM agent_performance").run();
  db.prepare("DELETE FROM decision_latency").run();

  // 2. Replay ALL events in chronological order
  const events = db.prepare(`
    SELECT * FROM events ORDER BY ts ASC
  `).all();

  // 3. Process each event
  for (const row of events) {
    processEventForAnalytics(db, event);
  }

  // 4. Compute derived metrics (require multiple projections)
  computeStockHealth(db);
  computeAgentPerformance(db);
}
```

## Event Processing

```typescript
function processEventForAnalytics(db, event) {
  switch (event.type) {
    case "StockLevelChanged":
      updateProductVelocity(db, event);  // Track sales
      break;

    case "ActionProposed":
      recordProposalForLatency(db, event);  // Start latency timer
      break;

    case "HumanDecisionRecorded":
      updateDecisionLatency(db, event);  // Stop latency timer
      break;

    default:
      // Other events don't affect analytics
      break;
  }
}
```

**Key insight**: The analytics consumer only cares about specific events. It ignores events like `ActionAuthorized`, `PriceChanged`, etc.

## Why Independent Consumers?

### 1. Different Concerns

| Main Workflow | Analytics Consumer |
|---------------|-------------------|
| "What's the stock now?" | "What's the trend?" |
| "Is action authorized?" | "How accurate is the agent?" |
| "Execute the change" | "How fast are humans deciding?" |

### 2. Different Timing

- Main workflow: Must be real-time
- Analytics: Can lag (rebuild when convenient)

### 3. Different Failure Modes

- Main workflow down: System stops working
- Analytics down: Dashboards stale, but system works

### 4. Different Teams

- Main workflow: Core engineering
- Analytics: Data/BI team

## Loose Coupling in Action

The analytics consumer doesn't affect the main workflow:

```
Main Workflow              Analytics Consumer
     │                           │
     │ (doesn't know about)      │
     ▼                           ▼
stock_levels              product_velocity
product_prices            stock_health
action_state              agent_performance
daily_sales               decision_latency
```

Even if analytics projections are wrong or missing, the main workflow continues.

## API Layer

The analytics consumer's projections are exposed via dedicated endpoints:

- `GET /api/analytics/velocity` - Product velocity
- `GET /api/analytics/health` - Stock health
- `GET /api/analytics/performance` - Agent performance
- `GET /api/analytics/latency` - Decision latency
- `POST /api/analytics/rebuild` - Trigger rebuild

## Testing Independence

From `tests/analytics.test.ts`:

```typescript
it("should be deterministic - same results on rebuild", () => {
  // First build
  rebuildAnalyticsProjections(db);
  const firstHealth = getStockHealth(db);

  // Rebuild again
  rebuildAnalyticsProjections(db);
  const secondHealth = getStockHealth(db);

  // Should be identical
  expect(firstHealth).toEqual(secondHealth);
});
```

**Same events → Same analytics** (determinism proof)

## Future Enhancements

The analytics consumer pattern enables:

1. **Real-time processing**: Hook into event stream instead of batch rebuild
2. **ML consumer**: Train models on event patterns
3. **Alerting consumer**: Send notifications on thresholds
4. **Export consumer**: Sync to external analytics platforms

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | Analytics = business intelligence features |
| **Spec Creation** | Separate projections = clear contracts |
| **Systems Architecture** | Multiple consumers = loose coupling |
| **Context Engineering** | Analytics provide historical context |
| **Workflow Orchestration** | Independent from main workflow |

## Key Files

- `server/consumers/analyticsConsumer.ts` - Main consumer
- `server/api/analytics/*.ts` - API endpoints
- `app/pages/analytics.vue` - Dashboard UI
- `tests/analytics.test.ts` - Tests

## Mental Model

The analytics consumer is like a **sports statistician**:
- Watches the same game (events) as the referee (main workflow)
- Tracks different things (velocity, trends, performance)
- Doesn't affect the game outcome
- Can rewatch recordings to verify stats
- Provides insights for coaches (business decisions)
