# 11. Test Strategy - Testing Patterns and Examples

## Testing Philosophy

In event-sourced systems, testing is uniquely powerful because:

```
Same Events → Same State (always)
```

This means:
- **Deterministic**: Tests are repeatable
- **Isolated**: Each test starts fresh
- **Fast**: In-memory database, no I/O

## Test Categories

| Category | What It Tests | Database Needed? | Count |
|----------|---------------|------------------|-------|
| **Policy Tests** | Pure decision functions | No | 13 |
| **Projection Tests** | State derivation | Yes (in-memory) | 13 |
| **Analytics Tests** | Independent consumer | Yes (in-memory) | 15 |
| **Total** | | | 41 |

## Policy Tests (tests/policies.test.ts)

**Why policies are easy to test**: They're pure functions!

### Confidence Policy Tests

```typescript
describe("Confidence Policy", () => {
  it("should require human review when confidence is below 0.7", () => {
    expect(requiresHumanReview(0.5)).toBe(true);
    expect(requiresHumanReview(0.69)).toBe(true);
    expect(requiresHumanReview(0.0)).toBe(true);
  });

  it("should NOT require human review when confidence is 0.7 or above", () => {
    expect(requiresHumanReview(0.7)).toBe(false);
    expect(requiresHumanReview(0.8)).toBe(false);
  });

  // CRITICAL: Boundary test
  it("should handle edge case at exactly 0.7", () => {
    expect(requiresHumanReview(0.7)).toBe(false);      // At threshold
    expect(requiresHumanReview(0.6999999)).toBe(true); // Just below
  });
});
```

**Key pattern**: Always test boundaries.

### Business Rules Policy Tests

```typescript
describe("Business Rules Policy", () => {
  it("should always allow REORDER actions", () => {
    const result = isAllowedBusinessRule({
      actionType: "REORDER",
      suggestedValueCents: 0,
    });
    expect(result.ok).toBe(true);
  });

  it("should reject zero delta", () => {
    const result = isAllowedBusinessRule({
      actionType: "PRICE_DECREASE",
      suggestedValueCents: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INVALID_PRICE_DELTA");
  });

  it("should reject extremely large price deltas (> 500 cents)", () => {
    const result = isAllowedBusinessRule({
      actionType: "PRICE_DECREASE",
      suggestedValueCents: 600,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("PRICE_DELTA_TOO_LARGE");
  });

  // Boundary test
  it("should allow delta at exactly 500 cents", () => {
    const result = isAllowedBusinessRule({
      actionType: "PRICE_DECREASE",
      suggestedValueCents: 500,
    });
    expect(result.ok).toBe(true);
  });
});
```

### Reorder Policy Tests

```typescript
describe("Reorder Policy", () => {
  it("should require human review for REORDER actions", () => {
    expect(requiresHumanReviewForReorder("REORDER")).toBe(true);
  });

  it("should NOT require human review for price actions", () => {
    expect(requiresHumanReviewForReorder("PRICE_INCREASE")).toBe(false);
    expect(requiresHumanReviewForReorder("PRICE_DECREASE")).toBe(false);
  });
});
```

## Projection Tests (tests/projections.test.ts)

**Why projections need a database**: They read/write state.

### Test Setup

```typescript
// tests/setup.ts

// Create in-memory database for tests
export function createTestDatabase(): Database.Database {
  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (...);
    CREATE TABLE IF NOT EXISTS stock_levels (...);
    -- etc.
  `);

  return db;
}

// Setup/cleanup for each test
export function setupTestDb(): Database.Database {
  testDb = createTestDatabase();
  return testDb;
}

export function cleanupTestDb(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}
```

**Why in-memory?**
- Isolated: Each test fresh
- Fast: No disk I/O
- Clean: No production pollution

### Stock Projection Tests

```typescript
describe("Stock Level Projection", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  it("should correctly add stock from delivery", () => {
    applyStockEvent("apple", 100, "DELIVERY", "2025-01-01T10:00:00Z");
    expect(getStockLevel(db, "apple")).toBe(100);
  });

  it("should correctly subtract stock from sale", () => {
    applyStockEvent("apple", 100, "DELIVERY", "2025-01-01T10:00:00Z");
    applyStockEvent("apple", -30, "SALE", "2025-01-01T11:00:00Z");
    expect(getStockLevel(db, "apple")).toBe(70);
  });

  it("should clamp stock to zero (never go negative)", () => {
    applyStockEvent("apple", 10, "DELIVERY", "2025-01-01T10:00:00Z");
    applyStockEvent("apple", -50, "SALE", "2025-01-01T11:00:00Z");
    expect(getStockLevel(db, "apple")).toBe(0);  // Not -40
  });

  it("should track multiple products independently", () => {
    applyStockEvent("apple", 100, "DELIVERY", "2025-01-01T10:00:00Z");
    applyStockEvent("banana", 50, "DELIVERY", "2025-01-01T10:00:00Z");
    applyStockEvent("apple", -30, "SALE", "2025-01-01T11:00:00Z");

    expect(getStockLevel(db, "apple")).toBe(70);
    expect(getStockLevel(db, "banana")).toBe(50);
  });
});
```

### Rebuild Tests (Proving Determinism)

```typescript
describe("Rebuild from events", () => {
  it("should rebuild projection from events", () => {
    // Insert events directly
    insertTestEvent(db, { type: "StockLevelChanged", payload: { delta: 100 } });
    insertTestEvent(db, { type: "StockLevelChanged", payload: { delta: -30 } });

    // Projection is empty
    expect(getStockLevel(db, "apple")).toBe(null);

    // Rebuild from events
    db.prepare(`DELETE FROM stock_levels`).run();
    // ... replay events ...

    // Now projection matches
    expect(getStockLevel(db, "apple")).toBe(70);
  });

  it("should produce same result when rebuilding multiple times", () => {
    insertTestEvent(db, { type: "StockLevelChanged", payload: { delta: 100 } });

    // Rebuild multiple times
    const result1 = rebuildAndGetStock();
    const result2 = rebuildAndGetStock();
    const result3 = rebuildAndGetStock();

    // All identical (determinism proof!)
    expect(result1).toBe(100);
    expect(result2).toBe(100);
    expect(result3).toBe(100);
  });
});
```

### Daily Sales Projection Tests

```typescript
describe("Daily Sales Projection", () => {
  it("should track sales separately from deliveries", () => {
    applySalesEvent("apple", -20, "SALE", "2025-01-15T10:00:00Z");
    applySalesEvent("apple", 50, "DELIVERY", "2025-01-15T11:00:00Z");

    const sales = getDailySales("apple", "2025-01-15");
    expect(sales?.totalSold).toBe(20);
    expect(sales?.totalDelivered).toBe(50);
  });

  it("should aggregate multiple sales on the same day", () => {
    applySalesEvent("apple", -10, "SALE", "2025-01-15T10:00:00Z");
    applySalesEvent("apple", -15, "SALE", "2025-01-15T11:00:00Z");
    applySalesEvent("apple", -5, "SALE", "2025-01-15T12:00:00Z");

    expect(getDailySales("apple", "2025-01-15")?.totalSold).toBe(30);
  });

  it("should not count adjustments as sales or deliveries", () => {
    applySalesEvent("apple", -10, "ADJUSTMENT", "2025-01-15T10:00:00Z");

    const sales = getDailySales("apple", "2025-01-15");
    expect(sales?.totalSold).toBe(0);
    expect(sales?.totalDelivered).toBe(0);
  });
});
```

## Analytics Tests (tests/analytics.test.ts)

Testing the independent consumer:

```typescript
describe("Analytics Consumer", () => {
  it("should be deterministic - same results on rebuild", () => {
    // Insert events
    insertTestEvent(db, { type: "StockLevelChanged", ... });

    // First build
    rebuildAnalyticsProjections(db);
    const firstHealth = getStockHealth(db);

    // Rebuild again
    rebuildAnalyticsProjections(db);
    const secondHealth = getStockHealth(db);

    // Identical (determinism!)
    expect(firstHealth).toEqual(secondHealth);
  });

  it("should track product velocity correctly", () => {
    // Multiple sales
    insertTestEvent(db, { payload: { delta: -10, reason: "SALE" } });
    insertTestEvent(db, { payload: { delta: -15, reason: "SALE" } });

    rebuildAnalyticsProjections(db);

    const velocity = getVelocity(db, "apple", 7);
    expect(velocity.units_sold).toBe(25);
  });

  it("should compute decision latency", () => {
    // Proposal at 10:00
    insertTestEvent(db, {
      type: "ActionProposed",
      ts: "2025-01-15T10:00:00Z",
      payload: { actionId: "act-1", confidence: 0.65 }
    });

    // Decision at 10:15 (15 minutes later)
    insertTestEvent(db, {
      type: "HumanDecisionRecorded",
      ts: "2025-01-15T10:15:00Z",
      payload: { actionId: "act-1", decision: "APPROVED" }
    });

    rebuildAnalyticsProjections(db);

    const latency = getLatency(db, "act-1");
    expect(latency.latency_seconds).toBe(900);  // 15 * 60
  });
});
```

## Test Patterns

### 1. Arrange-Act-Assert

```typescript
it("should clamp stock to zero", () => {
  // Arrange
  applyStockEvent("apple", 10, "DELIVERY", ts);

  // Act
  applyStockEvent("apple", -50, "SALE", ts);

  // Assert
  expect(getStockLevel(db, "apple")).toBe(0);
});
```

### 2. Boundary Testing

```typescript
// At threshold
expect(requiresHumanReview(0.7)).toBe(false);

// Just below threshold
expect(requiresHumanReview(0.6999999)).toBe(true);

// Just above threshold
expect(requiresHumanReview(0.7000001)).toBe(false);
```

### 3. Event Sequence Testing

```typescript
it("should handle multiple events in sequence", () => {
  applyStockEvent("apple", 100, "DELIVERY", "T10:00");
  applyStockEvent("apple", -20, "SALE", "T11:00");
  applyStockEvent("apple", -15, "SALE", "T12:00");
  applyStockEvent("apple", 50, "DELIVERY", "T13:00");
  applyStockEvent("apple", -10, "SALE", "T14:00");

  // 100 - 20 - 15 + 50 - 10 = 105
  expect(getStockLevel(db, "apple")).toBe(105);
});
```

### 4. Rebuild/Determinism Testing

```typescript
it("should produce same result on multiple rebuilds", () => {
  // Insert events once
  insertEvents();

  // Rebuild multiple times
  const results = [1, 2, 3].map(() => {
    rebuildProjection();
    return getState();
  });

  // All identical
  expect(results[0]).toEqual(results[1]);
  expect(results[1]).toEqual(results[2]);
});
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run with UI
pnpm test:ui

# Run specific file
pnpm test tests/policies.test.ts

# Run in watch mode
pnpm test --watch
```

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | Tests verify product requirements |
| **Spec Creation** | Tests document the spec |
| **Systems Architecture** | Isolated tests prove modularity |
| **Context Engineering** | Tests verify context handling |
| **Workflow Orchestration** | Tests verify flow correctness |

## Key Files

- `tests/policies.test.ts` - Policy tests
- `tests/projections.test.ts` - Projection tests
- `tests/analytics.test.ts` - Analytics tests
- `tests/setup.ts` - Test helpers

## Mental Model

Tests are like **scientific experiments**:
- Hypothesis (expected behavior)
- Controlled conditions (isolated database)
- Reproducible (deterministic)
- Documented (test descriptions)
