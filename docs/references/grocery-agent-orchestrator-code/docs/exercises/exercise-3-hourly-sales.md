# Exercise 3: Add hourly_sales Projection

## Goal

Create a new projection that tracks sales aggregated by **hour** instead of day. This enables more granular analytics like:
- Peak shopping hours
- Hourly staffing optimization
- Real-time sales dashboards

## What You'll Build

```
StockLevelChanged event (reason: SALE)
         ↓
    Projector
         ↓
hourly_sales table (product_id, hour, total_sold)
```

---

## Step 1: Add the Table Schema

**File:** `server/core/db.ts`

Add a new table after `daily_sales`:

```sql
-- Hourly sales projection (more granular than daily)
CREATE TABLE IF NOT EXISTS hourly_sales (
  product_id TEXT NOT NULL,
  hour TEXT NOT NULL,           -- Format: "2025-01-15T14" (YYYY-MM-DDTHH)
  total_sold INTEGER NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, hour)
);

CREATE INDEX IF NOT EXISTS idx_hourly_sales_hour ON hourly_sales (hour);
```

**Why this schema:**
- `hour` uses ISO format truncated to hour: `"2025-01-15T14"` = 2pm on Jan 15
- `PRIMARY KEY (product_id, hour)` = one row per product per hour
- Index on `hour` for time-range queries

---

## Step 2: Create the Projector

**File:** `server/projectors/hourlySalesProjection.ts` (NEW FILE)

```typescript
import { db } from "../core/db.js";

/**
 * # Hourly Sales Projector
 *
 * Purpose:
 * - Track sales at hourly granularity
 * - Enable peak-hour analysis and real-time dashboards
 *
 * Called when:
 * - StockLevelChanged event with reason "SALE"
 *
 * Projection rule:
 * - Extract hour from timestamp (truncate to "YYYY-MM-DDTHH")
 * - Increment total_sold by absolute delta
 * - Increment transaction_count by 1
 */
export function projectHourlySales(input: {
  productId: string;
  delta: number;
  reason: string;
  ts: string;
}): void {
  // Only track sales (negative delta with SALE reason)
  if (input.reason !== "SALE" || input.delta >= 0) {
    return;
  }

  // Extract hour from ISO timestamp: "2025-01-15T14:30:00Z" → "2025-01-15T14"
  const hour = input.ts.slice(0, 13);
  const soldAmount = Math.abs(input.delta);

  db.prepare(`
    INSERT INTO hourly_sales (product_id, hour, total_sold, transaction_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(product_id, hour) DO UPDATE SET
      total_sold = hourly_sales.total_sold + excluded.total_sold,
      transaction_count = hourly_sales.transaction_count + 1
  `).run(input.productId, hour, soldAmount);
}
```

---

## Step 3: Integrate into Workflow

**File:** `server/core/workflow.ts`

1. **Add import** at the top:
```typescript
import { projectHourlySales } from "../projectors/hourlySalesProjection.js";
```

2. **Call projector** in `handleStockLevelChanged`, after `projectDailySales`:
```typescript
// Update projections
projectStockLevelChanged({ ... });
projectDailySales({ ... });
projectHourlySales({           // <-- ADD THIS
  productId: input.productId,
  delta: input.delta,
  reason: input.reason,
  ts,
});
```

---

## Step 4: Update Test Setup

**File:** `tests/setup.ts`

Add the table to `createTestDatabase()`:

```sql
-- Hourly sales projection
CREATE TABLE IF NOT EXISTS hourly_sales (
  product_id TEXT NOT NULL,
  hour TEXT NOT NULL,
  total_sold INTEGER NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, hour)
);
```

---

## Step 5: Add Tests (Validate the Projector)

**File:** `tests/projections.test.ts`

Add a new describe block:

Make sure to import the projector at the top of the test file:
```typescript
import { projectHourlySales } from "../server/projectors/hourlySalesProjection";
```

```typescript
describe("Hourly Sales Projection", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  // Helper to get hourly sales
  function getHourlySales(productId: string, hour: string): { totalSold: number; transactionCount: number } | null {
    const row = db.prepare(`
      SELECT total_sold, transaction_count
      FROM hourly_sales
      WHERE product_id = ? AND hour = ?
    `).get(productId, hour) as { total_sold: number; transaction_count: number } | undefined;

    if (!row) return null;
    return { totalSold: row.total_sold, transactionCount: row.transaction_count };
  }

  // Helper to apply hourly sales event via the real projector
  function applyHourlySalesEvent(productId: string, delta: number, reason: string, ts: string) {
    insertTestEvent(db, {
      type: "StockLevelChanged",
      ts,
      aggregateType: "Product",
      aggregateId: productId,
      payload: { productId, delta, reason },
    });

    projectHourlySales({ productId, delta, reason, ts });
  }

  it("should track sales by hour", () => {
    applyHourlySalesEvent("apple", -10, "SALE", "2025-01-15T14:30:00Z");

    const sales = getHourlySales("apple", "2025-01-15T14");
    expect(sales?.totalSold).toBe(10);
    expect(sales?.transactionCount).toBe(1);
  });

  it("should aggregate multiple sales in same hour", () => {
    applyHourlySalesEvent("apple", -5, "SALE", "2025-01-15T14:00:00Z");
    applyHourlySalesEvent("apple", -3, "SALE", "2025-01-15T14:30:00Z");
    applyHourlySalesEvent("apple", -7, "SALE", "2025-01-15T14:59:59Z");

    const sales = getHourlySales("apple", "2025-01-15T14");
    expect(sales?.totalSold).toBe(15);  // 5 + 3 + 7
    expect(sales?.transactionCount).toBe(3);
  });

  it("should track hours independently", () => {
    applyHourlySalesEvent("apple", -10, "SALE", "2025-01-15T14:00:00Z");
    applyHourlySalesEvent("apple", -20, "SALE", "2025-01-15T15:00:00Z");

    expect(getHourlySales("apple", "2025-01-15T14")?.totalSold).toBe(10);
    expect(getHourlySales("apple", "2025-01-15T15")?.totalSold).toBe(20);
  });

  it("should ignore deliveries", () => {
    applyHourlySalesEvent("apple", 50, "DELIVERY", "2025-01-15T14:00:00Z");

    expect(getHourlySales("apple", "2025-01-15T14")).toBeNull();
  });

  it("should ignore adjustments", () => {
    applyHourlySalesEvent("apple", -10, "ADJUSTMENT", "2025-01-15T14:00:00Z");

    expect(getHourlySales("apple", "2025-01-15T14")).toBeNull();
  });
});
```

---

## Step 6: (Optional) Add API Endpoint

**File:** `server/api/hourly-sales.get.ts` (NEW FILE)

```typescript
import { db } from "~~/server/core/db";

/**
 * GET /api/hourly-sales?productId=apple&date=2025-01-15
 *
 * Returns hourly sales breakdown for a product on a specific date.
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const productId = query.productId as string;
  const date = query.date as string; // Format: "2025-01-15" (UTC)

  if (!productId || !date) {
    throw createError({
      statusCode: 400,
      message: "Missing required query params: productId, date",
    });
  }

  // Query all hours for this product on this date
  const rows = db.prepare(`
    SELECT hour, total_sold, transaction_count
    FROM hourly_sales
    WHERE product_id = ? AND hour LIKE ?
    ORDER BY hour ASC
  `).all(productId, `${date}%`) as Array<{
    hour: string;
    total_sold: number;
    transaction_count: number;
  }>;

  return {
    productId,
    date,
    hours: rows.map((row) => ({
      hour: row.hour,
      totalSold: row.total_sold,
      transactionCount: row.transaction_count,
    })),
  };
});
```

---

## Step 7: Add Replay Support

**File:** `scripts/replay.mjs`

Add a rebuild path for `hourly_sales` so replaying from the event log restores the projection:
- Read `StockLevelChanged` events with `reason === "SALE"` and `delta < 0`
- Truncate `ts` to `YYYY-MM-DDTHH`
- Upsert `hourly_sales` with incremented `total_sold` and `transaction_count`

This keeps the “projections are rebuildable” invariant intact.

---

## Checklist

- [ ] Step 1: Add `hourly_sales` table to `server/core/db.ts`
- [ ] Step 2: Create `server/projectors/hourlySalesProjection.ts`
- [ ] Step 3: Import and call projector in `server/core/workflow.ts`
- [ ] Step 4: Add table to `tests/setup.ts`
- [ ] Step 5: Add tests to `tests/projections.test.ts`
- [ ] Step 6: (Optional) Add API endpoint
- [ ] Step 7: Add replay support in `scripts/replay.mjs`
- [ ] Run `pnpm test` - all tests should pass

---

## Key Concepts

### Hour Extraction
```typescript
// ISO timestamp (UTC): "2025-01-15T14:30:00Z"
// Slice first 13 chars: "2025-01-15T14"
const hour = ts.slice(0, 13);
```

### Upsert Pattern (INSERT ... ON CONFLICT)
```sql
INSERT INTO hourly_sales (product_id, hour, total_sold, transaction_count)
VALUES (?, ?, ?, 1)
ON CONFLICT(product_id, hour) DO UPDATE SET
  total_sold = hourly_sales.total_sold + excluded.total_sold,
  transaction_count = hourly_sales.transaction_count + 1
```

- If row doesn't exist → INSERT
- If row exists (conflict on PRIMARY KEY) → UPDATE by adding to existing values
- `excluded.total_sold` refers to the value we tried to insert

---

## When You're Done

Let me know and we'll:
1. Run the tests together
2. Review your implementation
3. Discuss any questions
