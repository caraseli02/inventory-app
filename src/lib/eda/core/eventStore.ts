import { db } from "./db.js";
import type { EventEnvelope } from "./types.js";
import { randomUUID } from "crypto";

/**
 * # Event Store (Event Log Access Layer)
 *
 * This file is intentionally boring and small: it is the single place where we
 * read/write the **immutable event log** (`events` table).
 *
 * Architectural intent:
 * - The `events` table is the **source of truth** for the system.
 * - Everything else (stock levels, prices, action state) is a **projection**
 *   derived from these events and can be deleted/rebuilt.
 * - AI/agents/policies/workflows should never update domain state directly.
 *   They should only append events, then projections/executors react to them.
 *
 * What this module does:
 * - Append an event envelope to SQLite (append-only).
 * - Read events back (by type, by aggregate, or all) for audit/debug/replay.
 *
 * What this module deliberately does NOT do:
 * - It does not implement business rules, policies, orchestration, or execution.
 * - It does not interpret payloads; payloads are stored as JSON and returned
 *   as parsed objects.
 */

/**
 * Append one immutable event to the event log.
 *
 * Important properties:
 * - This is an *insert only* path (no updates/deletes).
 * - `payload` is persisted as JSON.
 * - Optional `correlationId`/`causationId` are stored as `NULL` when missing
 *   (keeps DB clean and makes SQL queries easier).
 *
 * @example
 * appendEvent({
 *   id: "evt_123",
 *   type: "StockLevelChanged",
 *   ts: new Date().toISOString(),
 *   aggregateType: "Product",
 *   aggregateId: "milk",
 *   correlationId: "product:milk",
 *   causationId: "evt_122",
 *   payload: { productId: "milk", delta: -1, reason: "SALE" }
 * })
 */
export function appendEvent<TType extends string, TPayload>(
  event: EventEnvelope<TType, TPayload>,
): void {
  const stmt = db.prepare(`
    INSERT INTO events (id, type, ts, aggregate_type, aggregate_id, correlation_id, causation_id, payload)
    VALUES (@id, @type, @ts, @aggregateType, @aggregateId, @correlationId, @causationId, @payloadJson)
  `);

  stmt.run({
    id: event.id,
    type: event.type,
    ts: event.ts,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    correlationId: event.correlationId ?? null,
    causationId: event.causationId ?? null,
    payloadJson: JSON.stringify(event.payload),
  });
}

/**
 * SQLite row shape we read back from the `events` table.
 * We alias snake_case columns to camelCase to match `EventEnvelope`.
 */
type StoredEventRow = {
  id: string;
  type: string;
  ts: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string | null;
  causationId: string | null;
  payload: string;
};

/**
 * Convert a DB row into the canonical `EventEnvelope`.
 * - Parses `payload` JSON (throws if payload is invalid JSON; that would
 *   indicate corruption or a bad writer).
 * - Converts nullable correlation/causation into `undefined` when absent.
 */
function mapRowToEvent(row: StoredEventRow): EventEnvelope<string, unknown> {
  return {
    id: row.id,
    type: row.type,
    ts: row.ts,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    correlationId: row.correlationId ?? undefined,
    causationId: row.causationId ?? undefined,
    payload: JSON.parse(row.payload),
  };
}

/**
 * Read all events of a given type.
 *
 * Typical uses:
 * - Audit/debug: "show me all HumanDecisionRecorded events"
 * - Replay helpers: iterate a particular stream of events
 *
 * Note: Ordering is by ISO timestamp string ascending (`ts ASC`), which is
 * consistent for ISO-8601 UTC strings.
 */
export function readEventsByType(type: string): Array<EventEnvelope<string, unknown>> {
  const stmt = db.prepare(`
    SELECT
      id,
      type,
      ts,
      aggregate_type AS aggregateType,
      aggregate_id AS aggregateId,
      correlation_id AS correlationId,
      causation_id AS causationId,
      payload
    FROM events
    WHERE type = ?
    ORDER BY ts ASC
  `);
  return (stmt.all(type) as StoredEventRow[]).map(mapRowToEvent);
}

/**
 * Read events for a particular aggregate.
 *
 * Aggregates are the logical "streams" in the event log.
 * Examples:
 * - aggregateType="Product", aggregateId="milk"  -> all events about product milk
 * - aggregateType="Action",  aggregateId="<id>"  -> all events about one action
 *
 * If `aggregateType` is omitted, we read by `aggregate_id` only.
 * (Useful in tiny demos, but in larger systems you almost always want both.)
 */
export function readEventsByAggregate(input: {
  aggregateId: string;
  aggregateType?: string;
}): Array<EventEnvelope<string, unknown>> {
  const stmt = input.aggregateType
    ? db.prepare(`
        SELECT
          id,
          type,
          ts,
          aggregate_type AS aggregateType,
          aggregate_id AS aggregateId,
          correlation_id AS correlationId,
          causation_id AS causationId,
          payload
        FROM events
        WHERE aggregate_id = ? AND aggregate_type = ?
        ORDER BY ts ASC
      `)
    : db.prepare(`
        SELECT
          id,
          type,
          ts,
          aggregate_type AS aggregateType,
          aggregate_id AS aggregateId,
          correlation_id AS correlationId,
          causation_id AS causationId,
          payload
        FROM events
        WHERE aggregate_id = ?
        ORDER BY ts ASC
      `);

  const rows = input.aggregateType
    ? (stmt.all(input.aggregateId, input.aggregateType) as StoredEventRow[])
    : (stmt.all(input.aggregateId) as StoredEventRow[]);

  return rows.map(mapRowToEvent);
}

/**
 * Read the entire event log ordered by time.
 *
 * This is mainly useful for:
 * - admin/audit views
 * - full replay from scratch (though replay should usually read just the types
 *   it needs and in a deterministic order).
 */
export function readAllEvents(): Array<EventEnvelope<string, unknown>> {
  const stmt = db.prepare(`
    SELECT
      id,
      type,
      ts,
      aggregate_type AS aggregateType,
      aggregate_id AS aggregateId,
      correlation_id AS correlationId,
      causation_id AS causationId,
      payload
    FROM events
    ORDER BY ts ASC
  `);
  return (stmt.all() as StoredEventRow[]).map(mapRowToEvent);
}

/**
 * Helper to generate ISO timestamps consistently.
 * We keep timestamps as strings because:
 * - they are readable in DB
 * - ordering by ISO-8601 UTC string is correct
 * - JSON payloads + events remain portable
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Convenience wrapper around the raw functions.
 *
 * Why this exists:
 * - Keeps API handlers thin (HTTP is only ingress/query).
 * - Ensures every event has an id + timestamp even if the caller doesn't care.
 *
 * What it does:
 * - `append(...)`: accepts an event envelope missing `id`/`ts`, fills them,
 *   then persists via `appendEvent`.
 * - `getEvents(...)`: reads by aggregate.
 * - `getEventsByType(...)`: reads by type.
 * - `getAllEvents()`: reads all.
 *
 * Note:
 * - This does *not* validate payload schemas. Validation lives at boundaries
 *   (API input) or in domain modules that own the event type.
 */
export function createEventStore(): {
  append: <TType extends string, TPayload>(input: Omit<EventEnvelope<TType, TPayload>, "id" | "ts"> & Partial<Pick<EventEnvelope<TType, TPayload>, "id" | "ts">>) => EventEnvelope<TType, TPayload>;
  getEvents: (aggregateId: string, aggregateType?: string) => Array<EventEnvelope<string, unknown>>;
  getEventsByType: (type: string) => Array<EventEnvelope<string, unknown>>;
  getAllEvents: () => Array<EventEnvelope<string, unknown>>;
} {
  return {
    /**
     * Append an event, auto-filling `id` and `ts` if missing.
     *
     * Use this when you want the "event store service" feel in handlers/tests.
     * In core domain modules we often call `appendEvent(...)` directly for
     * maximum explicitness.
     */
    append(input) {
      const event: EventEnvelope<any, any> = {
        id: input.id ?? randomUUID(),
        type: input.type,
        ts: input.ts ?? nowIso(),
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        correlationId: input.correlationId,
        causationId: input.causationId,
        payload: input.payload,
      };

      appendEvent(event);
      return event;
    },
    getEvents(aggregateId, aggregateType) {
      return readEventsByAggregate({ aggregateId, aggregateType });
    },
    getEventsByType(type) {
      return readEventsByType(type);
    },
    getAllEvents() {
      return readAllEvents();
    },
  };
}
