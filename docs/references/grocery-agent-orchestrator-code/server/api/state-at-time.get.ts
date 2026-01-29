import { defineEventHandler, getQuery, createError } from "h3";
import { db } from "../core/db";

/**
 * Time-Travel API: Get system state at any point in history.
 *
 * This demonstrates the power of event sourcing - we can rebuild
 * the exact state of the system at any timestamp by replaying
 * only the events that occurred before that time.
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const { timestamp } = query;

  if (!timestamp || typeof timestamp !== "string") {
    throw createError({
      statusCode: 400,
      message: "Missing required query parameter: timestamp (ISO-8601 format)",
    });
  }

  // Get the time bounds of our event log
  const bounds = db
    .prepare(`
      SELECT
        MIN(ts) as firstEvent,
        MAX(ts) as lastEvent,
        COUNT(*) as totalEvents
      FROM events
    `)
    .get() as { firstEvent: string; lastEvent: string; totalEvents: number };

  // Get all events up to the specified timestamp
  const eventsUpToTime = db
    .prepare(`
      SELECT id, type, ts, aggregate_type, aggregate_id, payload
      FROM events
      WHERE ts <= ?
      ORDER BY ts ASC
    `)
    .all(timestamp) as Array<{
      id: string;
      type: string;
      ts: string;
      aggregate_type: string;
      aggregate_id: string;
      payload: string;
    }>;

  // Rebuild stock levels from events up to this timestamp
  const stockLevels = new Map<string, { quantity: number; updatedAt: string }>();

  for (const event of eventsUpToTime) {
    if (event.type === "StockLevelChanged") {
      const payload = JSON.parse(event.payload);
      const current = stockLevels.get(payload.productId);
      const currentQty = current?.quantity ?? 0;
      const newQty = Math.max(0, currentQty + payload.delta);
      stockLevels.set(payload.productId, {
        quantity: newQty,
        updatedAt: event.ts,
      });
    }
  }

  // Rebuild action states from events up to this timestamp
  const actionStates = new Map<string, {
    actionId: string;
    productId: string;
    actionType: string;
    status: string;
    timestamp: string;
  }>();

  for (const event of eventsUpToTime) {
    const payload = JSON.parse(event.payload);

    switch (event.type) {
      case "ActionProposed":
        actionStates.set(payload.actionId, {
          actionId: payload.actionId,
          productId: payload.productId,
          actionType: payload.actionType,
          status: "PROPOSED",
          timestamp: event.ts,
        });
        break;
      case "HumanReviewRequired":
        if (actionStates.has(payload.actionId)) {
          actionStates.get(payload.actionId)!.status = "NEEDS_HUMAN_REVIEW";
        }
        break;
      case "ActionAuthorized":
        if (actionStates.has(payload.actionId)) {
          actionStates.get(payload.actionId)!.status = "AUTHORIZED";
        }
        break;
      case "ActionRejected":
        if (actionStates.has(payload.actionId)) {
          actionStates.get(payload.actionId)!.status = "REJECTED";
        }
        break;
      case "ActionExecuted":
        if (actionStates.has(payload.actionId)) {
          actionStates.get(payload.actionId)!.status = "EXECUTED";
        }
        break;
      case "ActionSuppressed":
        if (actionStates.has(payload.actionId)) {
          actionStates.get(payload.actionId)!.status = "SUPPRESSED";
        }
        break;
    }
  }

  // Count events by type up to this timestamp
  const eventCounts: Record<string, number> = {};
  for (const event of eventsUpToTime) {
    eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
  }

  return {
    requestedTimestamp: timestamp,
    bounds: {
      firstEvent: bounds.firstEvent,
      lastEvent: bounds.lastEvent,
      totalEvents: bounds.totalEvents,
    },
    eventsProcessed: eventsUpToTime.length,
    eventCounts,
    state: {
      stockLevels: Array.from(stockLevels.entries()).map(([productId, data]) => ({
        productId,
        ...data,
      })),
      actions: Array.from(actionStates.values()),
    },
  };
});
