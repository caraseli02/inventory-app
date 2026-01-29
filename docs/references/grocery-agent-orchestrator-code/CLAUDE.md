# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

This is a **learn-by-doing project** to master **workflow orchestration in the AI era** by building a production-grade event-sourced system. The goal is to learn to think like:

- **A Systems Designer** - architecting reliable, auditable systems
- **A Protocol Designer** - defining clear contracts between components
- **A Control Engineer** - implementing deterministic gates and feedback loops

### The Five Dimensions of AI Workflow Orchestration

This project teaches workflow orchestration through five interconnected dimensions:

#### 1. **Product Management** 🎯
**What problem are we solving? What features do users need?**

In our system:
- **Problem**: Grocery inventory needs intelligent automation but can't be fully autonomous
- **Features**:
  - Auto price adjustments when stock is low/high
  - Reorder suggestions when inventory runs low
  - Human oversight for critical decisions
  - Analytics dashboard for business insights
- **Prioritization**: Start with price changes (lower risk), add reorder policy (higher risk), then analytics

**Key Lesson**: AI agents solve real problems, not technology for technology's sake.

#### 2. **Spec Creation** 📋
**What are the contracts? What are the rules?**

In our system:
- **Event Specs**: `StockLevelChanged`, `ActionProposed`, `PriceChanged` - immutable contracts
- **Policy Specs**:
  - Confidence < 0.7 → requires human review
  - Delta > 500 cents → rejected (business rule)
  - One price change per product per day (coordination)
- **API Specs**: What each endpoint accepts/returns
- **Type Definitions**: `server/core/types.ts` - Zod schemas for validation

**Key Lesson**: Clear specs enable independent development and testing.

#### 3. **Systems Architecture** 🏗️
**How do components interact? What are the guarantees?**

In our system:
- **Event Sourcing**: Events are truth, projections are views
- **CQRS**: Write model (events) separate from read models (projections)
- **Separation of Concerns**:
  - Agents **propose** (never decide)
  - Policies **decide** (pure functions)
  - Executors **act** (side effects only)
- **Multiple Consumers**: Main workflow + analytics consumer reading same events
- **Deterministic Flow**: Same events → same state (replayability)

**Key Lesson**: Good architecture makes systems predictable and debuggable.

#### 4. **Context Engineering** 🧠
**What information does each component need to make good decisions?**

In our system:
- **Agent Context**:
  - Current stock level: `quantity: 45`
  - Current price: `priceCents: 199`
  - Historical velocity: `avgPerDay: 20.0`
  - Business constraints: `threshold: 10`
- **Policy Context**:
  - Confidence score: `confidence: 0.65`
  - Proposed delta: `delta: -50`
  - Coordination state: "Already changed price today?"
- **Human Context**:
  - Proposal with reasoning: "Stock low (45 units), suggest price decrease"
  - Confidence level for risk assessment
  - Historical performance of agent

**Key Lesson**: AI is only as good as its context. Garbage in = garbage out.

#### 5. **Workflow Orchestration** ⚙️ (CORE)
**How do all the pieces flow together? Who controls what happens when?**

In our system (`server/core/workflow.ts`):
```
Event Ingestion → Projection Updates → Agent Proposals → Policy Gates → Authorization → Execution
       ↓                 ↓                    ↓                ↓              ↓            ↓
   (Fact)          (Derived State)      (AI Suggests)   (Rules Check)  (Approved)  (Side Effect)
```

**Policy Gates (Sequential):**
1. **Confidence Gate**: Low confidence → human review
2. **Reorder Gate**: All reorders → human review (business policy)
3. **Business Rules Gate**: Invalid values → rejected
4. **Coordination Gate**: Already changed today → suppressed

**Human-in-the-Loop:**
- Humans review at specific gates (not everywhere)
- Decisions recorded as events (auditable)
- System continues with or without human (graceful degradation)

**Key Lesson**: Orchestration is about control flow, error handling, and human oversight.

### How This Maps to "Designing Event-Driven Systems"

The book provides the **technical foundation** (Parts I-III), and we apply it to **AI workflow orchestration**:

- **Part I-II**: Event sourcing, CQRS → enables replayability and auditability (critical for AI)
- **Part III**: Multiple consumers → analytics separated from operational workflow
- **Our Addition**: Policy gates + human-in-the-loop → safe AI automation

### Book Progress

| Part | Topic | Status |
|------|-------|--------|
| Part I | Kafka & Stream Processing Fundamentals | ✅ Concepts understood |
| Part II | Event Sourcing, CQRS, Event Collaboration | ✅ **Currently here** - fully implemented |
| Part III | Organization-level patterns, Events as Source of Truth | 🔄 Partially explored |
| Part IV | Consistency, Concurrency, Transactions | ⬜ Not yet covered |
| Part V | Kafka Streams & Production Code | ⬜ Not yet (using SQLite currently) |

### What We've Built (Mapped to the Five Dimensions)

#### **Product Management** → Features Delivered
- ✅ Automated price adjustments based on stock levels
- ✅ Reorder suggestions with human approval
- ✅ Event log for complete auditability
- ✅ Time-travel debugging for investigating issues
- ✅ Analytics dashboard for business insights

#### **Spec Creation** → Contracts & Rules
- ✅ 8 event types with Zod validation (`server/core/types.ts`)
- ✅ 4 policy specifications (confidence, reorder, business rules, coordination)
- ✅ 13 API endpoints with clear input/output contracts
- ✅ Database schema documenting truth vs derived state

#### **Systems Architecture** → Components & Patterns
- ✅ Event store (`server/core/eventStore.ts`) - append-only log
- ✅ Main workflow consumer (`server/core/workflow.ts`) - operational projections
- ✅ Analytics consumer (`server/consumers/analyticsConsumer.ts`) - independent projections
- ✅ Recommendation agent (`server/agents/recommendationAgent.ts`) - proposals only
- ✅ 4 policy modules (`server/policies/*.ts`) - pure decision functions
- ✅ Projectors (`server/projectors/*.ts`) - derive state from events

#### **Context Engineering** → Information Design
- ✅ Agent receives: stock levels, prices, velocity, thresholds
- ✅ Policies receive: confidence scores, delta values, coordination state
- ✅ Humans receive: proposals with reasoning, confidence, historical performance
- ✅ Analytics dashboard: velocity, health, performance, latency

#### **Workflow Orchestration** → Control Flow
- ✅ Event ingestion → projection updates → agent proposals
- ✅ 4 sequential policy gates with clear pass/fail outcomes
- ✅ Human-in-the-loop at specific gates (not blocking entire flow)
- ✅ Execution after authorization with immutable audit trail
- ✅ Graceful degradation (system works with or without humans online)

#### **User Interface** (Product Delivery)
- ✅ Dashboard - current stock levels
- ✅ Events - filterable event log
- ✅ Pending Actions - human review interface
- ✅ Time Travel - historical state debugging
- ✅ Sales - daily aggregation reports
- ✅ Analytics - velocity, health, performance, latency

#### **Testing** (Quality Assurance)
- ✅ 13 policy tests - verify decision logic
- ✅ 13 projection tests - verify state derivation
- ✅ 15 analytics tests - verify independent consumer
- ✅ All tests use in-memory SQLite for speed
- ✅ Tests demonstrate concepts, not just coverage

### Implementation Principles

This is an **educational codebase** where every design decision teaches a concept:

1. **Simplicity over optimization** - Understand first, optimize later
2. **Clear patterns over abstraction** - See the pattern before abstracting it
3. **Comments explain "why"** - Code shows "how", comments explain "why"
4. **Tests as documentation** - Tests show expected behavior
5. **Separation of concerns** - Each module has one job
6. **Deterministic flow** - Same inputs → same outputs (testable, debuggable)

**When extending this project:**
- Prioritize **understanding** over features
- Each addition should demonstrate a new concept from:
  - The book (event-driven patterns)
  - AI orchestration (context, gates, human-in-the-loop)
  - One of the five dimensions

## Development Commands

### Development Server
```bash
pnpm dev
```
Starts the Nuxt development server with hot reload. Default port: 3000.

### Testing
```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui
```
Tests use Vitest. Focus on policy and projection tests.

### Replay/Rebuild Projections
```bash
# Rebuild all projections from event log
pnpm replay

# Rebuild specific DB file
pnpm replay -- --db /path/to/db
```
Critical for event sourcing: deletes derived state and rebuilds from immutable events.

### Build
```bash
pnpm build
```

### Database Configuration
Override default DB location:
```bash
GROCERY_DB_PATH=/path/to/db pnpm dev
```

## Architecture Overview

### Event Sourcing Fundamentals

This is an **event-sourced** system where:
- The `events` table is the **single source of truth** (immutable)
- All other tables (`stock_levels`, `product_prices`, `action_state`, `daily_price_changes`, `daily_sales`) are **projections** (derived, rebuildable)
- State changes are facts (events), not mutations
- Same event history → same derived outcomes (replayability)

**Core Principle:** Fact → Event, Rule → Policy gate, Execution → Dumb side-effect

### Workflow Orchestration (server/core/workflow.ts)

The system follows a strict event → policy → execution flow:

1. **Event Ingestion**: `StockLevelChanged` event appended to immutable log
2. **Projection Updates**: Derived tables updated from events
3. **Agent Proposals**: Agent emits `ActionProposed` events (never mutates state directly)
4. **Policy Gates** (run in order):
   - Confidence Policy: Low confidence → `ActionRequiresHumanReview`
   - Reorder Policy: ALL reorders → `ActionRequiresHumanReview`
   - Business Rules Policy: Invalid values → `ActionRejected`
   - Coordination Policy: Daily limits → `ActionSuppressed`
5. **Authorization**: Passed gates → `ActionAuthorized`
6. **Execution**: Authorized actions execute and emit outcome events (`ReorderPlaced`, `PriceChanged`)

**Human decisions** are first-class events (`HumanDecisionRecorded`) that feed back into authorization.

### Event Store (server/core/eventStore.ts)

- **Append-only** event log
- Events stored as JSON payloads
- `correlationId` and `causationId` support event tracing
- Query by type, aggregate, or all events
- Never update or delete events (immutable truth)

### Key Data Flow Invariants

1. **Agents propose only** (server/agents/recommendationAgent.ts):
   - Read projections/context
   - Emit `ActionProposed` with confidence + reasoning
   - NEVER mutate database state directly

2. **Policies are deterministic gates** (server/policies/*.ts):
   - Pure functions, no side effects
   - One policy = one invariant
   - Easy to test independently
   - Each returns simple ok/not-ok decision

3. **Projections are rebuildable** (server/projectors/*.ts):
   - Update when relevant events occur
   - Can be deleted and rebuilt via `pnpm replay`
   - Never the source of truth

### Critical Architectural Rules

When modifying or extending this codebase:

1. **Never bypass the event log**: All state changes must be events
2. **Keep policies pure**: No I/O, no randomness, no timestamps inside policy logic
3. **One policy, one invariant**: Don't combine multiple business rules in one gate
4. **Agents never decide**: They propose with confidence/reasoning; policies gate
5. **Execution is dumb**: No business logic in executors, only side effects after authorization
6. **Humans are part of the event stream**: Human decisions are events, not database updates

### Database Schema (server/core/db.ts)

**Source of Truth:**
- `events`: Immutable event log (id, type, ts, aggregate_type, aggregate_id, correlation_id, causation_id, payload)

**Projections (Rebuildable):**
- `stock_levels`: Current stock per product
- `product_prices`: Current prices per product
- `action_state`: Action workflow status (PROPOSED, NEEDS_HUMAN_REVIEW, AUTHORIZED, REJECTED, SUPPRESSED, EXECUTED)
- `daily_price_changes`: Price change coordination (one per product per day)
- `daily_sales`: Aggregated sales/delivery metrics per product per day

### Event Types

**Core Events:**
- `StockLevelChanged`: Stock delta from sale/delivery/adjustment
- `ActionProposed`: Agent recommendation with confidence
- `ActionRequiresHumanReview`: Low confidence or policy-required review
- `ActionAuthorized`: Passed all gates
- `ActionRejected`: Failed business rule
- `ActionSuppressed`: Coordination constraint (e.g., already changed price today)
- `HumanDecisionRecorded`: Human approved/rejected action
- `ReorderPlaced`: Inventory order executed
- `PriceChanged`: Price update executed

### Testing Strategy

- **Policy tests** (tests/policies.test.ts): Pure function tests, no database needed
- **Projection tests** (tests/projections.test.ts): Event replay validation
- Test boundary conditions (threshold values)
- Verify determinism (same events → same state)

## API Endpoints

All endpoints are in `server/api/`:

- `POST /api/stock-level-changed`: Trigger workflow (body: `{productId, delta, reason, threshold?}`)
- `GET /api/events?productId=<id>`: Query events by product
- `GET /api/events?type=<EventType>`: Query events by type
- `GET /api/actions/pending?status=<STATUS>`: Query actions by status
- `POST /api/human-decision`: Human approve/reject (body: `{actionId, decision, humanId}`)
- `GET /api/products/[productId]/stock`: Get current stock level
- `GET /api/sales`: Get sales projections
- `GET /api/state-at-time`: Time-travel debugging

## Frontend (Nuxt 3)

- Pages in `app/pages/`: index.vue, actions.vue, events.vue, time-travel.vue, sales.vue
- Tailwind CSS for styling
- Interactive UI for viewing events, approving actions, and time-travel debugging

## Common Development Patterns

### Adding a New Policy Gate

1. Create pure function in `server/policies/newPolicy.ts`
2. Add test in `tests/policies.test.ts`
3. Import and call in `server/core/workflow.ts` (in policy gate sequence)
4. Emit appropriate event based on policy result

### Adding a New Event Type

1. Define payload schema in `server/core/types.ts` with Zod
2. Update `server/core/workflow.ts` to handle the event
3. Update projections if event affects derived state
4. Update `scripts/replay.mjs` if new projection needed
5. Add tests in `tests/projections.test.ts`

### Adding a New Projection

1. Create projector module in `server/projectors/`
2. Add table schema in `server/core/db.ts`
3. Call projector from `server/core/workflow.ts` when events occur
4. Add rebuild logic in `scripts/replay.mjs`
5. Test via `pnpm replay` to verify rebuildability

### Debugging Event Flow

1. Query events: `GET /api/events?productId=<id>` or `?type=<EventType>`
2. Use `correlationId` and `causationId` to trace event chains
3. Rebuild projections: `pnpm replay` (verify determinism)
4. Use time-travel UI: `/time-travel` page

## Environment Variables

- `GROCERY_DB_PATH`: SQLite database file path (default: `grocery.db`)

## Deep-Dive Documentation

All detailed explanations are saved in `docs/deep-dive/` for reference. This documentation approach ensures:

1. **Persistent Learning** - Explanations are saved, not lost in conversation
2. **Structured Path** - Follow files in order (00-12) for complete understanding
3. **Five Dimensions** - Each file connects concepts to the orchestration framework

### Documentation Files

| File | Topic |
|------|-------|
| `00-overview.md` | Index and learning path |
| `01-core-architecture.md` | Event sourcing fundamentals |
| `02-database-schema.md` | Source of truth vs projections |
| `03-event-types.md` | Event definitions and contracts |
| `04-workflow-orchestration.md` | The heart of the system |
| `05-policy-gates.md` | Decision points and rules |
| `06-projectors.md` | Derived state from events |
| `07-recommendation-agent.md` | AI proposal generation |
| `08-api-endpoints.md` | HTTP interface layer |
| `09-ui-pages.md` | User interface and interactions |
| `10-analytics-consumer.md` | Independent event consumer |
| `11-test-strategy.md` | Testing patterns and examples |
| `12-scripts-utilities.md` | Replay and helper scripts |

### Using the Documentation

```bash
# Read the overview
cat docs/deep-dive/00-overview.md

# Follow the learning path
ls docs/deep-dive/
```

Each file includes:
- Code examples with line numbers
- Architectural diagrams (ASCII)
- Connection to the five dimensions
- Mental models for understanding
