---
status: complete
priority: p1
issue_id: "158"
tags: [code-review, whatsapp, twilio, reliability]
dependencies: []
---

# Confirm template failure must fall back to DA/NU text (boolean false path)

## Problem Statement

Confirmation (DA/NU) is now the only remaining Twilio template. If Twilio rejects the template (non-2xx), our code can silently treat that as success and send **no** fallback text, leaving the customer stuck with a pending order they cannot confirm/cancel.

## Findings

- `sendTemplateMessage()` returns `false` on Twilio non-OK and does not throw. See [transport.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/transport.ts).
- Call sites only fall back on thrown exceptions, not on `false`:
  - [webhook.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts) `sendPendingOrderConfirmation()`
  - [selection-resolver.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/selection-resolver.ts) `handleCartPickupTime()`
- This is now high impact because template browsing was removed; confirm is the only remaining interactive step.

## Proposed Solutions

### Option 1: Check boolean return at call sites (recommended)

**Approach:** Capture `const ok = await sendTemplateMessage(...)`; if `!ok`, immediately send the plain text fallback.

**Pros:**
- Minimal surface area change
- Keeps `sendTemplateMessage` contract stable

**Cons:**
- Must update all confirmation call sites (at least 2)

**Effort:** 30-60 min

**Risk:** Low

---

### Option 2: Add structured confirmation-send outcome logging

**Approach:** Emit one log per confirmation attempt with `channel=template|text` and `reason=success|http_fail|no_sid|exception`, plus minimal context (`phone`, item count). Optionally add two counters if you have a sink.

**Pros:**
- Makes on-call debugging possible for the last remaining template path
- Lets you verify “fallback text is working” under real failure spikes

**Cons:**
- Slightly noisier logs if not sampled

**Effort:** 30-60 min

**Risk:** Low

---

### Option 2: Make `sendTemplateMessage` throw on non-OK

**Approach:** Change transport to `throw` when `resp.ok` is false.

**Pros:**
- Harder to misuse across the codebase
- Existing `try/catch` fallbacks start working as intended

**Cons:**
- Broader behavioral change; may affect other uses and tests

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

Affected files:
- `lib/whatsapp/transport.ts`
- `lib/whatsapp/webhook.ts`
- `lib/whatsapp/selection-resolver.ts`
- Add unit coverage for the `false` return path (Twilio non-OK).

## Resources

- Review finding: confirm-only templates make this failure mode a UX blocker.
- Related doc pattern: do not swallow transactional failures (see `docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md`).

## Acceptance Criteria

- [ ] If Twilio template send returns `false`, user receives plain text DA/NU prompt.
- [ ] Unit tests cover: template non-OK → text fallback for both pending-order and cart-flow confirmation.
- [ ] No regressions in existing WhatsApp webhook tests.

## Work Log

### 2026-03-19 - Identified In Review

**By:** Codex

**Actions:**
- Reviewed confirmation call sites and transport return contract.
- Confirmed template sends do not throw on non-OK; callers only handle exceptions.

**Learnings:**
- This was low impact when templates were optional throughout; it’s now a primary UX risk because confirmation is the only remaining template.
