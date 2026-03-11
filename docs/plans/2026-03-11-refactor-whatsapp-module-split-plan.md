---
title: "refactor: Split WhatsApp webhook into focused modules"
type: refactor
date: 2026-03-11
origin:
  - docs/brainstorms/2026-03-11-whatsapp-template-led-assistant-brainstorm.md
  - docs/specs/whatsapp_agent.md
  - api/whatsapp.ts
---

# refactor: Split WhatsApp webhook into focused modules

## Overview

Refactor [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) from a single 1,871-line mixed-responsibility serverless file into a small route entrypoint plus focused modules with explicit boundaries.

The goal is not a cosmetic cleanup. The goal is to support the chosen product shape:

- freeform first
- Twilio template-led followups
- deterministic transactional core

This refactor should make the WhatsApp stack easier to secure, test, and evolve without changing the current end-user behavior during the first pass.

## Problem Statement / Motivation

Current [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) mixes:

- Twilio webhook validation and request parsing
- TwiML and Twilio REST transport
- simulator-only behavior
- Supabase client creation and persistence
- conversation history state
- pending-order state
- LLM provider orchestration
- prompt building
- intent classification
- deterministic follow-up parsing
- order item resolution and order creation
- inventory summary generation

This causes concrete risk:

- security-sensitive code is adjacent to prompt and parsing logic
- simulator concerns can leak into webhook concerns
- pending-order bugs are harder to isolate
- tests depend on `__private__` exports from one large file
- template-led flow expansion will make the file worse unless boundaries are fixed now

Relevant current learnings and open issues:

- atomic conversation append already required an RPC pattern: [`docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md)
- Twilio signature verification is a hard requirement: [`docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md)
- several pending WhatsApp todos are easier only after a split:
  - [`todos/077-pending-p1-pending-order-column-missing-migration.md`](/Users/vladislavcaraseli/Documents/inventory-app/todos/077-pending-p1-pending-order-column-missing-migration.md)
  - [`todos/078-pending-p1-getpendingorder-non-atomic-duplicate-orders.md`](/Users/vladislavcaraseli/Documents/inventory-app/todos/078-pending-p1-getpendingorder-non-atomic-duplicate-orders.md)
  - [`todos/079-pending-p1-prompt-injection-profilename-phone-in-system-prompt.md`](/Users/vladislavcaraseli/Documents/inventory-app/todos/079-pending-p1-prompt-injection-profilename-phone-in-system-prompt.md)
  - [`todos/081-pending-p2-stale-pending-order-no-expiry.md`](/Users/vladislavcaraseli/Documents/inventory-app/todos/081-pending-p2-stale-pending-order-no-expiry.md)
  - [`todos/084-pending-p2-buttonpayload-no-allowlist.md`](/Users/vladislavcaraseli/Documents/inventory-app/todos/084-pending-p2-buttonpayload-no-allowlist.md)
  - [`todos/085-pending-p2-twiliowebhookurl-signature-bypass-documentation.md`](/Users/vladislavcaraseli/Documents/inventory-app/todos/085-pending-p2-twiliowebhookurl-signature-bypass-documentation.md)

## Research Summary

### Internal references

- Route entry and orchestration hotspot:
  - [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts)
- Supporting endpoints already separate:
  - [`api/whatsapp-simulate.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts)
  - [`api/whatsapp-notify.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-notify.ts)
- Existing Twilio signature helper:
  - [`api/lib/twilio-signature.js`](/Users/vladislavcaraseli/Documents/inventory-app/api/lib/twilio-signature.js)
- Existing RPC precedent:
  - [`supabase/migrations/20260305153000_conversation_history_append_rpc.sql`](/Users/vladislavcaraseli/Documents/inventory-app/supabase/migrations/20260305153000_conversation_history_append_rpc.sql)
- Existing tests coupled to large-file internals:
  - [`tests/unit/api/whatsapp-webhook.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts)
  - [`tests/unit/whatsappAgent.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappAgent.test.ts)
  - [`tests/unit/whatsappInventory.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappInventory.test.ts)
  - [`tests/integration/whatsapp-agent.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/integration/whatsapp-agent.test.ts)

### External references

- Twilio webhook request validation:
  - [Twilio Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- Twilio content/template-driven messaging:
  - [Twilio Content Types Overview](https://www.twilio.com/docs/content/content-types-overview)
- Structured-output guidance for LLM boundaries:
  - [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)

### Planning implications

- Security and transport code should be isolated and fail closed before any LLM or DB work.
- Template sending should be a dedicated transport capability, not mixed into order logic.
- Deterministic state transitions should live in separate modules from prompt building.
- The simulator should reuse shared domain logic, but its route-specific auth and response handling should stay out of the webhook route.

## Proposed Solution

Do this as a sequence of small refactors, not one broad rewrite.

Start with the smallest safe extraction:

- pure transport helpers
- URL/request-normalization helpers
- shared types

Do not split persistence or orchestration in the first pass.

Create a `lib/whatsapp/` module tree gradually and reduce [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) in mergeable steps.

### Incremental target split

#### 1. Route / request boundary

- `api/whatsapp.ts`
  - keep as Vercel entrypoint only
  - method check
  - request normalization
  - Twilio signature enforcement
  - route to button flow or text flow
  - map failures to HTTP/TwiML responses

- `lib/whatsapp/request.ts`
  - parse incoming Twilio form body
  - normalize body params
  - sanitize / validate phone, name, message text
  - expose typed `IncomingWhatsAppRequest`

- `lib/whatsapp/url.ts`
  - `getAbsoluteUrl`
  - forwarded-header helpers
  - any `TWILIO_WEBHOOK_URL` hardening changes

#### 2. Transport / channel actions

- `lib/whatsapp/transport.ts`
  - `twiml`
  - `sendRestMessage`
  - `sendTemplateMessage`
  - `sendTypingIndicator`
  - `twilioRestBase`

This module must not know about orders, pending state, or LLM prompts.

#### 3. Config / shared types

- `lib/whatsapp/config.ts`
  - env reads
  - Twilio capability flags
  - store info config
  - model/provider config

- `lib/whatsapp/types.ts`
  - request/body types
  - conversation types
  - pending-order types
  - simulator result types

#### 4. Persistence / conversation state

- `lib/whatsapp/db.ts`
  - `createSupabaseClient`

- `lib/whatsapp/conversation-state.ts`
  - `getHistory`
  - `appendHistory`
  - `resetConversationHistory`
  - `storePendingOrder`
  - `getPendingOrder` or future `consumePendingOrder`
  - TTL logic once added

This module should own `conversation_history` access in one place first, because both message history and `pending_order` currently live in the same table. Split further only if that boundary proves too large later.

#### 5. Inventory / product resolution

- `lib/whatsapp/inventory.ts`
  - `getInventorySummary`
  - `resolveOrderItems`
  - `resolveProductById`
  - `resolveProductByName`
  - product text normalization and scoring helpers

#### 6. Deterministic order flow

- `lib/whatsapp/order-intent.ts`
  - `extractOrderJson`
  - `processOrderIntent`
  - `createPendingOrderFromPending`

- `lib/whatsapp/conversation.ts`
  - intent heuristics
  - pickup/quantity parsing
  - menu selection parsing
  - repeated-quantity parsing
  - deterministic follow-up shaping
  - any shared turn-level composition that is still too coupled to split further

Keep this boundary broader at first. Split `followups.ts` later only after the orchestration seam is stable.

#### 7. LLM / prompt orchestration

- `lib/whatsapp/prompts.ts`
  - `buildSystemPrompt`
  - store info reply builders
  - overloaded fallback reply builders

- `lib/whatsapp/llm.ts`
  - provider calls
  - retry rules
  - `runConversationTurn`
  - `buildReplyWithPending`
  - `buildReply`

This layer may call inventory and order-intent modules, but it should not send Twilio messages directly.

#### 8. Simulator-specific composition

- `lib/whatsapp/simulator.ts`
  - `toSimulationOrderReply`
  - `buildLocalGeneratedReply`
  - `buildLocalSimulatorTurn`
  - `buildLocalSimulationReply`
  - `buildSimulatorReply`

This keeps local-only behavior out of the real webhook route while still reusing shared domain modules.

### Desired end state

[`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) should end around 100-250 lines and read like:

1. validate request
2. normalize request
3. branch button vs text
4. delegate to orchestrator
5. send channel response

## SpecFlow Analysis

### Core user flows to preserve during refactor

- Customer sends freeform product question.
- Customer sends store-info question.
- Customer starts an order in freeform text.
- Customer confirms/cancels via button template.
- Customer confirms/cancels via `DA/NU` or `YES/NO` fallback.
- Owner confirms/cancels from the app and customer still receives outbound notice through the separate notify route.
- Local simulator remains representative of shared WhatsApp logic.

### Gaps / edge cases the split must not hide

- invalid or missing Twilio signature must still fail before DB/LLM work
- button payload allowlist must stay explicit
- pending order consumption must become atomic in follow-up work
- stale pending orders need an expiry path
- template availability must degrade cleanly to text fallback
- store-info fast path should remain able to skip inventory/LLM work
- simulator-specific auth should not bleed into webhook code

### Planning decision from SpecFlow review

This refactor should be behavior-preserving first. Pending behavioral fixes should be staged after or alongside extracted modules, not mixed invisibly into the first “split” commit unless they are required to keep module boundaries coherent.

## Implementation Phases

### Test gate before deep split

Current tests are enough for extraction of pure helpers and route-adjacent utilities, but not enough for a full state/orchestration split.

Before Phase 2, add or reshape tests so post-refactor checks cover the real seams:

- add webhook-route coverage for typed `DA/NU` or `YES/NO` confirm/cancel fallback
- add focused tests for pending-order state module behavior
- add focused tests for conversation-history module behavior
- add at least one signed-request test for the real webhook route that verifies delegation and response mode without relying on `/api/whatsapp-simulate`
- reduce dependence on `__private__` exports by moving tests to the extracted modules as they are created

**Gate**

- Phase 1 may proceed with current coverage.
- Phase 2 and later should not start until the added route/state tests are in place.

### Phase 1: Smallest safe refactor

This phase is the recommended starting point and should be one small PR.

- [x] Create `lib/whatsapp/` directory and move pure helpers first:
  - [x] `types.ts`
  - [x] `config.ts`
  - [x] `url.ts`
  - [x] `transport.ts`
- [x] Keep function names and call order stable.
- [x] Update imports and keep tests green.
- [x] Do not move persistence, simulator, LLM, or order-flow logic in this phase.

**Success criteria**
- [x] Route behavior unchanged.
- [x] No simulator/webhook regressions.
- [x] Existing unit tests still pass with minimal expectation changes.
- [x] [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) is smaller, but still owns orchestration.
- [x] This phase is independently mergeable.

**Delivered on 2026-03-11**

- Extracted:
  - [`lib/whatsapp/types.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/types.ts)
  - [`lib/whatsapp/config.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/config.ts)
  - [`lib/whatsapp/url.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/url.ts)
  - [`lib/whatsapp/transport.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/transport.ts)
- Rewired [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) to import those helpers.
- Added direct helper coverage in [`tests/unit/api/whatsapp-transport.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-transport.test.ts).
- Updated [`tests/unit/lib/whatsappUrl.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/lib/whatsappUrl.test.ts) to target the extracted URL module.
- Verified with:
  - `pnpm typecheck`
  - targeted WhatsApp unit suites

### Phase 2: Extract shared conversation state

- [x] Phase 2 complete.
- [x] Extract:
  - [x] `db.ts`
  - [x] `conversation-state.ts`
- [x] Replace `__private__` dependence with targeted module exports where useful.

**Success criteria**
- [x] `conversation_history` and `pending_order` access no longer live in the route file.
- [x] state behavior is covered by focused tests before more decomposition starts.

**Delivered on 2026-03-11**

- Extracted:
  - [`lib/whatsapp/db.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/db.ts)
  - [`lib/whatsapp/conversation-state.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts)
- Rewired [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) to consume shared Supabase/state helpers for:
  - conversation history reads
  - history append RPC fallback
  - pending-order store/read-clear flow
- Updated [`api/whatsapp-simulate.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts) to reset history through the extracted state module.
- Added focused state coverage in [`tests/unit/api/whatsapp-conversation-state.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-conversation-state.test.ts).
- Retargeted simulator reset mocking in [`tests/unit/api/whatsapp-simulate.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-simulate.test.ts).
- Verified with:
  - `pnpm typecheck`
  - `pnpm vitest run tests/unit/api/whatsapp-conversation-state.test.ts tests/unit/api/whatsapp-webhook.test.ts tests/unit/api/whatsapp-simulate.test.ts tests/unit/whatsappAgent.test.ts tests/unit/whatsappInventory.test.ts`
  - `pnpm vitest run tests/integration/whatsapp-agent.test.ts`

### Phase 3: Extract conversation and inventory domains

- [x] Phase 3 complete.
- [x] Extract:
  - `inventory.ts`
  - `order-intent.ts`
  - `conversation.ts`

**Success criteria**
- [x] deterministic order and follow-up logic no longer lives in the route file
- [x] extracted domain modules have direct tests instead of `__private__` coupling

Completed 2026-03-11:
- Added:
  - [`lib/whatsapp/inventory.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/inventory.ts)
  - [`lib/whatsapp/order-intent.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/order-intent.ts)
  - [`lib/whatsapp/conversation.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation.ts)
- Rewired [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) and shared LLM flows to consume extracted inventory, follow-up, and order parsing logic.
- Kept direct unit coverage in:
  - [`tests/unit/whatsappInventory.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappInventory.test.ts)
  - [`tests/unit/whatsappAgent.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappAgent.test.ts)
- Verified with:
  - `pnpm typecheck`
  - `pnpm vitest run tests/unit/api/whatsapp-conversation-state.test.ts tests/unit/api/whatsapp-webhook.test.ts tests/unit/api/whatsapp-simulate.test.ts tests/unit/whatsappAgent.test.ts tests/unit/whatsappInventory.test.ts`
  - `pnpm vitest run tests/integration/whatsapp-agent.test.ts`

### Phase 4: Extract orchestration layers

- [x] Extract:
  - `prompts.ts`
  - `llm.ts`
  - `simulator.ts`
- Make webhook route and simulator route both consume shared orchestration intentionally, not incidentally.

**Success criteria**
- [x] webhook route contains no prompt-building or simulator logic
- [x] simulator route imports simulator module only

Completed 2026-03-11:
- Added:
  - [`lib/whatsapp/prompts.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts)
  - [`lib/whatsapp/llm.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts)
  - [`lib/whatsapp/simulator.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts)
- Rewired [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) to consume shared LLM orchestration only.
- Rewired [`api/whatsapp-simulate.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts) and local dev middleware in [`vite.config.ts`](/Users/vladislavcaraseli/Documents/inventory-app/vite.config.ts) to consume the extracted simulator/state modules directly.
- Retargeted simulator mocks in [`tests/unit/api/whatsapp-simulate.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-simulate.test.ts).
- Verified with:
  - `pnpm typecheck`
  - `pnpm vitest run tests/unit/api/whatsapp-conversation-state.test.ts tests/unit/api/whatsapp-webhook.test.ts tests/unit/api/whatsapp-simulate.test.ts tests/unit/whatsappAgent.test.ts tests/unit/whatsappInventory.test.ts`
  - `pnpm vitest run tests/integration/whatsapp-agent.test.ts`

### Phase 5: Thin-route cleanup and follow-on hardening

- [x] Phase 5 complete.
- [x] Reduce [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) to thin orchestration.
- Immediately queue or apply the module-enabled hardening items:
  - atomic pending-order consume
  - pending-order TTL
  - prompt identity sanitization
  - button payload allowlist
  - `TWILIO_WEBHOOK_URL` hardening

**Success criteria**
- [x] route file is small and readable
- [x] unresolved WhatsApp security/data-integrity work is easier to land as isolated changes

Completed 2026-03-11:
- Added:
  - [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts)
- Reduced [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) to a route entrypoint that only re-exports the shared webhook handler.
- Moved Twilio request validation, button handling, DA/NU fallback handling, REST-vs-TwiML reply branching, and pending-order confirmation orchestration into the shared webhook module.
- Verified with:
  - `pnpm typecheck`
  - `pnpm vitest run tests/unit/api/whatsapp-webhook.test.ts tests/unit/api/whatsapp-simulate.test.ts tests/unit/api/whatsapp-conversation-state.test.ts tests/unit/whatsappAgent.test.ts tests/unit/whatsappInventory.test.ts`
  - `pnpm vitest run tests/integration/whatsapp-agent.test.ts`

## Acceptance Criteria

### Functional

- [x] `POST /api/whatsapp` preserves current customer-visible behavior for existing covered flows
- [x] `POST /api/whatsapp-simulate` still works and uses shared domain logic where intended
- [x] confirm/cancel button flow still works with template send and text fallback
- [x] store-info fast path still works

### Structural

- [x] [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) is reduced to a thin route entrypoint
- [x] transport, state, domain, LLM, and simulator concerns are separated into dedicated modules
- [x] no module mixes Twilio transport and order-state mutation logic
- [x] no simulator-only helpers remain in the webhook route file

### Quality gates

- [x] `pnpm typecheck` passes
- [x] `pnpm test:unit` passes for WhatsApp-related suites
- [x] targeted integration suite passes:
  - `tests/integration/whatsapp-agent.test.ts`
- [x] module-level tests cover extracted helpers without relying on broad `__private__` exports
- [x] before Phase 2, webhook/state test gaps are closed enough to validate the deeper split

## Dependencies & Risks

### Dependencies

- Current Twilio validation helper remains source of truth unless intentionally moved.
- Existing Supabase RPC append pattern should remain compatible with extracted history module.
- Pending-order migration/RPC follow-up work is related but not blocked by the initial split.

### Risks

- accidental behavior drift during function moves
- circular imports between LLM, follow-up parsing, and order processing
- test churn if module boundaries are chosen poorly
- combining refactor with too many behavior fixes in one pass

### Mitigation

- move pure helpers first
- preserve function names until phase cleanup
- keep route contract stable while moving internals
- land extraction in small slices with targeted test updates

## Success Metrics

- route file size drops materially from 1,871 lines to a thin entrypoint
- new WhatsApp work lands in focused modules instead of the route file
- open WhatsApp hardening tasks can be implemented as narrow changes
- onboarding/debugging cost for WhatsApp flow decreases because module ownership is obvious
- first PR is small enough to review and revert safely if needed

## Documentation Plan

- Update [`docs/runbooks/whatsapp_agent.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/runbooks/whatsapp_agent.md) if env ownership or route behavior changes
- Update [`docs/specs/whatsapp_agent.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/whatsapp_agent.md) only if behavior changes, not for pure extraction
- Add a short architecture note if the new `lib/whatsapp/` tree introduces stable module ownership worth documenting

## References & Research

### Internal

- [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts)
- [`api/whatsapp-simulate.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts)
- [`api/whatsapp-notify.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-notify.ts)
- [`docs/brainstorms/2026-03-11-whatsapp-template-led-assistant-brainstorm.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/brainstorms/2026-03-11-whatsapp-template-led-assistant-brainstorm.md)
- [`docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md)
- [`docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md)

### External

- [Twilio Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Twilio Content Types Overview](https://www.twilio.com/docs/content/content-types-overview)
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
