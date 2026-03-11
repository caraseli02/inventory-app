---
status: pending
priority: p3
issue_id: "092"
tags: [code-review, whatsapp, regression, ux]
dependencies: []
---

# Restore typing indicator on DA/NU confirmation

Bring back the typing/read side effect for typed `DA/NU` or `YES/NO` confirmation replies in the WhatsApp webhook.

## Problem Statement

The Phase 5 webhook extraction moved the `sendTypingIndicator()` call into the general REST conversation path. That means customers who confirm or cancel a pending order by typing `DA`, `NU`, `YES`, or `NO` no longer get the read/typing side effect that the pre-refactor route emitted before handling the fallback branch.

This is a small UX regression, but the refactor plan explicitly aimed to preserve customer-visible behavior while reducing route size.

## Findings

- Before the extraction, [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) sent the typing indicator before checking the typed `DA/NU` fallback path. See `HEAD:api/whatsapp.ts#L128-L145`.
- After the extraction, [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts#L164) only sends the typing indicator inside `handleRestConversation()`.
- The typed pending-order decision path now exits earlier through [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts#L53) and never reaches the typing-indicator call.
- Existing route tests still pass because they assert TwiML/REST behavior, not the typing-indicator side effect.

## Proposed Solutions

### Option 1: Move the typing indicator back above the typed fallback branch

**Approach:** Emit `sendTypingIndicator(messageSid)` once for all REST-capable text messages before `handlePendingTextDecision()`.

**Pros:**
- Restores the exact pre-refactor sequencing
- Minimal code change
- Keeps behavior centralized in one place

**Cons:**
- Reintroduces a bit of orchestration logic in the top-level handler

**Effort:** 15-30 minutes

**Risk:** Low

---

### Option 2: Trigger typing inside `handlePendingTextDecision()`

**Approach:** Pass `messageSid` into the pending-decision helper and emit the typing indicator only for that branch.

**Pros:**
- Keeps the route orchestration more compartmentalized
- Makes the side effect explicit in the branch that needs it

**Cons:**
- Slightly duplicates logic with `handleRestConversation()`
- Easier to drift again if another early-return path is added

**Effort:** 20-40 minutes

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts)
- [`tests/unit/api/whatsapp-webhook.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts)

**Related components:**
- Twilio typing/read receipt transport in [`lib/whatsapp/transport.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/transport.ts)
- Pending-order fallback flow in [`lib/whatsapp/conversation-state.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts)

**Database changes:**
- None

## Resources

- **Review scope:** local Phase 5 webhook extraction review
- **Previous implementation reference:** `git show HEAD:api/whatsapp.ts`
- **Plan:** [`docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md)

## Acceptance Criteria

- [ ] Typed `DA/NU` or `YES/NO` pending-order confirmations still trigger the typing/read side effect when REST credentials are configured
- [ ] Existing TwiML/REST response behavior remains unchanged
- [ ] A webhook unit test covers the typing-indicator behavior for the typed pending-order path

## Work Log

### 2026-03-11 - Review finding

**By:** Codex

**Actions:**
- Compared the extracted webhook flow against the pre-refactor route implementation
- Verified that `sendTypingIndicator()` moved from the shared pre-branch path into `handleRestConversation()`
- Confirmed the typed pending-order decision helper now returns before the typing indicator can fire

**Learnings:**
- The functional tests cover the reply modes well but not this side effect
- The regression is low-risk but directly conflicts with the behavior-preserving goal of the refactor
