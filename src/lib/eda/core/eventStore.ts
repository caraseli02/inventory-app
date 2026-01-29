import { db } from "./db";
import type { EventEnvelope } from "./types";
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Json } from "../../database.types";

/**
 * # Event Store (Event Log Access Layer - Supabase Version)
 *
 * Adapted for Supabase / Browser environment.
 */

/**
 * Append one immutable event to the event log.
 */
export async function appendEvent<TType extends string, TPayload extends Json>(
  event: EventEnvelope<TType, TPayload>,
): Promise<void> {
  const { error } = await db.from('events').insert({
    id: event.id,
    type: event.type,
    ts: event.ts,
    aggregate_type: event.aggregateType,
    aggregate_id: event.aggregateId,
    correlation_id: event.correlationId ?? null,
    causation_id: event.causationId ?? null,
    payload: event.payload, // Supabase handles JSONB
  });

  if (error) {
    console.error("Failed to append event:", error);
    throw error;
  }
}

/**
 * DB row shape from Supabase.
 */
type StoredEventRow = {
  id: string;
  type: string;
  ts: string;
  aggregate_type: string;
  aggregate_id: string;
  correlation_id: string | null;
  causation_id: string | null;
  payload: any;
};

/**
 * Convert a DB row into the canonical `EventEnvelope`.
 */
function mapRowToEvent(row: StoredEventRow): EventEnvelope<string, any> {
  return {
    id: row.id,
    type: row.type,
    ts: row.ts,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    correlationId: row.correlation_id ?? undefined,
    causationId: row.causation_id ?? undefined,
    payload: row.payload,
  };
}

/**
 * Read all events of a given type.
 */
export async function readEventsByType(type: string): Promise<Array<EventEnvelope<string, any>>> {
  const { data, error } = await db
    .from('events')
    .select('*')
    .eq('type', type)
    .order('ts', { ascending: true });

  if (error) throw error;
  return (data as StoredEventRow[]).map(mapRowToEvent);
}

/**
 * Read events for a particular aggregate.
 */
export async function readEventsByAggregate(input: {
  aggregateId: string;
  aggregateType?: string;
}): Promise<Array<EventEnvelope<string, any>>> {
  let query = db.from('events').select('*').eq('aggregate_id', input.aggregateId);

  if (input.aggregateType) {
    query = query.eq('aggregate_type', input.aggregateType);
  }

  const { data, error } = await query.order('ts', { ascending: true });

  if (error) throw error;
  return (data as StoredEventRow[]).map(mapRowToEvent);
}

/**
 * Read the entire event log ordered by time.
 */
export async function readAllEvents(): Promise<Array<EventEnvelope<string, any>>> {
  const { data, error } = await db
    .from('events')
    .select('*')
    .order('ts', { ascending: true });

  if (error) throw error;
  return (data as StoredEventRow[]).map(mapRowToEvent);
}

/**
 * Helper to generate ISO timestamps consistently.
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Convenience wrapper around the raw functions.
 */
export function createEventStore(): {
  append: <TType extends string, TPayload extends Json>(input: Omit<EventEnvelope<TType, TPayload>, "id" | "ts"> & Partial<Pick<EventEnvelope<TType, TPayload>, "id" | "ts">>) => Promise<EventEnvelope<TType, TPayload>>;
  getEvents: (aggregateId: string, aggregateType?: string) => Promise<Array<EventEnvelope<string, any>>>;
  getEventsByType: (type: string) => Promise<Array<EventEnvelope<string, any>>>;
  getAllEvents: () => Promise<Array<EventEnvelope<string, any>>>;
} {
  return {
    async append(input) {
      const event: EventEnvelope<any, any> = {
        id: input.id ?? crypto.randomUUID(),
        type: input.type,
        ts: input.ts ?? nowIso(),
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        correlationId: input.correlationId,
        causationId: input.causationId,
        payload: input.payload,
      };

      await appendEvent(event);
      return event;
    },
    async getEvents(aggregateId, aggregateType) {
      return readEventsByAggregate({ aggregateId, aggregateType });
    },
    async getEventsByType(type) {
      return readEventsByType(type);
    },
    async getAllEvents() {
      return readAllEvents();
    },
  };
}
