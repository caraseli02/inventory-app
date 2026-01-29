# Grocery Agent Orchestrator

A small grocery store back-office decision system using event sourcing + projections:
AI can **propose** actions, but never executes changes directly.

## Why This Exists

We want a safe way to use “AI assistance” for operational decisions (reorder, pricing) without turning the system into a chatbot or letting prompts silently mutate state.

Core rule of thumb:
- **Fact → Event**
- **Rule → Policy gate**
- **Execution → Dumb side-effect**

## Non‑Negotiables

- Events are immutable facts and the **source of truth**
- State is derived via projections (delete + rebuild any time)
- Agents only propose (with confidence + reasoning)
- Policies decide (deterministic gates, one invariant each)
- Human decisions are first‑class events
- Execution runs only after authorization
- Replayability: same event history ⇒ same derived outcomes

## Architecture (High Level)

1) `POST /api/stock-level-changed` appends `StockLevelChanged`
2) Projection updates `stock_levels`
3) Agent emits `ActionProposed` (heuristic placeholder)
4) Policy gates emit one of:
   - `ActionRequiresHumanReview`
   - `ActionRejected`
   - `ActionSuppressed`
   - `ActionAuthorized`
5) Authorized actions execute side effects and emit:
   - `ReorderPlaced`
   - `PriceChanged`
6) Humans can approve/reject via `POST /api/human-decision` which emits `HumanDecisionRecorded`

## Key Files

- `server/core/db.ts` — SQLite + schema (event log + projections)
- `server/core/eventStore.ts` — append/read the immutable event log
- `server/core/workflow.ts` — orchestrates: events → policies → execution
- `server/projectors/stockProjection.ts` — rebuildable stock projection
- `server/agents/recommendationAgent.ts` — proposal-only “AI” (placeholder)
- `server/policies/*.ts` — deterministic gates (confidence, business rules, coordination)
- `scripts/replay.mjs` — rebuild projections from events

## API Endpoints

- `POST /api/stock-level-changed`
  - Body example:
    ```json
    { "productId": "milk", "delta": -3, "reason": "SALE", "threshold": 10 }
    ```
- `GET /api/events?productId=milk`
- `GET /api/events?type=HumanDecisionRecorded`
- `GET /api/actions/pending?status=NEEDS_HUMAN_REVIEW`
- `POST /api/human-decision`
  - Body example:
    ```json
    { "actionId": "<ACTION_ID>", "decision": "approve", "humanId": "owner-1" }
    ```
- `GET /api/products/milk/stock`

## Development

```bash
pnpm install
pnpm dev
```

SQLite DB:
- Default: `grocery.db`
- Override: `GROCERY_DB_PATH=/path/to/db pnpm dev`

## Replay / Rebuild

Rebuild all projections from the immutable event log:

```bash
pnpm replay
```

To rebuild a different DB file:
```bash
pnpm replay -- --db /tmp/other.db
```

## Learning Track

See `docs/learning.md`.

