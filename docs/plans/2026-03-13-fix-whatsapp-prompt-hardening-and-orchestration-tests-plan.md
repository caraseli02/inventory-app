---
title: "fix: Harden WhatsApp prompt identity interpolation and close orchestration test gaps"
type: fix
date: 2026-03-13
origin:
  - todos/079-pending-p1-prompt-injection-profilename-phone-in-system-prompt.md
  - todos/091-pending-p3-add-direct-whatsapp-orchestration-tests.md
  - docs/brainstorms/2026-03-11-whatsapp-template-led-assistant-brainstorm.md
  - docs/plans/2026-03-12-refactor-whatsapp-chat-state-plan.md
  - docs/specs/whatsapp_agent.md
  - docs/runbooks/whatsapp_agent.md
---

# fix: Harden WhatsApp prompt identity interpolation and close orchestration test gaps

## Overview

Plan the next WhatsApp follow-up as a small, high-signal hardening pass:

1. remove prompt-injection exposure from customer identity interpolation in the extracted prompt/orchestration path
2. add direct unit coverage for the extracted orchestration modules so later WhatsApp refactors have local, deterministic guards

This keeps the recent chat-state hardening moving forward without reopening a cheaper exploit path in [`lib/whatsapp/prompts.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts) or relying only on route-level tests for the new module seams.

## Problem Statement / Motivation

Recent WhatsApp work improved pending-order lifecycle safety, but two follow-up gaps remain:

- [`lib/whatsapp/prompts.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts) still interpolates raw `name` and `phone` into both human-readable prompt text and the inline `ORDER:` contract. That preserves the prompt-injection shape previously called out in todo `079`, now in the extracted module layout.
- [`lib/whatsapp/llm.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts) and [`lib/whatsapp/simulator.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts) own critical orchestration logic, but coverage is still mostly indirect through [`tests/unit/api/whatsapp-webhook.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts), [`tests/unit/api/whatsapp-simulate.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-simulate.test.ts), and [`tests/integration/whatsapp-agent.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/integration/whatsapp-agent.test.ts).

Why this should be the next follow-up:

- prompt/input hardening is the highest-risk open WhatsApp item still visible in local todo/docs context
- test-locality is the next cheapest way to keep Phase 3/4 WhatsApp extraction stable
- both changes are tightly related to the same extracted modules and can ship together with low implementation risk

## Research Summary

### Internal findings

- The 2026-03-11 brainstorm recommends a thin conversational front door with deterministic transactional state and less reliance on freeform model output.
- The 2026-03-12 chat-state plan already tightened pending-order boundaries and explicitly warns against letting freeform content silently drive transactional state.
- [`docs/specs/whatsapp_agent.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/whatsapp_agent.md) requires that order creation rely on current-turn evidence or explicit confirmation signals, not broad history reconstruction.
- [`lib/whatsapp/prompts.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts) currently embeds customer identity directly inside the required `ORDER:` template.
- [`lib/whatsapp/llm.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts) now concentrates `runConversationTurn()`, history use, prompt building, provider invocation, and repair logic.
- [`lib/whatsapp/simulator.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts) now owns provider selection and direct `ORDER:` simulation paths, but lacks direct unit assertions for those branches.

### Institutional learnings

- [`docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md): conversational memory must not recreate transactional state.
- [`docs/solutions/logic-errors/atomic-pending-order-consume-whatsappagent-20260312.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/atomic-pending-order-consume-whatsappagent-20260312.md): confirmation flows need explicit state boundaries and regressions that stay close to the seam being protected.
- [`docs/solutions/logic-errors/button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md): WhatsApp confirmation logic drifts when route and state boundaries are not tested directly.

### Research decision

No external research needed. Repo context is current, WhatsApp-specific, and already contains the relevant constraints, prior bugs, and desired product direction.

## Proposed Solution

Implement this follow-up in two workstreams.

### Workstream 1: Harden prompt identity handling

Move customer identity ownership fully server-side for the LLM order contract.

Planned direction:

- sanitize inbound `ProfileName` before it reaches prompt construction
- validate/normalize phone before prompt use
- stop asking the model to emit `customer_name` and `customer_phone` in `ORDER:`
- keep the LLM responsible only for `items` and `pickup_time`
- merge validated server-side identity fields during order parsing/persistence instead of trusting model output

Expected touchpoints:

- [`lib/whatsapp/prompts.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts)
- [`lib/whatsapp/order-intent.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/order-intent.ts)
- [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts)
- [`lib/whatsapp/types.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/types.ts)

### Workstream 2: Add direct orchestration-module tests

Add focused unit suites for the extracted module seams instead of relying only on route-level coverage.

Planned direction:

- add direct tests for `buildSystemPrompt()` structure and identity interpolation rules
- add direct tests for `runConversationTurn()` covering store-info fast path, follow-up/local path, and provider path with mocked dependencies
- add direct tests for simulator provider selection and direct `ORDER:` handling branches

Expected touchpoints:

- [`tests/unit/lib/whatsapp-prompts.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/lib/whatsapp-prompts.test.ts)
- [`tests/unit/lib/whatsapp-llm.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/lib/whatsapp-llm.test.ts)
- [`tests/unit/lib/whatsapp-simulator.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/lib/whatsapp-simulator.test.ts)

## SpecFlow Analysis

Key user/system flows this plan must protect:

- customer sends a crafted display name; system must not let that alter transactional identity fields
- customer places a normal order; system must still create the same pending order shape after server-side identity merge
- simulator runs with no provider keys; local path still works
- simulator runs with OpenAI only, Anthropic only, and OpenAI failure with Anthropic fallback
- prompt/refactor changes must fail close to the owning module, not only at webhook/integration level

Gaps added to acceptance criteria from this analysis:

- verify model output cannot override server-owned identity fields
- verify direct JSON simulation without identity fields still succeeds
- verify provider fallback branches in the simulator module explicitly

## Technical Considerations

- This is a behavior-preserving hardening change, not a product-flow redesign.
- Keep the Twilio/template-led assistant direction from the brainstorm intact: conversational understanding may stay flexible, but transactional identity/state should remain deterministic.
- Avoid widening history heuristics while touching `runConversationTurn()` tests; the goal is seam protection, not a new conversational behavior pass.
- Update any prompt snapshots/assertions carefully because date text is dynamic; tests should assert structure, required rules, and forbidden identity contract details rather than full exact strings.

## Acceptance Criteria

- [ ] `buildSystemPrompt()` no longer requires the model to emit `customer_name` or `customer_phone` inside `ORDER:`
- [ ] inbound WhatsApp display name is sanitized before prompt interpolation
- [ ] phone used in prompt/order assembly is normalized from trusted server-side input
- [ ] order parsing/persistence fills `customer_name` and `customer_phone` from server-side values, not model-controlled values
- [ ] direct tests cover `buildSystemPrompt()` contract and identity-hardening rules
- [ ] direct tests cover `runConversationTurn()` local/store-info/provider branches with mocked dependencies
- [ ] direct tests cover simulator local mode, provider selection, and OpenAI→Anthropic fallback
- [ ] existing webhook and integration WhatsApp suites still pass
- [ ] `pnpm typecheck` passes

## Success Metrics

- Security-sensitive customer identity fields are no longer model-owned in the WhatsApp order contract.
- Future WhatsApp refactors can break prompt/orchestration seams in unit tests before they escape to route/integration layers.
- The recent chat-state hardening remains intact without new transactional regressions.

## Dependencies & Risks

### Dependencies

- Current extracted WhatsApp modules in [`lib/whatsapp/`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/)
- Existing WhatsApp regression suites in [`tests/unit/api/whatsapp-webhook.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts) and [`tests/integration/whatsapp-agent.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/integration/whatsapp-agent.test.ts)

### Risks

- Changing the `ORDER:` contract can break simulator helpers or parsing assumptions if tests do not cover both LLM and direct JSON paths.
- Over-sanitizing display names may degrade customer-visible replies; sanitize for prompt safety while preserving readable names where possible.
- Tests that assert too much dynamic prompt text will become brittle.

## Implementation Sequence

1. Narrow the target contract in [`lib/whatsapp/prompts.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts) so the model emits only transactional fields it should control.
2. Update order-intent/webhook plumbing to merge server-owned identity during pending-order creation.
3. Add direct prompt/orchestration/simulator unit suites.
4. Re-run route/integration WhatsApp suites to confirm no regression at the webhook layer.
5. Close or update todos `079` and `091` plus any newly-satisfied test-gap notes.

## Validation

Minimum:

```bash
pnpm vitest run tests/unit/whatsappAgent.test.ts tests/unit/api/whatsapp-webhook.test.ts tests/unit/api/whatsapp-simulate.test.ts tests/integration/whatsapp-agent.test.ts
pnpm typecheck
```

Recommended extra:

```bash
pnpm vitest run tests/unit/lib/whatsapp-prompts.test.ts tests/unit/lib/whatsapp-llm.test.ts tests/unit/lib/whatsapp-simulator.test.ts
```

## References & Research

- Brainstorm: [`docs/brainstorms/2026-03-11-whatsapp-template-led-assistant-brainstorm.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/brainstorms/2026-03-11-whatsapp-template-led-assistant-brainstorm.md)
- Current state-boundary plan: [`docs/plans/2026-03-12-refactor-whatsapp-chat-state-plan.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-12-refactor-whatsapp-chat-state-plan.md)
- Spec: [`docs/specs/whatsapp_agent.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/whatsapp_agent.md)
- Runbook: [`docs/runbooks/whatsapp_agent.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/runbooks/whatsapp_agent.md)
- Security todo: [`todos/079-pending-p1-prompt-injection-profilename-phone-in-system-prompt.md`](/Users/vladislavcaraseli/Documents/inventory-app/todos/079-pending-p1-prompt-injection-profilename-phone-in-system-prompt.md)
- Test-gap todo: [`todos/091-pending-p3-add-direct-whatsapp-orchestration-tests.md`](/Users/vladislavcaraseli/Documents/inventory-app/todos/091-pending-p3-add-direct-whatsapp-orchestration-tests.md)
