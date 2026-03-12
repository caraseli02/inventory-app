---
status: complete
priority: p1
issue_id: "094"
tags: [code-review, whatsapp, data-integrity, concurrency, pending-order]
dependencies: []
---

# Make pending-order confirmation consume atomically

## Problem Statement

The refactor switched confirmation flows from "read-and-clear" semantics to `peekPendingOrder()` followed by a later `clearPendingOrder()`. That opens a race where two concurrent confirm requests can both see the same pending order and both create an `orders` row before either one clears state.

This is a data-integrity issue because duplicate Twilio deliveries, fast double-taps on buttons, or overlapping text/button confirms can now create duplicate pending orders for the same customer request.

## Findings

- [`lib/whatsapp/webhook.ts:67`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts#L67) peeks the pending order for text confirmation, then inserts into `orders`, then clears it afterward.
- [`lib/whatsapp/webhook.ts:141`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts#L141) does the same for button confirmation.
- [`lib/whatsapp/conversation-state.ts:78`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts#L78) and [`lib/whatsapp/conversation-state.ts:102`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts#L102) now expose `peekPendingOrder()` / `consumePendingOrder()`, but the webhook does not use an atomic consume path before creating the order.
- Before this refactor, `getPendingOrder()` cleared on fetch, which reduced duplicate-confirm risk. The new flow improves semantics but regresses idempotency.

## Proposed Solutions

### Option 1: Consume before insert

**Approach:** Replace confirm paths with `consumePendingOrder()` so only the first request gets the pending payload.

**Pros:**
- Smallest code change
- Restores prior duplicate-confirm protection
- Keeps webhook logic simple

**Cons:**
- Still not truly transactional if the clear and read are separate DB operations
- Failed inserts may drop the pending order unless consume is reversible

**Effort:** 30-60 minutes

**Risk:** Medium

---

### Option 2: Add atomic DB consume helper

**Approach:** Use a single SQL/RPC operation that returns the pending payload only if it exists and clears it in the same transaction.

**Pros:**
- Correct under concurrent confirms
- Best long-term state-machine boundary
- Easy to reason about operationally

**Cons:**
- Requires schema/RPC work
- Slightly broader test/migration surface

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 3: Add idempotency key on order creation

**Approach:** Store a pending-order token and reject duplicate inserts for the same token.

**Pros:**
- Protects against retries even if state consumption races
- Useful for future webhook dedupe

**Cons:**
- Larger model change
- More moving parts than the current fix needs

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

Use an atomic consume path before order creation. If you want the fast fix first, switch confirm flows to `consumePendingOrder()` and add a regression for simultaneous confirms, then follow up with a DB-level atomic consume helper.

## Technical Details

**Affected files:**
- [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts)
- [`lib/whatsapp/conversation-state.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts)
- [`tests/unit/api/whatsapp-webhook.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts)

**Failure mode:**
- Request A and request B both call `peekPendingOrder()`
- Both receive the same payload
- Both call `createPendingOrderFromPending()`
- One or both later clear the same `pending_order`
- Result: duplicate `orders` rows from one customer intent

## Resources

- Review branch: `codex/whatsapp-chat-state-boundaries`
- Related todo: [`todos/093-complete-p1-whatsapp-chat-state-boundaries.md`](/Users/vladislavcaraseli/Documents/inventory-app/todos/093-complete-p1-whatsapp-chat-state-boundaries.md)

## Acceptance Criteria

- [x] Confirmation paths cannot create duplicate orders from the same pending payload under concurrent requests
- [x] Confirm handling is atomic or otherwise idempotent
- [x] Regression tests cover duplicate Twilio delivery / double confirm scenarios

## Work Log

### 2026-03-12 - Code review finding

**By:** Codex

**Actions:**
- Reviewed the pending-order lifecycle refactor
- Compared old clear-on-read behavior with the new `peek` then `clear` flow
- Identified duplicate-order risk in confirm paths

**Learnings:**
- Clearer semantics are good, but confirmation still needs atomic consume or idempotency

### 2026-03-12 - Fix implemented

**By:** Codex

**Actions:**
- Reworked [`lib/whatsapp/conversation-state.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts) so `consumePendingOrder()` clears and returns the pending payload through a single update-returning query path
- Updated [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts) confirm handlers to consume before insert and restore the pending order if order creation fails
- Extended state/webhook unit tests to cover the new consume semantics

**Learnings:**
- Atomic consume at the state boundary is the right place to protect webhook retries and double confirms
