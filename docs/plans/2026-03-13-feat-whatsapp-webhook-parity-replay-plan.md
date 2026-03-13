---
title: "feat: Add WhatsApp webhook parity replay flow"
type: feat
date: 2026-03-13
origin:
  - docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md
  - docs/specs/whatsapp_agent.md
  - docs/runbooks/whatsapp_agent.md
  - lib/whatsapp/webhook.ts
  - lib/whatsapp/simulator.ts
  - api/whatsapp-simulate.ts
  - scripts/test-whatsapp-webhook-local.ts
  - scripts/whatsapp-local-test.ts
  - scripts/whatsapp-test-scenario.sh
---

# feat: Add WhatsApp webhook parity replay flow

## Overview

Add one reproducible local replay flow that sends Twilio-shaped inbound requests through the real WhatsApp webhook path so local validation matches phone behavior as closely as possible.

This is a product-completion feature, not cleanup. The immediate goal is to stop relying on the current local simulator as proof that the WhatsApp product works. The replay flow should become the authoritative local validation path for:

- order creation
- inventory / Q&A
- confirm / cancel

## Problem Statement / Motivation

The current WhatsApp development loop has a trust problem:

- real phone traffic goes through [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts)
- local simulator traffic goes through [`api/whatsapp-simulate.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts) and [`lib/whatsapp/simulator.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts)

Those are different behavior surfaces. The repo already shows divergence:

- simulator has its own provider-selection logic
- simulator supports direct `ORDER:` / raw JSON shortcuts
- current local scripts hit the webhook, but they are manual or ad hoc rather than a repeatable product-validation harness

Result: local WhatsApp checks can say “works” while real phone behavior differs on the exact flows the product still needs to finish.

## Research Summary

### Internal findings

- The brainstorm from 2026-03-13 chose parity-first webhook replay as the next step and explicitly demoted the current simulator to secondary status for parity work.
- [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts) is the real source-of-truth path for signature validation, text/button confirm-cancel handling, pending-order lifecycle, and async reply orchestration.
- [`lib/whatsapp/simulator.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts) contains simulator-only branches such as direct `ORDER:` handling and local provider fallbacks, which are useful for convenience but not reliable parity validation.
- Existing local utilities already point in the right direction:
  - [`scripts/test-whatsapp-webhook-local.ts`](/Users/vladislavcaraseli/Documents/inventory-app/scripts/test-whatsapp-webhook-local.ts)
  - [`scripts/whatsapp-local-test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/scripts/whatsapp-local-test.ts)
  - [`scripts/whatsapp-test-scenario.sh`](/Users/vladislavcaraseli/Documents/inventory-app/scripts/whatsapp-test-scenario.sh)
- These scripts are not yet a clean replay workflow because they are manual, partially duplicated, and not centered on reusable transcript fixtures.

### Institutional learnings

- [`docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md): transcript-shaped WhatsApp regressions matter because history can steer wrong replies.
- [`docs/solutions/logic-errors/button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md): button and confirmation paths need realistic route-level validation.
- [`docs/solutions/logic-errors/atomic-pending-order-consume-whatsappagent-20260312.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/atomic-pending-order-consume-whatsappagent-20260312.md): confirmation behavior should be validated close to the real webhook seam.

### Research decision

No external research needed. This is a repo-specific workflow/product-gap problem and the local context is current and detailed.

## Proposed Solution

Create a parity-first replay harness around the real webhook path.

### Workstream 1: Define one authoritative replay path

Introduce one supported local flow that:

- builds Twilio-shaped inbound payloads
- signs them like real requests
- posts them to local `POST /api/whatsapp`
- captures the immediate TwiML response
- records enough information to inspect async follow-up behavior

This should reuse the real webhook path, not simulator-only orchestration.

### Workstream 2: Add transcript fixtures

Define a small fixture format for replay scenarios derived from real phone transcripts.

Start with three must-have scenarios:

- inventory / Q&A transcript
- order creation transcript
- confirm / cancel transcript

The first source should be manually copied real test transcripts, then normalized into reusable repo fixtures.

### Workstream 3: Clarify tool roles

Document and encode the difference between:

- authoritative parity replay
- convenience-only local simulator

The simulator can stay, but parity work should default to replay through the real webhook.

### Workstream 4: Make progress visible

Provide one simple developer entrypoint for replaying a transcript locally so “progress” means “this real webhook scenario now reproduces locally and behaves as expected,” not “the simulator said something plausible.”

## SpecFlow Analysis

Core user/system flows this plan must support:

- customer asks a stock/price question on phone; local replay should reproduce the same webhook branch and comparable reply path
- customer builds an order across multiple turns; local replay should reproduce pending-order creation behavior through the real webhook
- customer confirms or cancels using text or button payloads; local replay should exercise the same confirmation logic as phone traffic

Gaps to address in the plan:

- replay must support both plain text body and `ButtonPayload`
- replay must preserve enough metadata for history-sensitive flows (`From`, `ProfileName`, message ids, button payloads)
- replay should allow fixture-backed multi-turn conversations, not only single-message calls

## Technical Considerations

- The authoritative path should be [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts), because that is where real Twilio requests land.
- Existing scripts should probably be consolidated rather than leaving three partially overlapping tools in place.
- A fixture format should stay small and boring. It only needs the Twilio fields that meaningfully affect behavior.
- Async follow-up observability matters. The webhook often acknowledges immediately and sends the meaningful reply later, so replay output must make that visible.
- The plan should avoid forcing a big simulator rewrite immediately. First establish the replay harness; only later decide whether the UI simulator should call it.

## Acceptance Criteria

- [x] There is one documented local replay workflow that exercises the real `POST /api/whatsapp` path
- [x] Replay inputs are fixture-backed and support multi-turn scenarios
- [x] Replay supports text messages and button payloads
- [x] Replay covers at least one scenario each for inventory/Q&A, order creation, and confirm/cancel
- [x] Replay uses Twilio-shaped payload fields and valid local signature generation
- [x] Runbook/docs clearly state that webhook replay is the authoritative parity check and the simulator is secondary
- [x] Existing simulator docs/UI no longer imply that simulator success alone proves real phone parity

## Success Metrics

- A real phone issue can be turned into a local replay scenario quickly.
- Local WhatsApp debugging centers on the real webhook path rather than simulator-only code.
- Progress becomes measurable via parity scenarios, not anecdotal simulator behavior.

## Dependencies & Risks

### Dependencies

- local dev server running the real webhook route
- Twilio signature generation for local replay
- current webhook behavior in [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts)

### Risks

- async REST follow-up may be harder to observe than immediate TwiML, so the replay UX must not hide that distinction
- fixture format can become over-engineered if it tries to model all Twilio metadata too early
- leaving the current simulator UX unchanged may continue to confuse developers unless docs and naming are updated clearly

## Implementation Sequence

1. Define the replay workflow and choose the single supported entrypoint.
2. Consolidate or replace the current ad hoc local webhook scripts behind that entrypoint.
3. Design the minimal transcript fixture format.
4. Add the first three fixture scenarios: Q&A, order creation, confirm/cancel.
5. Update runbook/docs and simulator messaging to make replay the authoritative parity path.

## Validation

Minimum manual validation:

```bash
pnpm dev
# then run the replay harness against:
# - inventory / Q&A fixture
# - order creation fixture
# - confirm / cancel fixture
```

Recommended automated validation:

```bash
pnpm vitest run tests/unit/api/whatsapp-webhook.test.ts tests/integration/whatsapp-agent.test.ts
```

## References & Research

- Brainstorm: [`docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md)
- Spec: [`docs/specs/whatsapp_agent.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/whatsapp_agent.md)
- Runbook: [`docs/runbooks/whatsapp_agent.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/runbooks/whatsapp_agent.md)
- Real webhook path: [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts)
- Current simulator path: [`lib/whatsapp/simulator.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts)
- Local simulator route: [`api/whatsapp-simulate.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts)
- Existing local scripts:
  - [`scripts/test-whatsapp-webhook-local.ts`](/Users/vladislavcaraseli/Documents/inventory-app/scripts/test-whatsapp-webhook-local.ts)
  - [`scripts/whatsapp-local-test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/scripts/whatsapp-local-test.ts)
  - [`scripts/whatsapp-test-scenario.sh`](/Users/vladislavcaraseli/Documents/inventory-app/scripts/whatsapp-test-scenario.sh)
