---
date: 2026-03-13
topic: whatsapp-parity-replay
---

# WhatsApp parity-first local replay for real webhook behavior

## Problem Frame

The repo currently has multiple WhatsApp validation surfaces, but they do not create consistent confidence across flows. The real webhook path, local replay path, and simulator convenience path can disagree on message behavior, which makes local validation hard to trust.

The goal of this effort is not “more WhatsApp tests.” It is to make replay and real webhook behavior authoritative, and make the simulator a much more faithful convenience layer. Phase 1 should focus on parity of user-visible message outcomes and outbound transport behavior, not full internal-state equivalence.

## Requirements

- R1. Replay and real webhook behavior remain the authoritative sources of truth for parity work; the simulator must not be treated as the primary proof that a WhatsApp flow works.
- R2. The project must define one shared fixture/contract model that can represent the message inputs and output expectations needed by both replay and simulator parity checks.
- R3. Phase 1 parity checks must validate user-visible message behavior first: same intended outcome, same critical details, and no extra or missing message that changes the flow.
- R4. Phase 1 parity checks must validate outbound transport behavior only as far as needed to compare externally visible behavior between replay and simulator.
- R5. Phase 1 must deliver a thin vertical slice that includes:
  - a shared fixture model
  - a shared parity runner used by both replay and simulator-oriented validation
  - normalized message assertions
  - coverage for only 1-2 critical flows
- R6. Phase 1 must explicitly exclude:
  - real phone / Twilio end-to-end automation
  - deep LLM prompt redesign
  - full internal-state parity assertions
- R7. The first parity checks should prioritize cases where content mismatch changes meaning, such as different intent/outcome, missing critical details, or extra/missing user-visible messages.
- R8. The work should make it easier to capture future WhatsApp bugs as reusable parity fixtures, even if a full bug-capture workflow is not complete in phase 1.

## Success Criteria

- Engineers can run a small phase-1 parity slice locally and compare replay vs simulator behavior for 1-2 critical flows.
- The parity result tells whether message behavior matches in meaning and critical details, not just whether both paths completed.
- The simulator becomes more trustworthy as a convenience tool without being promoted to source of truth.
- At least one currently confusing mismatch class can be expressed and caught through the new shared parity model.

## Scope Boundaries

- Not a full WhatsApp stabilization project
- Not a replacement of replay with simulator
- Not a requirement for exact wording identity when intent and critical details still match
- Not a full internal-state contract for every transactional transition
- Not real Twilio/phone E2E automation in phase 1

## Approaches Considered

### Approach A: Make the current simulator the truth

Keep the simulator UI as the main tool and gradually patch differences until it behaves like the phone flow.

**Pros:**
- Familiar workflow
- Lower immediate disruption

**Cons:**
- Still maintains two behavior surfaces
- Easy to keep drifting
- Hard to know when parity is actually achieved

### Approach B: Replace simulator-first validation with webhook replay (Recommended)

Make local parity testing run real Twilio-like payloads through the real webhook path. Use the simulator only as a secondary convenience tool.

**Pros:**
- Real behavior surface becomes the test target
- Fixes the actual trust problem
- Easier to debug “works locally, fails on phone”

**Cons:**
- Less convenient than a toy simulator
- Requires replay inputs and fixtures

### Approach C: Maintain both equally

Keep simulator and replay as peers and try to keep both in sync.

**Pros:**
- Flexible

**Cons:**
- More complexity than needed right now
- Does not force one source of truth

## Recommendation

Choose Approach B.

Primary validation should be replaying Twilio-shaped requests through the real webhook path. The simulator should be demoted to a convenience tool, not the proof that the WhatsApp product works.

## Key Decisions

- Source of truth is the real phone/webhook behavior, not the simulator.
- Replay should remain authoritative, but the simulator should become a more faithful convenience layer.
- The next visible progress should be a thin vertical slice, not a broad harness rollout.
- Phase 1 should prioritize a shared fixture model, shared parity runner, and normalized message assertions for 1-2 critical flows.
- The primary parity target is externally visible behavior:
  - same intent/outcome
  - same critical details
  - no extra/missing message that changes the flow
- Wording may differ slightly as long as meaning and critical details still match.
- Replay should still cover the three parity-critical journeys over time:
  - order creation
  - inventory / Q&A
  - confirm / cancel
- Replay inputs should come from both:
  - manually copied real phone transcripts
  - saved repo fixtures
- Start by converting manual real-world transcripts into reusable fixture files.
- The current simulator should be explicitly treated as secondary for parity work.

## Open Questions

### Resolve Before Planning

- None

### Deferred to Planning

- Should the current simulator UI call the replay harness later, or remain a separate convenience path?
- What is the smallest shared fixture format that still captures the Twilio details that matter for parity?
- Which 1-2 critical flows should be in the phase-1 vertical slice first?
- How much real production metadata is needed for useful replay beyond message body, phone, profile name, and button payload?
- What normalization rules are sufficient for “same meaning / same critical details” without becoming too fuzzy?

## Next Steps

→ `/prompts:ce-plan` for structured implementation planning
