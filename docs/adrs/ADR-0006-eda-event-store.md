# ADR-0006: EDA Event-Store Pattern Adoption

- **Status**: Accepted
- **Date**: 2026-03-17
- **Deciders**: Engineering team
- **Context**: The app's CRUD-first data model (`products`, `stock_movements`) provides no audit trail and makes reactive features (low-stock alerts, order history projection) difficult to implement without polling. A full event-sourcing model would enable append-only event log, derived read models, and reactive agent triggers.
- **Decision**: Adopt an event-store pattern via `src/lib/event-store/` and `src/lib/eda/`. Events are Zod-validated envelopes stored in a Supabase `events` table. Projectors derive read models from events. Policies trigger side effects (e.g., low-stock alerts) in response to domain events. Existing CRUD tables remain as the primary write path during a transition period (dual-write phase).
- **Consequences**:
  - Positive: Full audit trail; reactive agents can subscribe to event streams; projectors replace ad-hoc rollup queries.
  - Negative: Dual-write complexity during transition; event schema evolution requires migration care; adds cognitive overhead for contributors unfamiliar with EDA patterns.
  - Follow-ups: Migrate `stock_movements` to event-sourced projection; integrate WhatsApp `orders` into event stream; define event retention/compaction policy.
- **Alternatives Considered**:
  - Pure CRUD with Supabase Realtime triggers — rejected: no audit trail, side-effect logic mixed into mutations.
  - Third-party event bus (Kafka, Inngest) — rejected: operational overhead too high for current scale; Supabase table + Zod envelopes sufficient.
- **Reference**: `docs/plans/EDA_PLAN.md`, `src/lib/event-store/`, `src/lib/eda/`
