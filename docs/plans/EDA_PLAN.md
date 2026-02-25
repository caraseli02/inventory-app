# Event-Driven Architecture (EDA) Upgrade Plan for Inventory App

This plan outlines the steps to integrate Event-Driven Architecture concepts from the `grocery-agent-orchestrator` project and the "Designing Event-Driven Systems" book into the existing `inventory-app`.

## Core Concept
Shift the system's "Source of Truth" from the current state (tables like `products`, `stock_movements`) to an **Append-Only Event Log**.

- **Current (CRUD):** Update `products` table -> State is overwritten. History is lost (except for what `stock_movements` captures).
- **Target (EDA):** Append `ProductPriceChanged` event -> State is derived. Full audit trail is preserved.

## Phase 1: Foundation (The Event Store)
**Goal:** Establish the infrastructure to record immutable events.

1.  **Database Schema Update**:
    -   Create an `events` table in Supabase.
    -   Columns: `id`, `type`, `ts` (timestamp), `aggregate_type`, `aggregate_id`, `correlation_id`, `causation_id`, `payload` (JSONB).
    -   This mirrors the `grocery-agent-orchestrator` structure.

2.  **Code Infrastructure**:
    -   Create `src/lib/event-store/` directory.
    -   **`types.ts`**: Define `EventEnvelope` and domain event schemas (Zod).
    -   **`store.ts`**: Implement the `EventStore` class/functions to read/write to the Supabase `events` table.

## Phase 2: Domain Events & Migration
**Goal:** Start modeling business actions as events.

1.  **Define Key Events**:
    -   `ProductCreated`
    -   `StockLevelChanged` (can eventually replace `stock_movements` table logic)
    -   `ProductUpdated` (covers price, name changes)

2.  **Refactor "Add Product"**:
    -   Currently: `INSERT INTO products`.
    -   New Path:
        1.  Create `ProductCreated` event.
        2.  Append to `events` table.
        3.  (Ideally) A Supabase Database Trigger or Edge Function listens to the event and inserts into `products` (Read Model).
        4.  *Interim Step:* Client writes to both `events` and `products` to ensure the app keeps working while we build the backend consumers.

## Phase 3: Reactive Features (The "Agent" Part)
**Goal:** Use events to trigger intelligent actions (like in `grocery-agent-orchestrator`).

1.  **Low Stock Reactor**:
    -   Listen for `StockLevelChanged`.
    -   If new level < threshold, emit `LowStockDetected`.
    -   Trigger an alert or an automatic reorder suggestion (the "Agent").

2.  **Audit Log UI**:
    -   Add a "History" tab to the Product Detail view.
    -   Fetch and display the stream of events for that product.

## Next Immediate Steps
1.  Generate the SQL for the `events` table.
2.  Create the `EventStore` client code in `inventory-app`.
