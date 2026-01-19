/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../supabase';
import type { EventEnvelope } from './types';

/**
 * # Event Store (Event Log Access Layer)
 *
 * This is the wrapper around the Supabase `events` table.
 * It handles the "Append-Only" log logic.
 */

// Helper to get consistent ISO timestamp
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Append one immutable event to the event log.
 */
export async function appendEvent<TType extends string, TPayload>(
  event: EventEnvelope<TType, TPayload>
): Promise<void> {
  const { error } = await supabase.from('events').insert({
    id: event.id,
    type: event.type,
    ts: event.ts,
    aggregate_type: event.aggregateType,
    aggregate_id: event.aggregateId,
    correlation_id: event.correlationId ?? null,
    causation_id: event.causationId ?? null,
    payload: event.payload as any, // Cast to any to satisfy Supabase Json type if needed
  });

  if (error) {
    throw new Error(`Failed to append event ${event.type}: ${error.message}`);
  }
}

/**
 * Read all events of a given type.
 */
export async function readEventsByType(type: string): Promise<Array<EventEnvelope<string, unknown>>> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('type', type)
    .order('ts', { ascending: true });

  if (error) {
    throw new Error(`Failed to read events by type ${type}: ${error.message}`);
  }

  return (data || []).map(mapRowToEvent);
}

/**
 * Read events for a particular aggregate.
 */
export async function readEventsByAggregate(input: {
  aggregateId: string;
  aggregateType?: string;
}): Promise<Array<EventEnvelope<string, unknown>>> {
  let query = supabase.from('events').select('*').eq('aggregate_id', input.aggregateId);

  if (input.aggregateType) {
    query = query.eq('aggregate_type', input.aggregateType);
  }

  const { data, error } = await query.order('ts', { ascending: true });

  if (error) {
    throw new Error(`Failed to read events for aggregate ${input.aggregateId}: ${error.message}`);
  }

  return (data || []).map(mapRowToEvent);
}

/**
 * Read the entire event log.
 */
export async function readAllEvents(): Promise<Array<EventEnvelope<string, unknown>>> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('ts', { ascending: true });

  if (error) {
    throw new Error(`Failed to read all events: ${error.message}`);
  }

  return (data || []).map(mapRowToEvent);
}

// Helper to map DB row to envelope
function mapRowToEvent(row: any): EventEnvelope<string, unknown> {
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
 * Convenience wrapper (Service)
 */
export function createEventStore() {
  return {
    async append<TType extends string, TPayload>(
      input: Omit<EventEnvelope<TType, TPayload>, "id" | "ts"> & Partial<Pick<EventEnvelope<TType, TPayload>, "id" | "ts">>
    ): Promise<EventEnvelope<TType, TPayload>> {
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

    getEvents(aggregateId: string, aggregateType?: string) {
      return readEventsByAggregate({ aggregateId, aggregateType });
    },

    getEventsByType(type: string) {
      return readEventsByType(type);
    },

    getAllEvents() {
      return readAllEvents();
    },
  };
}

export const eventStore = createEventStore();
