import { createEventStore } from "~~/server/core/eventStore";

/**
 * # Events Query (HTTP)
 *
 * Read-only endpoint that exposes the immutable event log.
 *
 * Query modes:
 * - ?productId=...  → events for that aggregateId (product stream)
 * - ?type=...       → events by event type
 * - no filters      → full event log (use with care)
 *
 * This is the main audit/debug interface for the system.
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const { productId, type, limit = "100" } = query;
  const eventStore = createEventStore();

  // Pick the read strategy based on filters.
  let events;
  if (productId) {
    events = eventStore.getEvents(productId as string);
  } else if (type) {
    events = eventStore.getEventsByType(type as string);
  } else {
    events = eventStore.getAllEvents();
  }

  // Apply limit defensively (API layer only; event store remains full fidelity).
  events = events.slice(0, parseInt(limit as string));

  return {
    events,
    count: events.length,
  };
});
