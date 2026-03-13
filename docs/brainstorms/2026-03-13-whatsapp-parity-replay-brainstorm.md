---
date: 2026-03-13
topic: whatsapp-parity-replay
---

# WhatsApp parity-first local replay for real webhook behavior

## What We're Building

Shift local WhatsApp validation away from the current simulator as the main source of truth.

The next product step should be one reproducible local replay flow that sends Twilio-shaped inbound requests through the real WhatsApp webhook/orchestration path. The goal is to reproduce what happens on phone locally for the three flows that matter most right now:

- order creation
- inventory / Q&A
- confirm / cancel

The current simulator can still exist, but it should stop being treated as the authoritative way to validate product behavior when parity with the real phone flow matters.

## Why This Approach

The current problem is not just that one branch is buggy. It is that there are effectively two WhatsApp systems:

- real phone flow through Twilio + the real webhook
- local simulator flow through separate simulator-specific logic

Because of that split, local results differ from phone results for ordering, Q&A, and confirm/cancel. That makes it hard to trust progress. The simplest useful correction is not more hardening or more cleanup first. It is to make the real webhook path locally reproducible.

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
- The next visible progress should be one reproducible local replay flow.
- Replay should cover the three parity-critical journeys first:
  - order creation
  - inventory / Q&A
  - confirm / cancel
- Replay inputs should come from both:
  - manually copied real phone transcripts
  - saved repo fixtures
- Start by converting manual real-world transcripts into reusable fixture files.
- The current simulator should be explicitly treated as secondary for parity work.

## Open Questions

- Should the current simulator UI call the replay harness later, or remain a separate convenience path?
- What is the smallest transcript fixture format that still captures the Twilio details that matter?
- How much real production metadata is needed for useful replay beyond message body, phone, profile name, and button payload?

## Next Steps

→ `/workflows:plan` to define the replay harness scope, transcript/fixture format, and first parity scenarios.
