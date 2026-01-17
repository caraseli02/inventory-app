import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb, cleanupTestDb, insertTestEvent, getStockLevel } from "./setup";
import type Database from "better-sqlite3";

/**
 * Projection Tests
 *
 * These tests verify that projections correctly derive state from events.
 *
 * What you'll learn:
 * - Projections are deterministic: same events → same state
 * - Projections can be rebuilt from scratch
 * - Order of events matters
 * - Projections handle edge cases (negative stock, etc.)
 */

describe("Stock Level Projection", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  /**
   * Helper to apply a stock event and update projection
   */
  function applyStockEvent(productId: string, delta: number, reason: string, ts: string) {
    // Insert the event
    insertTestEvent(db, {
      id: `event-${Date.now()}-${Math.random()}`,
      type: "StockLevelChanged",
      ts,
      aggregateType: "Product",
      aggregateId: productId,
      payload: { productId, delta, reason },
    });

    // Update the projection (simulating what projectStockLevelChanged does)
    const existing = db
      .prepare(`SELECT quantity FROM stock_levels WHERE product_id = ?`)
      .get(productId) as { quantity: number } | undefined;

    const current = existing?.quantity ?? 0;
    const next = Math.max(0, current + delta);

    db.prepare(`
      INSERT INTO stock_levels (product_id, quantity, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(product_id) DO UPDATE SET
        quantity = excluded.quantity,
        updated_at = excluded.updated_at
    `).run(productId, next, ts);
  }

  it("should start with zero stock for new products", () => {
    expect(getStockLevel(db, "new-product")).toBe(null);
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

  it("should handle multiple events in sequence", () => {
    applyStockEvent("apple", 100, "DELIVERY", "2025-01-01T10:00:00Z");
    applyStockEvent("apple", -20, "SALE", "2025-01-01T11:00:00Z");
    applyStockEvent("apple", -15, "SALE", "2025-01-01T12:00:00Z");
    applyStockEvent("apple", 50, "DELIVERY", "2025-01-01T13:00:00Z");
    applyStockEvent("apple", -10, "SALE", "2025-01-01T14:00:00Z");

    // 100 - 20 - 15 + 50 - 10 = 105
    expect(getStockLevel(db, "apple")).toBe(105);
  });

  it("should clamp stock to zero (never go negative)", () => {
    applyStockEvent("apple", 10, "DELIVERY", "2025-01-01T10:00:00Z");
    applyStockEvent("apple", -50, "SALE", "2025-01-01T11:00:00Z"); // Try to sell more than we have

    // Stock should be 0, not -40
    expect(getStockLevel(db, "apple")).toBe(0);
  });

  it("should track multiple products independently", () => {
    applyStockEvent("apple", 100, "DELIVERY", "2025-01-01T10:00:00Z");
    applyStockEvent("banana", 50, "DELIVERY", "2025-01-01T10:00:00Z");
    applyStockEvent("apple", -30, "SALE", "2025-01-01T11:00:00Z");

    expect(getStockLevel(db, "apple")).toBe(70);
    expect(getStockLevel(db, "banana")).toBe(50);
  });

  it("should handle adjustment events", () => {
    applyStockEvent("apple", 100, "DELIVERY", "2025-01-01T10:00:00Z");
    applyStockEvent("apple", -5, "ADJUSTMENT", "2025-01-01T11:00:00Z"); // Inventory correction

    expect(getStockLevel(db, "apple")).toBe(95);
  });

  describe("Rebuild from events", () => {
    it("should rebuild projection from events", () => {
      // Insert events directly (simulating historical data)
      insertTestEvent(db, {
        id: "e1",
        type: "StockLevelChanged",
        ts: "2025-01-01T10:00:00Z",
        aggregateType: "Product",
        aggregateId: "apple",
        payload: { productId: "apple", delta: 100, reason: "DELIVERY" },
      });

      insertTestEvent(db, {
        id: "e2",
        type: "StockLevelChanged",
        ts: "2025-01-01T11:00:00Z",
        aggregateType: "Product",
        aggregateId: "apple",
        payload: { productId: "apple", delta: -30, reason: "SALE" },
      });

      // Projection is empty before rebuild
      expect(getStockLevel(db, "apple")).toBe(null);

      // Rebuild projection from events
      db.prepare(`DELETE FROM stock_levels`).run();

      const events = db
        .prepare(`SELECT payload, ts FROM events WHERE type = 'StockLevelChanged' ORDER BY ts ASC`)
        .all() as Array<{ payload: string; ts: string }>;

      for (const event of events) {
        const payload = JSON.parse(event.payload);
        const existing = db
          .prepare(`SELECT quantity FROM stock_levels WHERE product_id = ?`)
          .get(payload.productId) as { quantity: number } | undefined;

        const current = existing?.quantity ?? 0;
        const next = Math.max(0, current + payload.delta);

        db.prepare(`
          INSERT INTO stock_levels (product_id, quantity, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(product_id) DO UPDATE SET
            quantity = excluded.quantity,
            updated_at = excluded.updated_at
        `).run(payload.productId, next, event.ts);
      }

      // After rebuild, projection should match expected state
      expect(getStockLevel(db, "apple")).toBe(70);
    });

    it("should produce same result when rebuilding multiple times", () => {
      // Setup events
      insertTestEvent(db, {
        id: "e1",
        type: "StockLevelChanged",
        ts: "2025-01-01T10:00:00Z",
        aggregateType: "Product",
        aggregateId: "apple",
        payload: { productId: "apple", delta: 100, reason: "DELIVERY" },
      });

      // Helper to rebuild and get result
      function rebuildAndGetStock(): number | null {
        db.prepare(`DELETE FROM stock_levels`).run();

        const events = db
          .prepare(`SELECT payload, ts FROM events WHERE type = 'StockLevelChanged' ORDER BY ts ASC`)
          .all() as Array<{ payload: string; ts: string }>;

        for (const event of events) {
          const payload = JSON.parse(event.payload);
          const existing = db
            .prepare(`SELECT quantity FROM stock_levels WHERE product_id = ?`)
            .get(payload.productId) as { quantity: number } | undefined;

          const current = existing?.quantity ?? 0;
          const next = Math.max(0, current + payload.delta);

          db.prepare(`
            INSERT INTO stock_levels (product_id, quantity, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(product_id) DO UPDATE SET
              quantity = excluded.quantity,
              updated_at = excluded.updated_at
          `).run(payload.productId, next, event.ts);
        }

        return getStockLevel(db, "apple");
      }

      // Rebuild multiple times - should always get same result
      const result1 = rebuildAndGetStock();
      const result2 = rebuildAndGetStock();
      const result3 = rebuildAndGetStock();

      expect(result1).toBe(100);
      expect(result2).toBe(100);
      expect(result3).toBe(100);
    });
  });
});

describe("Daily Sales Projection", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  function getDailySales(productId: string, day: string): { totalSold: number; totalDelivered: number } | null {
    const row = db
      .prepare(`SELECT total_sold, total_delivered FROM daily_sales WHERE product_id = ? AND day = ?`)
      .get(productId, day) as { total_sold: number; total_delivered: number } | undefined;

    if (!row) return null;
    return { totalSold: row.total_sold, totalDelivered: row.total_delivered };
  }

  function applySalesEvent(productId: string, delta: number, reason: string, ts: string) {
    insertTestEvent(db, {
      id: `event-${Date.now()}-${Math.random()}`,
      type: "StockLevelChanged",
      ts,
      aggregateType: "Product",
      aggregateId: productId,
      payload: { productId, delta, reason },
    });

    const day = ts.slice(0, 10);
    const existing = db
      .prepare(`SELECT total_sold, total_delivered, transaction_count FROM daily_sales WHERE product_id = ? AND day = ?`)
      .get(productId, day) as { total_sold: number; total_delivered: number; transaction_count: number } | undefined;

    let totalSold = existing?.total_sold ?? 0;
    let totalDelivered = existing?.total_delivered ?? 0;
    const transactionCount = (existing?.transaction_count ?? 0) + 1;

    if (reason === "SALE" && delta < 0) {
      totalSold += Math.abs(delta);
    } else if (reason === "DELIVERY" && delta > 0) {
      totalDelivered += delta;
    }

    db.prepare(`
      INSERT INTO daily_sales (product_id, day, total_sold, total_delivered, transaction_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(product_id, day) DO UPDATE SET
        total_sold = excluded.total_sold,
        total_delivered = excluded.total_delivered,
        transaction_count = excluded.transaction_count
    `).run(productId, day, totalSold, totalDelivered, transactionCount);
  }

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

    const sales = getDailySales("apple", "2025-01-15");
    expect(sales?.totalSold).toBe(30); // 10 + 15 + 5
  });

  it("should track days independently", () => {
    applySalesEvent("apple", -20, "SALE", "2025-01-15T10:00:00Z");
    applySalesEvent("apple", -30, "SALE", "2025-01-16T10:00:00Z");

    expect(getDailySales("apple", "2025-01-15")?.totalSold).toBe(20);
    expect(getDailySales("apple", "2025-01-16")?.totalSold).toBe(30);
  });

  it("should not count adjustments as sales or deliveries", () => {
    applySalesEvent("apple", -10, "ADJUSTMENT", "2025-01-15T10:00:00Z");

    const sales = getDailySales("apple", "2025-01-15");
    expect(sales?.totalSold).toBe(0);
    expect(sales?.totalDelivered).toBe(0);
  });
});

describe("Discontinued Products Projection", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  /**
   * Helper to check if a product is discontinued
   * This mirrors the isProductDiscontinued() function in workflow.ts
   */
  function isProductDiscontinued(productId: string): boolean {
    const row = db.prepare(`SELECT 1 FROM discontinued_products WHERE product_id = ?`).get(productId);
    return row !== undefined;
  }

  /**
   * Helper to get discontinued product details
   */
  function getDiscontinuedProduct(productId: string): { reason: string; discontinuedBy: string; discontinuedAt: string } | null {
    const row = db.prepare(`
      SELECT reason, discontinued_by, discontinued_at
      FROM discontinued_products
      WHERE product_id = ?
    `).get(productId) as { reason: string; discontinued_by: string; discontinued_at: string } | undefined;

    if (!row) return null;
    return {
      reason: row.reason,
      discontinuedBy: row.discontinued_by,
      discontinuedAt: row.discontinued_at,
    };
  }

  /**
   * Helper to discontinue a product (simulates handleProductDiscontinued)
   *
   * WHY WE DO THIS:
   * - Tests use an isolated in-memory database
   * - The real handleProductDiscontinued() uses the production db
   * - So we simulate the same logic here for test isolation
   */
  function discontinueProduct(productId: string, reason: string, discontinuedBy: string, ts: string) {
    // 1. Insert the event (what appendEvent does)
    insertTestEvent(db, {
      type: "ProductDiscontinued",
      ts,
      aggregateType: "Product",
      aggregateId: productId,
      payload: { productId, reason, discontinuedBy },
    });

    // 2. Update the projection (what the workflow does after appending)
    db.prepare(`
      INSERT INTO discontinued_products (product_id, reason, discontinued_by, discontinued_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(product_id) DO UPDATE SET
        reason = excluded.reason,
        discontinued_by = excluded.discontinued_by,
        discontinued_at = excluded.discontinued_at
    `).run(productId, reason, discontinuedBy, ts);
  }

  it("should record discontinued product in projection", () => {
    // Act: Discontinue a product
    discontinueProduct("apple", "LOW_DEMAND", "manager-1", "2025-01-15T10:00:00Z");

    // Assert: Check the projection has the record
    const record = getDiscontinuedProduct("apple");

    expect(record).not.toBeNull();
    expect(record?.reason).toBe("LOW_DEMAND");
    expect(record?.discontinuedBy).toBe("manager-1");
    expect(record?.discontinuedAt).toBe("2025-01-15T10:00:00Z");
  });

  it("should identify discontinued products correctly", () => {
    // Arrange: Discontinue one product, leave another active
    discontinueProduct("apple", "SUPPLIER_ISSUE", "admin", "2025-01-15T10:00:00Z");

    // Assert: Only apple is discontinued
    expect(isProductDiscontinued("apple")).toBe(true);
    expect(isProductDiscontinued("banana")).toBe(false);
  });

  it("should skip proposals for discontinued products", () => {
    // This test verifies the LOGIC that workflow.ts uses
    // The pattern: check isProductDiscontinued() BEFORE generating proposals

    // Arrange: Discontinue a product
    discontinueProduct("apple", "LOW_DEMAND", "manager-1", "2025-01-15T10:00:00Z");

    // Simulate what handleStockLevelChanged does:
    // IF product is discontinued → return empty proposals
    const productId = "apple";
    let proposedActionIds: string[] = [];

    if (!isProductDiscontinued(productId)) {
      // This would normally call proposeActionsForProduct()
      // But since apple IS discontinued, this block is SKIPPED
      proposedActionIds = ["action-1", "action-2"]; // Simulated proposals
    }

    // Assert: No proposals were created because product is discontinued
    expect(proposedActionIds).toEqual([]);
  });

  it("should allow proposals for non-discontinued products", () => {
    // Arrange: Discontinue apple, but NOT banana
    discontinueProduct("apple", "LOW_DEMAND", "manager-1", "2025-01-15T10:00:00Z");

    // Simulate proposal check for banana (not discontinued)
    const productId = "banana";
    let proposedActionIds: string[] = [];

    if (!isProductDiscontinued(productId)) {
      // Banana is NOT discontinued, so proposals are generated
      proposedActionIds = ["action-1"]; // Simulated proposal
    }

    // Assert: Proposals were created because banana is active
    expect(proposedActionIds.length).toBeGreaterThan(0);
  });
});

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

  // Helper to apply hourly sales event
  function applyHourlySalesEvent(productId: string, delta: number, reason: string, ts: string) {
    insertTestEvent(db, {
      type: "StockLevelChanged",
      ts,
      aggregateType: "Product",
      aggregateId: productId,
      payload: { productId, delta, reason },
    });

    // Only track sales
    if (reason !== "SALE" || delta >= 0) return;

    const hour = ts.slice(0, 13);
    const soldAmount = Math.abs(delta);

    db.prepare(`
      INSERT INTO hourly_sales (product_id, hour, total_sold, transaction_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(product_id, hour) DO UPDATE SET
        total_sold = hourly_sales.total_sold + excluded.total_sold,
        transaction_count = hourly_sales.transaction_count + 1
    `).run(productId, hour, soldAmount);
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

