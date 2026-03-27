---
title: feat: Add WhatsApp parity harness vertical slice
type: feat
status: active
date: 2026-03-26
origin: docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md
---

# feat: Add WhatsApp parity harness vertical slice

## Overview

Build a phase-1 WhatsApp parity harness that keeps replay and real webhook behavior authoritative while making the local simulator a more faithful convenience layer. The first slice should introduce a shared fixture/contract model, a shared parity runner, and normalized output assertions for 1-2 critical flows where simulator and replay currently diverge in user-visible message behavior.

This plan carries forward the origin document's core decisions: replay remains authoritative, simulator is secondary, and phase 1 targets externally visible message parity rather than full state equivalence (see origin: `docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md`).

## Problem Statement / Motivation

The WhatsApp stack has multiple validation surfaces:

- real phone behavior through Twilio + the real webhook
- local replay through `pnpm whatsapp:replay`
- simulator requests through `POST /api/whatsapp-simulate`

Those surfaces do not yet create consistent confidence. The current pain is not just raw instability; it is that engineers can get different answers about whether a flow "works" depending on which surface they use.

Recent repo history shows why this matters:

- replay initially missed async transport output, so a flow could "pass" while the real customer-visible reply path was still wrong
- simulator and webhook validation have diverged before around auth, follow-up behavior, and confirm/cancel side effects
- the runbook already says replay is authoritative, but the repo does not yet have a compact parity harness that compares simulator behavior against that authority

The best next move is a bounded vertical slice that proves the parity approach works on a small number of high-risk flows before attempting broader stabilization.

## Proposed Solution

Introduce a phase-1 parity harness with three new capabilities:

1. A **shared parity fixture model** that can represent the subset of inbound message metadata and expected user-visible output needed by both replay and simulator validation.
2. A **shared parity runner** that executes the same scenario through replay and simulator-oriented paths, then normalizes and compares the user-visible outputs.
3. A **normalized assertion layer** that evaluates parity by meaning and critical details, not exact string identity.

Phase 1 should cover only 1-2 critical flows. Recommended first candidates:

- confirm / cancel flow with interactive or equivalent follow-up semantics
- one inventory or order flow where message-content drift has been confusing in practice

The first implementation should compare:

- intended outcome
- presence of critical details
- presence or absence of extra/missing user-visible messages that change the flow
- outbound transport shape only as far as needed to compare externally visible behavior

It should not attempt full internal-state parity, deep prompt redesign, or real Twilio end-to-end automation.

## Technical Considerations

- **Authoritative boundary**: Replay and real webhook behavior stay authoritative per the runbook and origin decisions. The simulator must align to them, not redefine them.
- **Current seams**:
  - `scripts/whatsapp-replay.ts` already exercises the real webhook and captures async transport output.
  - `lib/whatsapp/transport.ts` already captures replay transport events.
  - `api/whatsapp-simulate.ts` and `lib/whatsapp/simulator.ts` define the convenience path that currently needs parity comparison.
- **Comparison target**: Normalize message behavior rather than raw text. Exact wording should not be required if meaning and critical details match.
- **Fixture scope**: Include only metadata that materially affects parity, such as body text, button payloads, profile/phone context, and expected transport-visible outputs.
- **Existing test mix**: Current unit tests cover webhook response semantics and some async effects, but they do not provide a compact cross-surface parity contract.
- **Local-only simulator constraint**: Simulator remains local-only and should not become a preview/production dependency.

## System-Wide Impact

- **Interaction graph**:
  - Parity scenario input should flow into replay via `scripts/whatsapp-replay.ts`, through `api/whatsapp` and `lib/whatsapp/webhook.ts`, then into `lib/whatsapp/transport.ts` capture.
  - The same scenario should flow into the simulator via `api/whatsapp-simulate.ts` and `lib/whatsapp/simulator.ts`.
  - The parity runner should consume both outputs and compare normalized user-visible results.

- **Error propagation**:
  - Replay already surfaces async transport mismatches; the new harness must preserve that visibility instead of collapsing everything into pass/fail.
  - Comparison failures should explain which contract broke: wrong outcome, missing critical detail, or extra/missing user-visible message.
  - The harness must not swallow route/simulator errors behind vague normalization failures.

- **State lifecycle risks**:
  - Even though phase 1 is not full state-parity work, the chosen flows may still touch `pending_order` / `pending_selection`.
  - Fixture setup/reset must avoid cross-run state bleed.
  - Replay bypass behavior around dedup/rate limit must remain explicit so parity checks do not get false failures.

- **API surface parity**:
  - `api/whatsapp`
  - `api/whatsapp-simulate`
  - `scripts/whatsapp-replay.ts`
  - `lib/whatsapp/simulator.ts`
  - `lib/whatsapp/transport.ts`
  These surfaces should share fixture semantics where feasible rather than inventing parallel test-only formats.

- **Integration test scenarios**:
  - confirm/cancel through replay vs simulator with equivalent inputs
  - one flow where async follow-up content matters more than immediate TwiML ack
  - one flow where button payload or equivalent follow-up content changes the user-visible outcome

## SpecFlow Analysis

Key flow and edge-case gaps surfaced from current specs, docs, and tests:

- Immediate TwiML ack is not the same as final customer-visible output.
- Button payloads and text fallbacks can follow different transport paths.
- A parity harness must account for async REST/template sends, not just HTTP 200 + TwiML.
- Dedup/rate-limit replay bypass behavior is part of the existing contract and must remain intentional.
- Cross-turn flows can be polluted by leftover conversation state if fixture reset/setup is sloppy.
- A useful parity check should fail on changed meaning or missing critical details, not harmless wording variation.

These gaps are incorporated directly into acceptance criteria and phased scope below.

## Acceptance Criteria

- [ ] Add a shared parity fixture/contract format for WhatsApp phase-1 scenarios in a dedicated location such as `fixtures/whatsapp-parity/`.
- [ ] Add a reusable parity runner module or script that executes the same scenario through replay and simulator-oriented paths.
- [ ] Normalize replay output so comparisons include async transport-visible messages, not only immediate TwiML output.
- [ ] Normalize simulator output into the same comparison shape used by replay.
- [ ] Implement message-parity assertions that verify:
  - same intended outcome
  - same critical details
  - no extra or missing user-visible message that changes the flow
- [ ] Do not require exact string equality when wording differs but meaning and critical details match.
- [ ] Cover at least 1-2 critical flows in phase 1.
- [ ] Include at least one flow where content mismatch would materially change customer understanding.
- [ ] Ensure parity runs are reproducible locally and reset or isolate conversation state correctly.
- [ ] Keep replay authoritative; do not redesign docs or tooling to make simulator the source of truth.
- [ ] Preserve existing replay async transport capture behavior and do not regress current replay assertions.
- [ ] Add tests or verification covering transport differences that previously escaped immediate-response-only assertions.
- [ ] Update WhatsApp testing/runbook docs to explain the phase-1 parity harness and its intended use.

## Success Metrics

- Engineers can run one command or one small workflow to compare replay vs simulator for the selected phase-1 flows.
- A parity failure identifies the category of mismatch clearly enough to debug without manual log archaeology.
- At least one existing or plausible mismatch class is caught by the new harness before merge.
- Simulator trust improves for local experimentation without changing its convenience-only role.

## Dependencies & Risks

### Dependencies

- Existing replay transport capture in `lib/whatsapp/replay-context.ts` and `lib/whatsapp/transport.ts`
- Replay CLI in `scripts/whatsapp-replay.ts`
- Simulator entrypoints in `api/whatsapp-simulate.ts` and `lib/whatsapp/simulator.ts`
- WhatsApp state/reset behavior in `lib/whatsapp/conversation-state.ts`

### Risks

- **Over-normalization**: if the comparison becomes too fuzzy, the harness will miss real regressions.
- **Over-strictness**: if the comparison demands exact copy equality, it will create noise and lose credibility.
- **Fixture drift**: if replay and simulator need separate fixture formats, the harness will add carrying cost instead of reducing it.
- **State contamination**: cross-run state bleed can create false mismatches.
- **Wrong first flows**: choosing low-signal scenarios could make the vertical slice look complete without proving much.

### Mitigations

- Start with a narrow set of normalization rules tied to outcome and critical details.
- Pick high-signal flows with known async or content-drift history.
- Reuse existing replay capture seams instead of inventing parallel transport instrumentation.
- Keep phase 1 intentionally small so the comparison model can be corrected quickly.

## Implementation Phases

### Phase 1: Contract and Scenario Selection

- Define the smallest shared fixture schema that can represent:
  - inbound body text
  - optional button payload / equivalent metadata
  - phone/profile context
  - expected outcome class
  - critical details that must appear
  - expected transport-visible message count or shape when material
- Choose the first 1-2 scenarios with the highest parity signal.
- Document normalization rules for "same meaning / same critical details."

Deliverables:

- fixture schema doc or inline schema comments
- first parity fixtures
- chosen flow list with rationale

### Phase 2: Shared Runner and Output Normalization

- Implement a shared parity runner that can:
  - execute replay scenario steps
  - execute equivalent simulator scenario steps
  - collect normalized outputs from both paths
- Normalize replay output from async transport captures and immediate response where relevant.
- Normalize simulator output into the same comparison structure.
- Add comparison reporting that explains mismatch type.

Deliverables:

- parity runner module/script
- normalized output model
- failure reporting for meaning/detail mismatches

### Phase 3: Verification, Docs, and Guardrails

- Add tests around the parity runner and normalization rules.
- Add at least one regression fixture linked to a real mismatch class or prior bug shape.
- Update `docs/WHATSAPP_TESTING.md` and `docs/runbooks/whatsapp_agent.md` with how to use the new parity slice.
- Confirm replay remains authoritative in docs and behavior.

Deliverables:

- tests for phase-1 parity slice
- docs updates
- explicit note of known non-goals for future phases

## Alternative Approaches Considered

### 1. Promote simulator to source of truth

Rejected in the origin document because it would invert the repo's current reliability model and make it easier to preserve drift behind a convenient local surface.

### 2. Build a full-state parity framework first

Rejected for phase 1 because it is too broad and would slow down the more urgent goal: catching user-visible transport/message mismatches quickly.

### 3. Continue improving replay only, without a simulator comparison contract

Rejected because the current pain includes disagreement between replay and simulator. Replay-only hardening helps, but does not directly answer whether simulator behavior is safe to trust as a convenience tool.

## Documentation Plan

- Update `docs/WHATSAPP_TESTING.md` with the new parity workflow and when to use it versus replay-only or simulator-only testing.
- Update `docs/runbooks/whatsapp_agent.md` to reference the parity slice as a local comparison tool while keeping replay authoritative.
- If the first phase reveals new contract rules around message parity, capture them in the WhatsApp spec or a focused solution doc if a bug is fixed along the way.

## Sources & References

### Origin

- **Origin document:** `docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md`
  Key decisions carried forward:
  - replay/real webhook stay authoritative
  - simulator becomes a more faithful convenience layer
  - phase 1 is a thin vertical slice with shared fixture model, shared runner, and normalized message assertions

### Internal References

- `docs/runbooks/whatsapp_agent.md`
- `docs/WHATSAPP_TESTING.md`
- `docs/specs/whatsapp_agent.md`
- `scripts/whatsapp-replay.ts`
- `api/whatsapp-simulate.ts`
- `lib/whatsapp/simulator.ts`
- `lib/whatsapp/transport.ts`
- `lib/whatsapp/webhook.ts`
- `tests/unit/api/whatsapp-webhook.test.ts`

### Institutional Learnings

- `docs/solutions/dx-issues/whatsapp-replay-captures-async-transport-WhatsAppAgent-20260313.md`
- `docs/solutions/logic-errors/quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md`
- `docs/solutions/logic-errors/whatsapp-ga-hardening-dedup-rate-limit-atomic-order.md`

## Next Steps

1. Resolve the first 1-2 phase-1 scenarios during planning.
2. Define the shared fixture/output model before editing simulator or replay surfaces.
3. Implement the vertical slice with docs and regression coverage before expanding scope.
