---
status: complete
priority: p1
issue_id: "093"
tags: [whatsapp, pending-order, conversation-history, state-machine, regression]
dependencies: []
---

# Harden WhatsApp chat-state boundaries

## Problem Statement

WhatsApp chat memory and pending transactional state are still coupled tightly enough that a fresh browse query can revive or confirm an older order. The current lifecycle also clears `pending_order` on read, which makes text confirmation, button confirmation, expiry handling, and parity testing harder to reason about.

## Findings

- `lib/whatsapp/conversation-state.ts` stores `pending_order` but `getPendingOrder()` also clears it, so read and consume semantics are conflated.
- `lib/whatsapp/webhook.ts` uses that implicit clear path for both `DA/NU` fallback and `ButtonPayload` confirm/cancel handling.
- `lib/whatsapp/llm.ts` already blocks some stale-history order repair, but confirmation still depends on weak pending-order freshness semantics.
- Existing unit/integration coverage hits basic confirm/cancel paths, but not explicit expiry metadata or parity across text and button confirmations.

## Proposed Solutions

### Option 1: Minimal boundary hardening in current table

**Approach:** Keep `conversation_history` as the storage surface, add pending-order metadata and explicit `peek` / `consume` helpers, then update webhook/tests/docs.

**Pros:**
- Smallest change set
- Directly addresses current production bug shape
- Keeps mocks and simulator changes manageable

**Cons:**
- Transactional state still lives in the same table as chat memory
- Long-term state-machine complexity remains in app code

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Split pending state into a separate table now

**Approach:** Introduce dedicated pending-order persistence with independent lifecycle timestamps and references.

**Pros:**
- Stronger domain boundaries
- Cleaner future state transitions

**Cons:**
- Migration and wider app/test blast radius
- Slower path to shipping current fix

**Effort:** 1-2 days

**Risk:** High

## Recommended Action

Implement Option 1 now. Add explicit pending-order metadata and fresh-only confirmation/consume helpers, align webhook logic across button and text confirmation, expand stale-history and expired-order regressions, then update plan/runbook/spec guidance.

## Technical Details

**Affected files:**
- `lib/whatsapp/conversation-state.ts`
- `lib/whatsapp/webhook.ts`
- `lib/whatsapp/llm.ts`
- `lib/whatsapp/conversation.ts`
- `lib/whatsapp/types.ts`
- `tests/unit/api/whatsapp-conversation-state.test.ts`
- `tests/unit/api/whatsapp-webhook.test.ts`
- `tests/unit/whatsappAgent.test.ts`
- `tests/integration/whatsapp-agent.test.ts`
- `docs/plans/2026-03-12-refactor-whatsapp-chat-state-plan.md`
- `docs/runbooks/whatsapp_agent.md`
- `docs/specs/whatsapp_agent.md`
- `AGENTS.md`
- `CLAUDE.md`

**Database changes (if any):**
- No migration required for the first pass if metadata remains inside `pending_order`.
- Optional follow-up: add first-class `pending_order_created_at` column if current table shape still feels too implicit.

## Resources

- `docs/plans/2026-03-12-refactor-whatsapp-chat-state-plan.md`
- `docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md`
- `docs/runbooks/whatsapp_agent.md`

## Acceptance Criteria

- [x] Pending-order reads no longer silently consume state unless the caller explicitly asks to consume it.
- [x] Text `DA/NU` fallback only works with one fresh pending order.
- [x] Button confirm/cancel obeys the same consume/expiry lifecycle as text fallback.
- [x] Regression tests cover stale-history browse, expired pending order, and exact-order then fresh browse flows.
- [x] Docs and plan reflect the explicit chat-state boundary rules.

## Work Log

### 2026-03-12 - Initial execution

**By:** Codex

**Actions:**
- Read the refactor plan, production solution note, and runbook guidance
- Inspected current state API, webhook confirm/cancel flow, LLM turn orchestration, and regression tests
- Chose minimal boundary hardening in current table surface as the first implementation pass

**Learnings:**
- `getPendingOrder()` is the main coupling point because it both reads and clears
- Tests already provide good seams for state and webhook changes without needing a broad harness rewrite
- The cleanest first move is explicit freshness metadata plus `peek`/`consume` semantics

### 2026-03-12 - Implementation complete

**By:** Codex

**Actions:**
- Added explicit `peekPendingOrder`, `consumePendingOrder`, and `clearPendingOrder` helpers in [`lib/whatsapp/conversation-state.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts)
- Stamped stored pending orders with `pending_order_created_at` and enforced expiry via `WHATSAPP_PENDING_ORDER_TTL_MINUTES` defaulting to 120 minutes
- Updated [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts) so text and button confirm/cancel paths require one fresh pending order and only clear state on explicit transitions
- Added fresh/expired pending-order regression coverage in unit tests and stale-history browse protection coverage in [`tests/unit/whatsappInventory.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappInventory.test.ts)
- Updated plan/spec/runbook/instructions docs to reflect the new transactional-state boundary
- Ran `pnpm vitest run tests/unit/whatsappAgent.test.ts tests/integration/whatsapp-agent.test.ts tests/unit/api/whatsapp-conversation-state.test.ts tests/unit/api/whatsapp-webhook.test.ts tests/unit/whatsappInventory.test.ts`
- Ran `pnpm lint`

**Learnings:**
- Explicit peek/clear semantics remove the main source of accidental pending-order replay
- Confirm should clear pending state only after successful order creation; clearing on read was too lossy
- The existing simulator/integration harness was already strong enough to validate stale-history protection without wider plumbing changes
