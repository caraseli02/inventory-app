---
status: complete
priority: p2
issue_id: "095"
tags: [code-review, whatsapp, ux, regression, pending-order]
dependencies: []
---

# Avoid expired-order replies for bare DA/NU without pending state

## Problem Statement

The new pending-order logic treats any standalone `DA` / `NU` message as an expired confirmation when no pending order exists. That changes prior behavior from "ignore and continue normal conversation" to "reply with order expired" for generic yes/no replies.

This is a user-facing regression because customers can send `da` as ordinary conversation, as a response to store info, or after an unrelated message and now get a misleading transactional error.

## Findings

- [`lib/whatsapp/webhook.ts:61`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts#L61) identifies any bare `DA` / `NU` as a pending-order decision candidate.
- [`lib/whatsapp/webhook.ts:68`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts#L68) now sends `Comanda a expirat` and returns `true` whenever there is no pending order.
- Before this change, the no-pending path returned `false`, which allowed the message to fall through to normal conversation handling.
- Current tests cover stale pending orders and happy-path confirm/cancel, but not the "no pending order, plain DA/NU" case.

## Proposed Solutions

### Option 1: Only show expired when a stale pending order was actually found

**Approach:** Distinguish "no pending order exists" from "pending order existed but expired." Fall through for the former, show expired only for the latter.

**Pros:**
- Preserves normal conversational behavior
- Keeps expiry messaging accurate
- Smallest patch

**Cons:**
- Requires the state layer to expose "expired vs absent" result

**Effort:** 30-60 minutes

**Risk:** Low

---

### Option 2: Gate `DA/NU` handling on reply-context metadata or recent confirmation send

**Approach:** Only treat text `DA/NU` as transactional if there is explicit pending-order context or a recent confirmation marker.

**Pros:**
- More precise intent handling
- Reduces accidental transactional interception

**Cons:**
- Slightly more state to carry
- More plumbing than the immediate fix

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

Make the no-pending path fall through to normal conversation, and reserve the expired message for cases where a pending order existed but failed freshness checks. Add regression tests for both "no pending order" and "stale pending order" branches.

## Technical Details

**Affected files:**
- [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts)
- [`lib/whatsapp/conversation-state.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts)
- [`tests/unit/api/whatsapp-webhook.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts)

**Example regression:**
- Customer asks store info
- Later sends `DA` as a generic acknowledgment
- Current behavior: expired-order reply
- Expected behavior: normal conversational handling, unless a pending order actually expired

## Resources

- Review branch: `codex/whatsapp-chat-state-boundaries`

## Acceptance Criteria

- [x] Bare `DA` / `NU` without pending state does not return an expired-order message
- [x] Stale pending orders still return the expired-order message
- [x] Unit tests cover both "no pending" and "stale pending" text fallback behavior

## Work Log

### 2026-03-12 - Code review finding

**By:** Codex

**Actions:**
- Reviewed text confirmation fallback behavior
- Compared new no-pending branch to previous fallthrough semantics
- Identified misleading expired-order reply regression for generic `DA` / `NU`

**Learnings:**
- Expiry messaging should reflect actual expired state, not missing state in general

### 2026-03-12 - Fix implemented

**By:** Codex

**Actions:**
- Added explicit `missing` vs `expired` pending-order states in [`lib/whatsapp/conversation-state.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts)
- Updated text `DA/NU` handling in [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts) so missing pending state falls through to normal conversation while stale state still returns the expiry message
- Added webhook regression coverage for the no-pending `DA` case

**Learnings:**
- Text fallback should only intercept when the transactional state machine is actually active
