# Learning Track (File-by-File)

This document is the “what to learn next” checklist for this repo. Keep it updated as you iterate.

## Mental Model

- **Event log (`events`)** is truth.
- **Projections** are caches/materialized views (delete + rebuild).
- **Agents** propose.
- **Policies** gate.
- **Humans** decide (explicit events).
- **Executors** do dumb side effects after authorization.

If you’re unsure where logic goes:
- Fact → event
- Rule → policy gate
- Side effect → execution

## How To Interact (DevTools / cURL)

### Trigger stock changes
```bash
curl -X POST 'http://localhost:3001/api/stock-level-changed' \
  -H 'content-type: application/json' \
  -d '{"productId":"milk","delta":-3,"reason":"SALE","threshold":10}'
```

### Inspect events (audit)
```bash
curl 'http://localhost:3001/api/events?productId=milk'
curl 'http://localhost:3001/api/events?type=HumanDecisionRecorded'
```

### Inspect action workflow state
```bash
curl 'http://localhost:3001/api/actions/pending?status=NEEDS_HUMAN_REVIEW'
curl 'http://localhost:3001/api/actions/pending?status=EXECUTED'
```

### Approve / reject as a human
```bash
curl -X POST 'http://localhost:3001/api/human-decision' \
  -H 'content-type: application/json' \
  -d '{"actionId":"<ACTION_ID>","decision":"approve","humanId":"owner-1"}'
```

### Rebuild projections from scratch
```bash
pnpm replay
```

## File Walkthrough Order

### 1) `server/core/db.ts`
Goal:
- Understand which tables are “truth” vs “derived”.
Checklist:
- `events` is immutable truth.
- `stock_levels`, `product_prices`, `action_state`, `daily_price_changes` are projections.

### 2) `server/core/eventStore.ts`
Goal:
- See how the only write path into the event log works.
Checklist:
- Payload stored as JSON.
- Query by type / aggregate.
- `correlationId` + `causationId` support tracing.

### 3) `server/projectors/stockProjection.ts`
Goal:
- Understand “state derived from events”.
Checklist:
- Projection updated on `StockLevelChanged`.
- Rebuild reads only from the event log.

### 4) `server/agents/recommendationAgent.ts`
Goal:
- Understand “agents propose only”.
Checklist:
- Agent reads projections / context.
- Agent emits `ActionProposed` only (no direct DB state mutation).
- Agent includes confidence + reason + experiment metadata.

### 5) `server/policies/*.ts`
Goal:
- Understand deterministic invariants as independent gates.
Checklist:
- Confidence gate routes to human review.
- Business rules gate enforces constraints.
- Coordination gate suppresses conflicts (e.g., daily price change).

### 6) `server/core/workflow.ts`
Goal:
- Understand orchestration: event ingress → proposals → gates → execution.
Checklist:
- Every decision becomes an event (`ActionRejected`, `ActionSuppressed`, `ActionAuthorized`, etc.).
- Execution happens only after `ActionAuthorized`.
- Human approvals create `HumanDecisionRecorded` and then authorization/execution.

### 7) `server/api/*.ts`
Goal:
- HTTP is only ingress/query.
Checklist:
- No business rules inside routes.
- Routes call core modules and return data.

### 8) `scripts/replay.mjs`
Goal:
- Verify replayability.
Checklist:
- Deletes projections only, never touches `events`.
- Rebuild derives projections solely from events.

## Next “Learning by Doing” Tasks

Pick one at a time:

1) Add a Nuxt admin UI
- View `NEEDS_HUMAN_REVIEW` actions
- Approve/reject via events
- Show event timeline per product/action

2) Add a new policy gate (one invariant)
- Example: suppress reorder if reorder already executed in last N hours
- Must be deterministic based on event history or projections derived from it

3) Swap heuristic agent for an LLM
- Keep `ActionProposed` event shape
- Do not move invariants into the prompt

4) Add analytics projection
- Count proposals per experiment/variant
- Approval rates over time
- No impact on core flow (read-only projections)

