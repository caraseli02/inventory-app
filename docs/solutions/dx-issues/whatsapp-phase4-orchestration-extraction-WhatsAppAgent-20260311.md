---
module: WhatsAppAgent
date: 2026-03-11
problem_type: developer_experience
component: api_client
symptoms:
  - "`api/whatsapp.ts` still contained prompt-building, provider orchestration, and simulator-specific logic after the phase 3 domain extraction"
  - "The local simulator and Vite dev middleware still depended on the main webhook module instead of an explicit simulator boundary"
  - "Phase 5 thin-route cleanup could not proceed cleanly while route, LLM, and simulator concerns were still intertwined"
root_cause: logic_error
resolution_type: refactor
severity: medium
tags: [whatsapp, twilio, refactor, llm, simulator, prompts, orchestration, developer-experience]
related_github_issue: null
commit: null
---

# Problem Description

After the helper and domain extractions, the WhatsApp stack was still stuck with one major boundary collapse: `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts` still owned prompt assembly, provider retry/fallback wiring, shared conversation-turn orchestration, and local simulator behavior.

That meant the route file was smaller, but not truly route-focused. It also meant the simulator still depended on the webhook entrypoint incidentally instead of through a clear shared orchestration seam.

# Symptoms

- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts` still defined `buildReplyWithPending()`, `buildSimulatorReply()`, `buildLocalSimulationReply()`, `runConversationTurn()`, and `buildSystemPrompt()`.
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts` imported simulator behavior from the webhook route module.
- The local simulator path in `/Users/vladislavcaraseli/Documents/inventory-app/vite.config.ts` also loaded `/api/whatsapp.ts` directly for simulator behavior.
- Phase 4 in `/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md` could not honestly be marked complete while simulator-only and prompt/LLM concerns were still inside the route file.

# Root Cause Analysis

Phase 3 intentionally stopped at deterministic domain extraction. That left one more high-coupling seam intact: orchestration.

The underlying problem was not just remaining file size. The real issue was that multiple runtime roles still shared the same module:

- the webhook route entrypoint
- prompt construction
- Anthropic/OpenAI provider wiring and retry behavior
- the shared turn pipeline used by production and simulator flows
- simulator-only local reply composition

As long as these lived together, the route could not become a thin entrypoint and the simulator could not depend on shared logic intentionally.

```typescript
// ❌ BEFORE
// api/whatsapp.ts still mixed route handling with orchestration helpers:
async function buildReplyWithPending(phone: string, name: string, text: string) { ... }
async function buildSimulatorReply(phone: string, name: string, text: string) { ... }
async function buildLocalSimulationReply(phone: string, name: string, text: string) { ... }
async function runConversationTurn(args: ...) { ... }
function buildSystemPrompt(name: string, phone: string, inventoryText: string) { ... }
```

# Solution

Phase 4 extracted prompt, LLM, and simulator orchestration into dedicated modules, then rewired both the production route and local simulator paths to consume them directly.

## 1) Extract prompt construction

Added `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts`.

This module now owns `buildSystemPrompt()` and isolates the WhatsApp system prompt from route concerns.

## 2) Extract shared LLM orchestration

Added `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts`.

This module now owns:

- `runConversationTurn()`
- `buildReplyWithPending()`
- provider-specific simulator turn builders
- Anthropic retry/overload handling
- local generated simulator reply composition

That moved the core conversation-turn orchestration out of the webhook route and into a reusable boundary.

```typescript
// ✅ AFTER
import { buildReplyWithPending } from '../lib/whatsapp/llm.js';
```

## 3) Extract simulator composition

Added `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts`.

This module now owns:

- `buildLocalSimulationReply()`
- `buildSimulatorReply()`
- local `ORDER:` payload coercion for direct simulator testing
- provider fallback selection for simulator mode

That keeps simulator-only behavior out of the production route.

## 4) Rewire route and simulator entrypoints

Updated:

- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/vite.config.ts`

The production route now imports only the orchestration entrypoint it needs, while the simulator route and local Vite middleware import simulator/state modules directly instead of routing through `api/whatsapp.ts`.

## 5) Retarget tests and plan tracking

Updated:

- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-simulate.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md`

The simulator unit test now mocks the extracted simulator module directly, and the plan was updated only after the implementation and verification were complete.

## 6) Verify behavior stayed stable

Ran:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm vitest run tests/unit/api/whatsapp-conversation-state.test.ts tests/unit/api/whatsapp-webhook.test.ts tests/unit/api/whatsapp-simulate.test.ts tests/unit/whatsappAgent.test.ts tests/unit/whatsappInventory.test.ts`
- `pnpm vitest run tests/integration/whatsapp-agent.test.ts`

All passed.

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/vite.config.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-simulate.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md`

# Prevention

- [x] Split route, domain, and orchestration layers in separate phases instead of one broad rewrite
- [x] Make simulator consumers import simulator modules directly, not through the webhook route
- [x] Keep Vercel route files small enough that transport and response behavior are readable at a glance
- [x] Rewire tests to the new module seam as part of the same extraction
- [ ] Add direct unit tests for `lib/whatsapp/prompts.ts`, `lib/whatsapp/llm.ts`, and `lib/whatsapp/simulator.ts` instead of relying only on route/integration coverage
- [ ] Keep the architecture note in `docs/whatsapp_agent_overview.md` aligned with the new module ownership

# Related Documentation

- See also: [whatsapp-phase1-helper-extraction-WhatsAppAgent-20260311.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/dx-issues/whatsapp-phase1-helper-extraction-WhatsAppAgent-20260311.md)
- See also: [whatsapp-phase3-domain-extraction-WhatsAppAgent-20260311.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/dx-issues/whatsapp-phase3-domain-extraction-WhatsAppAgent-20260311.md)
- See also: [twilio-webhook-forged-requests-whatsapp-webhook-20260304.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md)
- See also: [vercel-serverless-api-types-not-checked-local-ci-Vercel-20260311.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/build-errors/vercel-serverless-api-types-not-checked-local-ci-Vercel-20260311.md)
