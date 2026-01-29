import { describe, it, expect, beforeEach } from "vitest";
import { createTestDatabase, applyStockEvent, insertTestEvent } from "./setup";
import { rebuildAnalyticsProjections } from "../server/consumers/analyticsConsumer";

describe("Analytics Consumer", () => {
  let db: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    db = createTestDatabase();
  });

  describe("Product Velocity Projection", () => {
    it("should calculate 7-day velocity for sales", () => {
      // Arrange: Create sales over 7 days
      applyStockEvent(db, "apple", -10, "SALE", "2025-01-01T10:00:00Z");
      applyStockEvent(db, "apple", -15, "SALE", "2025-01-02T10:00:00Z");
      applyStockEvent(db, "apple", -20, "SALE", "2025-01-03T10:00:00Z");

      // Act: Rebuild analytics
      rebuildAnalyticsProjections(db);

      // Assert
      const velocity = db
        .prepare(
          "SELECT * FROM product_velocity WHERE product_id = ? AND window_days = 7"
        )
        .get("apple") as any;

      expect(velocity).toBeDefined();
      expect(velocity.units_sold).toBe(45); // 10 + 15 + 20
      expect(velocity.avg_per_day).toBeGreaterThan(0);
    });

    it("should track 30-day velocity separately from 7-day", () => {
      // Arrange
      applyStockEvent(db, "banana", -50, "SALE", "2025-01-01T10:00:00Z");

      // Act
      rebuildAnalyticsProjections(db);

      // Assert
      const velocity7d = db
        .prepare(
          "SELECT * FROM product_velocity WHERE product_id = ? AND window_days = 7"
        )
        .get("banana") as any;
      const velocity30d = db
        .prepare(
          "SELECT * FROM product_velocity WHERE product_id = ? AND window_days = 30"
        )
        .get("banana") as any;

      expect(velocity7d.units_sold).toBe(50);
      expect(velocity30d.units_sold).toBe(50);
      expect(velocity7d.window_days).toBe(7);
      expect(velocity30d.window_days).toBe(30);
    });

    it("should ignore deliveries in velocity calculation", () => {
      // Arrange: Mix of sales and deliveries
      applyStockEvent(db, "apple", -10, "SALE", "2025-01-01T10:00:00Z");
      applyStockEvent(db, "apple", 100, "DELIVERY", "2025-01-01T11:00:00Z");
      applyStockEvent(db, "apple", -5, "SALE", "2025-01-01T12:00:00Z");

      // Act
      rebuildAnalyticsProjections(db);

      // Assert: Only sales counted
      const velocity = db
        .prepare(
          "SELECT * FROM product_velocity WHERE product_id = ? AND window_days = 7"
        )
        .get("apple") as any;

      expect(velocity.units_sold).toBe(15); // Only 10 + 5, not the delivery
    });

    it("should track multiple products independently", () => {
      // Arrange
      applyStockEvent(db, "apple", -10, "SALE", "2025-01-01T10:00:00Z");
      applyStockEvent(db, "banana", -20, "SALE", "2025-01-01T10:00:00Z");

      // Act
      rebuildAnalyticsProjections(db);

      // Assert
      const appleVelocity = db
        .prepare(
          "SELECT * FROM product_velocity WHERE product_id = ? AND window_days = 7"
        )
        .get("apple") as any;
      const bananaVelocity = db
        .prepare(
          "SELECT * FROM product_velocity WHERE product_id = ? AND window_days = 7"
        )
        .get("banana") as any;

      expect(appleVelocity.units_sold).toBe(10);
      expect(bananaVelocity.units_sold).toBe(20);
    });
  });

  describe("Stock Health Projection", () => {
    it("should mark product as CRITICAL when stockout is imminent", () => {
      // Arrange: Low stock with high consumption
      applyStockEvent(db, "apple", 100, "DELIVERY", "2025-01-01T10:00:00Z");
      applyStockEvent(db, "apple", -98, "SALE", "2025-01-01T11:00:00Z");

      // Act
      rebuildAnalyticsProjections(db);

      // Assert
      const health = db
        .prepare("SELECT * FROM stock_health WHERE product_id = ?")
        .get("apple") as any;

      expect(health.current_stock).toBe(2);
      expect(health.health_status).toBe("CRITICAL");
      expect(health.days_until_stockout).toBeLessThan(2);
    });

    it("should mark product as HEALTHY with good stock levels", () => {
      // Arrange: Good stock, moderate consumption
      applyStockEvent(db, "banana", 100, "DELIVERY", "2025-01-01T10:00:00Z");
      applyStockEvent(db, "banana", -10, "SALE", "2025-01-02T10:00:00Z");

      // Act
      rebuildAnalyticsProjections(db);

      // Assert
      const health = db
        .prepare("SELECT * FROM stock_health WHERE product_id = ?")
        .get("banana") as any;

      expect(health.current_stock).toBe(90);
      expect(health.health_status).toBe("HEALTHY");
    });

    it("should mark product as OVERSTOCKED with excess inventory", () => {
      // Arrange: High stock, low consumption
      applyStockEvent(db, "milk", 500, "DELIVERY", "2025-01-01T10:00:00Z");
      applyStockEvent(db, "milk", -5, "SALE", "2025-01-02T10:00:00Z");

      // Act
      rebuildAnalyticsProjections(db);

      // Assert
      const health = db
        .prepare("SELECT * FROM stock_health WHERE product_id = ?")
        .get("milk") as any;

      expect(health.health_status).toBe("OVERSTOCKED");
      expect(health.days_until_stockout).toBeGreaterThan(30);
    });

    it("should handle products with no sales data", () => {
      // Arrange: Only delivery, no sales
      applyStockEvent(db, "new-product", 50, "DELIVERY", "2025-01-01T10:00:00Z");

      // Act
      rebuildAnalyticsProjections(db);

      // Assert
      const health = db
        .prepare("SELECT * FROM stock_health WHERE product_id = ?")
        .get("new-product") as any;

      expect(health.current_stock).toBe(50);
      expect(health.avg_daily_consumption).toBe(0);
      expect(health.health_status).toBe("UNKNOWN");
    });
  });

  describe("Decision Latency Projection", () => {
    it("should record proposal timestamp", () => {
      // Arrange
      insertTestEvent(db, {
        type: "ActionProposed",
        ts: "2025-01-01T10:00:00Z",
        payload: {
          actionId: "action-1",
          productId: "apple",
          actionType: "PRICE_DECREASE",
          confidence: 0.65,
        },
      });

      // Act
      rebuildAnalyticsProjections(db);

      // Assert
      const latency = db
        .prepare("SELECT * FROM decision_latency WHERE action_id = ?")
        .get("action-1") as any;

      expect(latency).toBeDefined();
      expect(latency.proposed_at).toBe("2025-01-01T10:00:00Z");
      expect(latency.decided_at).toBeNull();
    });

    it("should calculate latency when decision is made", () => {
      // Arrange: Proposal at 10:00, decision at 10:05 (5 minutes = 300 seconds)
      insertTestEvent(db, {
        type: "ActionProposed",
        ts: "2025-01-01T10:00:00Z",
        payload: {
          actionId: "action-1",
          productId: "apple",
          actionType: "PRICE_DECREASE",
          confidence: 0.65,
        },
      });

      insertTestEvent(db, {
        type: "HumanDecisionRecorded",
        ts: "2025-01-01T10:05:00Z",
        payload: {
          actionId: "action-1",
          decision: "APPROVED",
          humanId: "human-1",
        },
      });

      // Act
      rebuildAnalyticsProjections(db);

      // Assert
      const latency = db
        .prepare("SELECT * FROM decision_latency WHERE action_id = ?")
        .get("action-1") as any;

      expect(latency.decided_at).toBe("2025-01-01T10:05:00Z");
      expect(latency.latency_seconds).toBe(300);
      expect(latency.decision).toBe("APPROVED");
    });

    it("should track multiple decisions independently", () => {
      // Arrange
      insertTestEvent(db, {
        type: "ActionProposed",
        ts: "2025-01-01T10:00:00Z",
        payload: { actionId: "action-1", productId: "apple", actionType: "REORDER", confidence: 0.8 },
      });

      insertTestEvent(db, {
        type: "ActionProposed",
        ts: "2025-01-01T11:00:00Z",
        payload: { actionId: "action-2", productId: "banana", actionType: "PRICE_INCREASE", confidence: 0.9 },
      });

      insertTestEvent(db, {
        type: "HumanDecisionRecorded",
        ts: "2025-01-01T10:02:00Z",
        payload: { actionId: "action-1", decision: "APPROVED", humanId: "human-1" },
      });

      insertTestEvent(db, {
        type: "HumanDecisionRecorded",
        ts: "2025-01-01T11:10:00Z",
        payload: { actionId: "action-2", decision: "REJECTED", humanId: "human-1" },
      });

      // Act
      rebuildAnalyticsProjections(db);

      // Assert
      const latency1 = db.prepare("SELECT * FROM decision_latency WHERE action_id = ?").get("action-1") as any;
      const latency2 = db.prepare("SELECT * FROM decision_latency WHERE action_id = ?").get("action-2") as any;

      expect(latency1.latency_seconds).toBe(120); // 2 minutes
      expect(latency1.decision).toBe("APPROVED");

      expect(latency2.latency_seconds).toBe(600); // 10 minutes
      expect(latency2.decision).toBe("REJECTED");
    });
  });

  describe("Agent Performance Projection", () => {
    it("should bucket proposals by confidence", () => {
      // Arrange: Multiple proposals at different confidence levels
      insertTestEvent(db, {
        type: "ActionProposed",
        ts: "2025-01-01T10:00:00Z",
        payload: { actionId: "action-1", productId: "apple", actionType: "REORDER", confidence: 0.75 },
      });

      insertTestEvent(db, {
        type: "ActionProposed",
        ts: "2025-01-01T10:01:00Z",
        payload: { actionId: "action-2", productId: "banana", actionType: "REORDER", confidence: 0.78 },
      });

      insertTestEvent(db, {
        type: "HumanDecisionRecorded",
        ts: "2025-01-01T10:02:00Z",
        payload: { actionId: "action-1", decision: "APPROVED", humanId: "human-1" },
      });

      insertTestEvent(db, {
        type: "HumanDecisionRecorded",
        ts: "2025-01-01T10:03:00Z",
        payload: { actionId: "action-2", decision: "APPROVED", humanId: "human-1" },
      });

      // Act
      rebuildAnalyticsProjections(db);

      // Assert: Both proposals in 0.7-0.8 bucket
      const performance = db
        .prepare("SELECT * FROM agent_performance WHERE confidence_bucket = ?")
        .get("0.7-0.8") as any;

      expect(performance.total_proposals).toBe(2);
      expect(performance.approved_count).toBe(2);
      expect(performance.rejected_count).toBe(0);
      expect(performance.approval_rate).toBe(1.0);
    });

    it("should calculate approval rate correctly", () => {
      // Arrange: 3 proposals, 2 approved, 1 rejected
      for (let i = 1; i <= 3; i++) {
        insertTestEvent(db, {
          type: "ActionProposed",
          ts: `2025-01-01T10:0${i}:00Z`,
          payload: { actionId: `action-${i}`, productId: "apple", actionType: "REORDER", confidence: 0.85 },
        });

        insertTestEvent(db, {
          type: "HumanDecisionRecorded",
          ts: `2025-01-01T10:0${i + 3}:00Z`,
          payload: {
            actionId: `action-${i}`,
            decision: i === 3 ? "REJECTED" : "APPROVED",
            humanId: "human-1",
          },
        });
      }

      // Act
      rebuildAnalyticsProjections(db);

      // Assert: 0.8-0.9 bucket
      const performance = db
        .prepare("SELECT * FROM agent_performance WHERE confidence_bucket = ?")
        .get("0.8-0.9") as any;

      expect(performance.total_proposals).toBe(3);
      expect(performance.approved_count).toBe(2);
      expect(performance.rejected_count).toBe(1);
      expect(performance.approval_rate).toBeCloseTo(0.667, 2);
    });

    it("should handle empty buckets gracefully", () => {
      // Act: Rebuild with no data
      rebuildAnalyticsProjections(db);

      // Assert: All buckets exist but with zero counts
      const performance = db
        .prepare("SELECT * FROM agent_performance WHERE confidence_bucket = ?")
        .get("0.5-0.6") as any;

      expect(performance).toBeDefined();
      expect(performance.total_proposals).toBe(0);
      expect(performance.approval_rate).toBe(0);
    });
  });

  describe("Analytics Rebuild Determinism", () => {
    it("should produce same results when rebuilt multiple times", () => {
      // Arrange
      applyStockEvent(db, "apple", -10, "SALE", "2025-01-01T10:00:00Z");
      applyStockEvent(db, "banana", -20, "SALE", "2025-01-01T11:00:00Z");

      insertTestEvent(db, {
        type: "ActionProposed",
        ts: "2025-01-01T12:00:00Z",
        payload: { actionId: "action-1", productId: "apple", actionType: "REORDER", confidence: 0.8 },
      });

      // Act: Rebuild 3 times
      rebuildAnalyticsProjections(db);
      const result1 = db.prepare("SELECT * FROM product_velocity WHERE window_days = 7").all();

      rebuildAnalyticsProjections(db);
      const result2 = db.prepare("SELECT * FROM product_velocity WHERE window_days = 7").all();

      rebuildAnalyticsProjections(db);
      const result3 = db.prepare("SELECT * FROM product_velocity WHERE window_days = 7").all();

      // Assert: All results identical
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });
});
