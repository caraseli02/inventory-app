---
status: complete
priority: p2
issue_id: "096"
tags: [code-review, whatsapp, testing, replay, reliability]
dependencies: []
---

# Replay harness does not validate async webhook replies

## Problem Statement

The new fixture-backed WhatsApp replay flow is documented as the authoritative local parity check for phone behavior, but it only captures the immediate HTTP/TwiML response from `POST /api/whatsapp`. For the real webhook path, the meaningful product/order reply is often sent later via `waitUntil(...sendRestMessage(...))`, so the replay can report success while missing the actual user-visible behavior.

## Findings

- [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts#L279) sends an immediate TwiML ack or empty TwiML, then does the real reply asynchronously through `waitUntil(...)` and `sendRestMessage(...)`.
- [`scripts/whatsapp-replay.ts`](/Users/vladislavcaraseli/Documents/inventory-app/scripts/whatsapp-replay.ts#L233) extracts only the immediate `<Message>` from the HTTP response and never captures async REST/template follow-up output.
- The script explicitly tells the user to inspect server logs manually instead of producing structured replay results for the async phase: [`scripts/whatsapp-replay.ts`](/Users/vladislavcaraseli/Documents/inventory-app/scripts/whatsapp-replay.ts#L246).
- The new docs call this flow the "authoritative local parity path": [`docs/WHATSAPP_TESTING.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/WHATSAPP_TESTING.md#L48).
- The starter fixtures mostly assert only the initial ack, not the actual business outcome for Q&A, order creation, or confirm/cancel: [`fixtures/whatsapp-replay/order-creation.json`](/Users/vladislavcaraseli/Documents/inventory-app/fixtures/whatsapp-replay/order-creation.json), [`fixtures/whatsapp-replay/confirm-cancel.json`](/Users/vladislavcaraseli/Documents/inventory-app/fixtures/whatsapp-replay/confirm-cancel.json).

## Proposed Solutions

### Option 1: Capture transport output in replay mode (Recommended)

**Approach:** Add a replay/test mode around WhatsApp transport so the harness can collect both the immediate TwiML response and the later REST/template sends in-process, then assert against both.

**Pros:**
- Actually validates the real user-visible reply path
- Keeps webhook replay as the source of truth
- Makes fixtures useful for parity regression checks

**Cons:**
- Requires a small test seam in transport or webhook orchestration
- Slightly more plumbing than the current script

**Effort:** Medium
**Risk:** Low

### Option 2: Downgrade replay docs from "authoritative" to "partial"

**Approach:** Keep the script as-is, but document that it validates only signed request entry and immediate TwiML ack, not final reply parity.

**Pros:**
- Minimal code change
- Removes the current overclaim

**Cons:**
- Does not solve the parity-validation problem
- Leaves the main product gap open

**Effort:** Small
**Risk:** Medium

### Option 3: Add a log-scraping wrapper around the dev server

**Approach:** Keep using the real webhook path, but run replay through a wrapper that tails server logs and extracts async reply events for assertions.

**Pros:**
- Avoids changing webhook/transport code immediately
- Can validate more than TwiML alone

**Cons:**
- Brittle and environment-dependent
- Harder to maintain than an explicit test seam

**Effort:** Medium
**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `scripts/whatsapp-replay.ts`
- `lib/whatsapp/webhook.ts`
- `lib/whatsapp/transport.ts`
- `docs/WHATSAPP_TESTING.md`
- `docs/runbooks/whatsapp_agent.md`
- `fixtures/whatsapp-replay/*.json`

## Acceptance Criteria

- [ ] Replay output includes the async REST/template reply path, not only immediate TwiML
- [ ] Fixtures can assert the user-visible reply or pending-order/template outcome for key scenarios
- [ ] Docs describe replay capabilities accurately
- [ ] Q&A, order creation, and confirm/cancel parity fixtures fail when the async business outcome is wrong

## Work Log

### 2026-03-13 - Review finding created

**By:** Codex

**Actions:**
- Reviewed the new replay harness against the real webhook control flow
- Verified the webhook sends meaningful replies asynchronously via `waitUntil(...sendRestMessage(...))`
- Verified the replay script only inspects the immediate HTTP/TwiML response
- Recorded the mismatch as a tracked todo

**Learnings:**
- The current replay flow is useful for signed request entry and basic route coverage
- It is not yet sufficient to serve as the authoritative parity check for real phone-visible behavior

### 2026-03-13 - Fix implemented

**By:** Codex

**Actions:**
- Added replay request context in `lib/whatsapp/replay-context.ts`
- Wrapped webhook handling so replay requests carry a replay id through async transport
- Updated `lib/whatsapp/transport.ts` to capture typing, REST, and template sends during replay
- Updated `scripts/whatsapp-replay.ts` to send replay ids, poll captured async events, print them, and support async assertions
- Updated testing docs/runbook to state that replay now captures async transport output

**Learnings:**
- The clean fix was to instrument the real transport seam, not scrape logs
- Replay can stay HTTP-based and still observe async outcomes if request context is propagated through the webhook flow

## Resources

- Plan: `docs/plans/2026-03-13-feat-whatsapp-webhook-parity-replay-plan.md`
- Brainstorm: `docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md`
