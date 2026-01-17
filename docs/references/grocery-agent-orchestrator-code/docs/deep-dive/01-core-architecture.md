# 01. Core Architecture - Event Sourcing Fundamentals

## The Big Picture

This system is built on **event sourcing** - a pattern where:
- **Events are facts** - immutable records of what happened
- **State is derived** - computed by replaying events
- **Everything is auditable** - complete history preserved

```
Traditional:  UPDATE products SET price = 199 WHERE id = 'milk'
                     ↓
              Current state only, history lost

Event-Sourced: APPEND event { type: "PriceChanged", oldPrice: 249, newPrice: 199 }
                     ↓
              Full history, state derived from events
```

## Why Event Sourcing for AI Systems?

AI systems need special properties that event sourcing provides:

### 1. Auditability
```
Q: "Why did the system change the milk price?"
A: Event log shows: StockLevelChanged → ActionProposed → ActionAuthorized → PriceChanged
```

### 2. Replayability
```
# Something wrong? Replay to investigate
pnpm replay  # Rebuilds all state from events
```

### 3. Determinism
```
Same events → Same state (always)
# Critical for debugging AI decisions
```

### 4. Time Travel
```
# What was the state at 2pm yesterday?
GET /api/state-at-time?ts=2024-01-15T14:00:00Z
```

## Core Components

### The Event Store (`server/core/eventStore.ts`)

```typescript
// Append-only - events are NEVER modified or deleted
export function appendEvent<T extends string, P>(event: EventEnvelope<T, P>): void {
  db.prepare(`
    INSERT INTO events (id, type, ts, aggregate_type, aggregate_id,
                        correlation_id, causation_id, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.type,
    event.ts,
    event.aggregateType,
    event.aggregateId,
    event.correlationId ?? null,
    event.causationId ?? null,
    JSON.stringify(event.payload),
  );
}
```

**Key insight**: `INSERT` only, never `UPDATE` or `DELETE`.

### Event Tracing

Events form a causal chain:

```
StockLevelChanged (id: "evt-001")
    ↓ causationId
ActionProposed (id: "evt-002", causationId: "evt-001")
    ↓ causationId
ActionAuthorized (id: "evt-003", causationId: "evt-002")
    ↓ causationId
PriceChanged (id: "evt-004", causationId: "evt-003")
```

`correlationId` groups related events:
```
All events for product "milk" share correlationId: "product:milk"
```

## The Invariant

**All state changes are represented as events.**

This means:
- ❌ No direct database updates
- ❌ No "just update this one field"
- ✅ Emit event → projections update → state changes

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | Audit trail = customer trust, regulatory compliance |
| **Spec Creation** | Events are contracts between components |
| **Systems Architecture** | Append-only log enables multiple consumers |
| **Context Engineering** | Full history provides rich context for decisions |
| **Workflow Orchestration** | Events drive the entire control flow |

## Key Files

- `server/core/eventStore.ts` - Append and query events
- `server/core/db.ts` - Database schema (events table)
- `server/core/types.ts` - Event type definitions

## Mental Model

Think of events as a **journal**:
- You write entries (events) chronologically
- You never erase or modify past entries
- Current state = reading the journal from start to now
- Want state at a past time? Read journal up to that point
