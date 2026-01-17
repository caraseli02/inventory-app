# Deep Dive Documentation

This folder contains detailed explanations of every component in the grocery-agent-orchestrator system. Each file focuses on one topic with code examples and architectural insights.

## Learning Path

Follow these files in order for a complete understanding:

| # | File | Topic | Status |
|---|------|-------|--------|
| 01 | [core-architecture.md](./01-core-architecture.md) | Event sourcing fundamentals | ✅ |
| 02 | [database-schema.md](./02-database-schema.md) | Source of truth vs projections | ✅ |
| 03 | [event-types.md](./03-event-types.md) | Event definitions and contracts | ✅ |
| 04 | [workflow-orchestration.md](./04-workflow-orchestration.md) | The heart of the system | ✅ |
| 05 | [policy-gates.md](./05-policy-gates.md) | Decision points and rules | ✅ |
| 06 | [projectors.md](./06-projectors.md) | Derived state from events | ✅ |
| 07 | [recommendation-agent.md](./07-recommendation-agent.md) | AI proposal generation | ✅ |
| 08 | [api-endpoints.md](./08-api-endpoints.md) | HTTP interface layer | ✅ |
| 09 | [ui-pages.md](./09-ui-pages.md) | User interface and interactions | ✅ |
| 10 | [analytics-consumer.md](./10-analytics-consumer.md) | Independent event consumer | ✅ |
| 11 | [test-strategy.md](./11-test-strategy.md) | Testing patterns and examples | ✅ |
| 12 | [scripts-utilities.md](./12-scripts-utilities.md) | Replay and helper scripts | ✅ |

## The Five Dimensions

Each explanation connects to the five dimensions of AI workflow orchestration:

1. **Product Management** - What problem does this solve?
2. **Spec Creation** - What are the contracts?
3. **Systems Architecture** - How do components interact?
4. **Context Engineering** - What information is needed?
5. **Workflow Orchestration** - How does control flow?

## Quick Reference

```
grocery-agent-orchestrator/
├── server/
│   ├── core/           # Foundation: db, events, workflow, types
│   ├── policies/       # Decision gates (pure functions)
│   ├── projectors/     # Derived state builders
│   ├── agents/         # AI recommendation engine
│   ├── consumers/      # Independent event processors
│   └── api/            # HTTP endpoints
├── app/
│   └── pages/          # Vue UI components
├── tests/              # Policy, projection, analytics tests
├── scripts/            # Replay and utilities
└── docs/
    └── deep-dive/      # This documentation
```
