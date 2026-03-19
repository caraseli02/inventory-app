---
status: complete
priority: p2
issue_id: "160"
tags: [code-review, whatsapp, state-machine, data-integrity]
dependencies: []
---

# confirm/cancel button should not clear pending_selection unless it acted on a fresh pending_order

## Problem Statement

A stale “Da/Nu” button click from an old confirmation message can wipe a user’s in-progress cart flow (`pending_selection`) even when there is no fresh `pending_order` to act on. That destroys unrelated transactional state.

## Findings

- In [webhook.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts), `handleButtonPayload()` calls `clearPendingSelection()` for both `confirm` and `cancel` immediately after `applyPendingOrderDecision(...)`, regardless of outcome.
- If `applyPendingOrderDecision` returns “missing/expired/already_*”, we should not clear cart state that may be unrelated to the clicked message.

## Proposed Solutions

### Option 1: Clear cart only on real state transition (recommended)

**Approach:** Clear `pending_selection` only when outcome is `confirmed` / `cancelled` (and possibly `already_confirmed` / `already_exists_cannot_cancel` if those imply the pending order existed for this user).

**Pros:**
- Prevents unrelated cart loss
- Aligns with “transactional state cleared only after explicit state transition”

**Cons:**
- Requires careful mapping of `applyPendingOrderDecision` outcomes to transitions

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Clear only if pending_order was fresh at time of decision

**Approach:** Have `applyPendingOrderDecision` return an explicit `actedOnFreshPending: boolean`, and clear selection only when true.

**Pros:**
- Most precise

**Cons:**
- Requires plumbing new field through decision helper

**Effort:** 2-4 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

Affected files:
- `lib/whatsapp/webhook.ts`
- `lib/whatsapp/pending-order.ts` (if needed for richer outcome signal)

## Acceptance Criteria

- [ ] Stale confirm/cancel clicks do not clear an active cart (`pending_selection`).
- [ ] Confirm/cancel that actually transitions the pending order still clears cart selection appropriately.
- [ ] Unit test covering: active `pending_selection` + stale confirm click does not wipe cart.

## Work Log

### 2026-03-19 - Identified In Review

**By:** Codex

**Actions:**
- Reviewed `confirm`/`cancel` button handling and state clearing logic.
