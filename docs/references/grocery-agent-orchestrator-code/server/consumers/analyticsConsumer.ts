import { db as defaultDb } from "../core/db.js";
import type { EventEnvelope } from "../core/types.js";
import type Database from "better-sqlite3";

/**
 * # Analytics Consumer (Independent Event Stream Reader)
 *
 * This consumer reads the same event log as the main workflow but builds
 * different projections optimized for analytics and reporting.
 *
 * Key Learning Points:
 * - Multiple consumers can read the same event stream
 * - Each consumer builds projections suited to its needs
 * - Loose coupling: analytics doesn't affect the main workflow
 * - Eventual consistency: analytics might lag, and that's okay
 *
 * This demonstrates Part III of "Designing Event-Driven Systems":
 * "Event Streams as a Shared Source of Truth"
 */

/**
 * Rebuild all analytics projections from the event log.
 *
 * This function:
 * 1. Clears all analytics tables
 * 2. Replays all events in order
 * 3. Builds projections incrementally
 *
 * Important: The main workflow projections are not touched.
 */
export function rebuildAnalyticsProjections(database?: Database.Database): void {
  const db = database ?? defaultDb;
  console.log("[Analytics Consumer] Starting rebuild...");

  // Clear analytics projections
  db.prepare("DELETE FROM product_velocity").run();
  db.prepare("DELETE FROM stock_health").run();
  db.prepare("DELETE FROM agent_performance").run();
  db.prepare("DELETE FROM decision_latency").run();

  // Replay all events in chronological order
  const events = db
    .prepare("SELECT * FROM events ORDER BY ts ASC")
    .all() as Array<{
      id: string;
      type: string;
      ts: string;
      aggregate_type: string;
      aggregate_id: string;
      correlation_id: string | null;
      causation_id: string | null;
      payload: string;
    }>;

  console.log(`[Analytics Consumer] Replaying ${events.length} events...`);

  for (const row of events) {
    const event: EventEnvelope<any, any> = {
      id: row.id,
      type: row.type as any,
      ts: row.ts,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      correlationId: row.correlation_id ?? undefined,
      causationId: row.causation_id ?? undefined,
      payload: JSON.parse(row.payload),
    };

    processEventForAnalytics(db, event);
  }

  // After all events are processed, compute derived metrics
  computeStockHealth(db);
  computeAgentPerformance(db);

  console.log("[Analytics Consumer] Rebuild complete!");
}

/**
 * Process a single event for analytics projections.
 *
 * This is called during rebuild and could also be called in real-time
 * as new events arrive (future enhancement).
 */
function processEventForAnalytics(db: Database.Database, event: EventEnvelope<any, any>): void {
  switch (event.type) {
    case "StockLevelChanged":
      updateProductVelocity(db, event);
      break;

    case "ActionProposed":
      recordProposalForLatency(db, event);
      break;

    case "HumanDecisionRecorded":
      updateDecisionLatency(db, event);
      break;

    // Other events don't affect analytics (for now)
    default:
      break;
  }
}

/**
 * Update product velocity projections.
 *
 * Tracks sales over 7-day and 30-day windows.
 * Only counts SALE events (not deliveries or adjustments).
 */
function updateProductVelocity(db: Database.Database, event: EventEnvelope<"StockLevelChanged", any>): void {
  const { productId, delta, reason } = event.payload;

  // Only track sales (negative delta)
  if (reason !== "SALE" || delta >= 0) {
    return;
  }

  const unitsSold = Math.abs(delta);
  const eventTime = new Date(event.ts);

  // Update for both 7-day and 30-day windows
  for (const windowDays of [7, 30]) {
    const existing = db
      .prepare(
        `SELECT units_sold, first_sale_ts, last_sale_ts
         FROM product_velocity
         WHERE product_id = ? AND window_days = ?`
      )
      .get(productId, windowDays) as
      | { units_sold: number; first_sale_ts: string | null; last_sale_ts: string | null }
      | undefined;

    if (existing) {
      // Update existing record
      const firstSaleTs = existing.first_sale_ts || event.ts;
      const lastSaleTs = event.ts;

      // Calculate time window
      const firstSaleTime = new Date(firstSaleTs);
      const daysDiff = Math.max(
        1,
        (eventTime.getTime() - firstSaleTime.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only count sales within the window
      let totalUnits = existing.units_sold;
      if (daysDiff <= windowDays) {
        totalUnits += unitsSold;
      } else {
        // Reset if outside window (simplified approach)
        totalUnits = unitsSold;
      }

      const avgPerDay = totalUnits / Math.min(daysDiff, windowDays);

      db.prepare(
        `UPDATE product_velocity
         SET units_sold = ?, avg_per_day = ?, first_sale_ts = ?, last_sale_ts = ?, last_updated = ?
         WHERE product_id = ? AND window_days = ?`
      ).run(totalUnits, avgPerDay, firstSaleTs, lastSaleTs, event.ts, productId, windowDays);
    } else {
      // Create new record
      db.prepare(
        `INSERT INTO product_velocity
         (product_id, window_days, units_sold, avg_per_day, first_sale_ts, last_sale_ts, last_updated)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(productId, windowDays, unitsSold, unitsSold / 1, event.ts, event.ts, event.ts);
    }
  }
}

/**
 * Record proposal for latency tracking.
 *
 * Creates a record when an action is proposed that requires human review.
 */
function recordProposalForLatency(db: Database.Database, event: EventEnvelope<"ActionProposed", any>): void {
  const { actionId, productId, actionType, confidence } = event.payload;

  db.prepare(
    `INSERT OR REPLACE INTO decision_latency
     (action_id, product_id, action_type, confidence, proposed_at, last_updated)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(actionId, productId, actionType, confidence, event.ts, event.ts);
}

/**
 * Update decision latency when human makes a decision.
 *
 * Calculates time from proposal to decision.
 */
function updateDecisionLatency(db: Database.Database, event: EventEnvelope<"HumanDecisionRecorded", any>): void {
  const { actionId, decision } = event.payload;

  const existing = db
    .prepare(
      `SELECT proposed_at FROM decision_latency WHERE action_id = ?`
    )
    .get(actionId) as { proposed_at: string } | undefined;

  if (existing) {
    const proposedTime = new Date(existing.proposed_at);
    const decidedTime = new Date(event.ts);
    const latencySeconds = Math.floor(
      (decidedTime.getTime() - proposedTime.getTime()) / 1000
    );

    db.prepare(
      `UPDATE decision_latency
       SET decided_at = ?, latency_seconds = ?, decision = ?, last_updated = ?
       WHERE action_id = ?`
    ).run(event.ts, latencySeconds, decision, event.ts, actionId);
  }
}

/**
 * Compute stock health from current stock levels and velocity.
 *
 * This is a derived calculation that combines:
 * - Current stock (from stock_levels projection)
 * - Sales velocity (from product_velocity projection)
 */
function computeStockHealth(db: Database.Database): void {
  console.log("[Analytics] Computing stock health...");

  const products = db
    .prepare(
      `SELECT DISTINCT sl.product_id, sl.quantity, pv.avg_per_day
       FROM stock_levels sl
       LEFT JOIN product_velocity pv ON sl.product_id = pv.product_id AND pv.window_days = 7`
    )
    .all() as Array<{
      product_id: string;
      quantity: number;
      avg_per_day: number | null;
    }>;

  const now = new Date().toISOString();

  for (const product of products) {
    const currentStock = product.quantity;
    const avgDailyConsumption = product.avg_per_day || 0;

    let daysUntilStockout: number | null = null;
    let healthStatus: string;

    if (avgDailyConsumption > 0) {
      daysUntilStockout = currentStock / avgDailyConsumption;

      if (daysUntilStockout < 2) {
        healthStatus = "CRITICAL";
      } else if (daysUntilStockout < 7) {
        healthStatus = "LOW";
      } else if (daysUntilStockout < 30) {
        healthStatus = "HEALTHY";
      } else {
        healthStatus = "OVERSTOCKED";
      }
    } else {
      // No consumption data
      if (currentStock === 0) {
        healthStatus = "OUT_OF_STOCK";
      } else if (currentStock < 10) {
        healthStatus = "LOW";
      } else {
        healthStatus = "UNKNOWN";
      }
    }

    db.prepare(
      `INSERT OR REPLACE INTO stock_health
       (product_id, current_stock, avg_daily_consumption, days_until_stockout, health_status, last_updated)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      product.product_id,
      currentStock,
      avgDailyConsumption,
      daysUntilStockout,
      healthStatus,
      now
    );
  }
}

/**
 * Compute agent performance by confidence buckets.
 *
 * Groups proposals by confidence level and tracks approval rates.
 */
function computeAgentPerformance(db: Database.Database): void {
  console.log("[Analytics] Computing agent performance...");

  // Define confidence buckets
  const buckets = [
    { name: "0.5-0.6", min: 0.5, max: 0.6 },
    { name: "0.6-0.7", min: 0.6, max: 0.7 },
    { name: "0.7-0.8", min: 0.7, max: 0.8 },
    { name: "0.8-0.9", min: 0.8, max: 0.9 },
    { name: "0.9-1.0", min: 0.9, max: 1.0 },
  ];

  const now = new Date().toISOString();

  for (const bucket of buckets) {
    const stats = db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN decision = 'APPROVED' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN decision = 'REJECTED' THEN 1 ELSE 0 END) as rejected
         FROM decision_latency
         WHERE confidence >= ? AND confidence < ? AND decision IS NOT NULL`
      )
      .get(bucket.min, bucket.max) as {
        total: number;
        approved: number;
        rejected: number;
      };

    const approvalRate = stats.total > 0 ? stats.approved / stats.total : 0;

    db.prepare(
      `INSERT OR REPLACE INTO agent_performance
       (confidence_bucket, total_proposals, approved_count, rejected_count, approval_rate, last_updated)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      bucket.name,
      stats.total,
      stats.approved,
      stats.rejected,
      approvalRate,
      now
    );
  }
}
