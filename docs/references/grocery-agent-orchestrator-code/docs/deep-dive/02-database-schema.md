# 02. Database Schema - Source of Truth vs Projections

## The Critical Distinction

In event sourcing, there are two types of data:

| Type | Purpose | Can Delete? | Can Rebuild? |
|------|---------|-------------|--------------|
| **Source of Truth** | Facts that happened | ❌ NEVER | N/A |
| **Projections** | Derived state for queries | ✅ Yes | ✅ From events |

## Source of Truth: The Events Table

```sql
-- server/core/db.ts (lines 14-22)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,           -- Unique event ID (nanoid)
  type TEXT NOT NULL,            -- Event type (e.g., "StockLevelChanged")
  ts TEXT NOT NULL,              -- ISO timestamp
  aggregate_type TEXT NOT NULL,  -- "Product" or "Action"
  aggregate_id TEXT NOT NULL,    -- The entity this event belongs to
  correlation_id TEXT,           -- Groups related events
  causation_id TEXT,             -- Which event caused this one
  payload TEXT NOT NULL          -- JSON event data
);
```

**This is the ONLY source of truth.** Everything else is derived.

### Indexes for Query Performance

```sql
CREATE INDEX idx_events_aggregate ON events (aggregate_type, aggregate_id);
CREATE INDEX idx_events_type ON events (type);
CREATE INDEX idx_events_ts ON events (ts);
```

## Projections: Derived State

### Stock Levels Projection

```sql
-- Current stock for each product
CREATE TABLE IF NOT EXISTS stock_levels (
  product_id TEXT PRIMARY KEY,
  quantity INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Derivation logic** (`server/projectors/stockProjection.ts`):
- `StockLevelChanged` event with delta → quantity += delta

### Product Prices Projection

```sql
-- Current price for each product
CREATE TABLE IF NOT EXISTS product_prices (
  product_id TEXT PRIMARY KEY,
  price_cents INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Derivation**: `PriceChanged` event → update price_cents

### Action State Projection

```sql
-- Current status of each action in the workflow
CREATE TABLE IF NOT EXISTS action_state (
  action_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  action_type TEXT NOT NULL,    -- REORDER, PRICE_INCREASE, PRICE_DECREASE
  status TEXT NOT NULL,         -- PROPOSED, NEEDS_HUMAN_REVIEW, AUTHORIZED, etc.
  ts TEXT NOT NULL
);
```

**State Machine**:
```
PROPOSED → NEEDS_HUMAN_REVIEW → AUTHORIZED → EXECUTED
                ↓                    ↓
           REJECTED              REJECTED
                                     ↓
                               SUPPRESSED
```

### Daily Price Changes (Coordination)

```sql
-- Tracks which products had price changes today (for coordination policy)
CREATE TABLE IF NOT EXISTS daily_price_changes (
  product_id TEXT NOT NULL,
  day TEXT NOT NULL,            -- YYYY-MM-DD format
  PRIMARY KEY (product_id, day)
);
```

### Daily Sales Projection

```sql
-- Aggregated sales metrics per product per day
CREATE TABLE IF NOT EXISTS daily_sales (
  product_id TEXT NOT NULL,
  day TEXT NOT NULL,
  total_sold INTEGER NOT NULL DEFAULT 0,
  total_delivered INTEGER NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day)
);
```

## Analytics Projections (Independent Consumer)

These are built by a separate consumer reading the same events:

```sql
-- Product velocity: sales rate over time windows
CREATE TABLE IF NOT EXISTS product_velocity (
  product_id TEXT NOT NULL,
  window_days INTEGER NOT NULL,  -- 7, 30, etc.
  units_sold INTEGER NOT NULL DEFAULT 0,
  avg_per_day REAL NOT NULL DEFAULT 0,
  first_sale_ts TEXT,
  last_sale_ts TEXT,
  last_updated TEXT NOT NULL,
  PRIMARY KEY (product_id, window_days)
);

-- Stock health: inventory analysis
CREATE TABLE IF NOT EXISTS stock_health (
  product_id TEXT PRIMARY KEY,
  current_stock INTEGER NOT NULL,
  avg_daily_consumption REAL NOT NULL DEFAULT 0,
  days_until_stockout REAL,
  health_status TEXT NOT NULL,  -- HEALTHY, LOW, CRITICAL, OUT_OF_STOCK
  last_updated TEXT NOT NULL
);

-- Agent performance: confidence vs approval metrics
CREATE TABLE IF NOT EXISTS agent_performance (
  confidence_bucket TEXT PRIMARY KEY,  -- "0.0-0.1", "0.1-0.2", etc.
  total_proposals INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  approval_rate REAL NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL
);

-- Decision latency: time from proposal to human decision
CREATE TABLE IF NOT EXISTS decision_latency (
  action_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  confidence REAL NOT NULL,
  proposed_at TEXT NOT NULL,
  decided_at TEXT,
  latency_seconds INTEGER,
  decision TEXT,
  last_updated TEXT NOT NULL
);
```

## The Rebuild Test

**Critical invariant**: Delete all projections → rebuild from events → same state

```bash
pnpm replay  # Deletes projections, replays all events
```

If this breaks, your system has a bug.

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | Projections optimized for user queries |
| **Spec Creation** | Schema = contract for what data is available |
| **Systems Architecture** | Clear separation: truth vs views |
| **Context Engineering** | Projections provide fast context access |
| **Workflow Orchestration** | action_state tracks workflow progress |

## Key Files

- `server/core/db.ts` - All table definitions
- `server/projectors/` - Projection update logic
- `scripts/replay.mjs` - Rebuild script

## Mental Model

```
Events Table = The Bank's Transaction Log
  - Every deposit, withdrawal recorded
  - Never modified
  - Legally required

Projections = Your Account Balance Display
  - Computed from transaction log
  - Could be wrong (bug)
  - Can always be recalculated
```
