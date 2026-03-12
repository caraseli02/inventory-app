---
module: WhatsAppAgent
date: 2026-03-12
problem_type: logic_error
component: api_client
symptoms:
  - "Concurrent or duplicate WhatsApp confirms could create the same pending order twice"
  - "Bare DA / NU messages without pending state returned an incorrect expired-order reply"
  - "Pending-order expiry and pending-order absence were handled as the same state"
root_cause: logic_error
resolution_type: code_fix
severity: critical
tags: [whatsapp, pending-order, twilio, confirmation-flow, idempotency, chat-state, order-lifecycle]
related_github_issue: null
commit: null
---

# Problem Description

After the WhatsApp chat-state hardening refactor, the pending-order lifecycle became clearer but introduced two follow-on regressions:

1. confirm paths used `peekPendingOrder()` and only cleared state after the order insert, which reopened a duplicate-confirm race
2. bare `DA` / `NU` messages with no pending order were treated as "expired order" instead of falling back to normal conversation handling

This mattered because Twilio retries and double-taps are realistic production events, and because the customer-facing expired-order message should only appear when a pending order actually existed and aged out.

# Symptoms

- Two confirm requests arriving close together could both observe the same pending payload and both insert an order.
- Text `DA` / `NU` without active pending state replied with `⚠️ Comanda a expirat. Te rog trimite din nou.`
- Missing pending state and expired pending state collapsed into the same `null` branch.
- Review identified the issue before merge, but it needed a code fix plus regression coverage.

# Root Cause Analysis

The first refactor separated "peek" from "clear", but confirmation still followed this sequence:

1. read pending order
2. insert into `orders`
3. clear `conversation_history.pending_order`

That ordering is unsafe under duplicate delivery because step 1 is not exclusive.

```typescript
// ❌ BEFORE
const pending = await peekPendingOrder(sb, phone)
if (!pending) {
  await sendRestMessage(from, '⚠️ Comanda a expirat. Te rog trimite din nou.')
  return
}

const orderNumber = await createPendingOrderFromPending(sb, pending)
await clearPendingOrder(sb, phone)
```

The second issue came from treating every `null` pending-order lookup as "expired". But there are two distinct cases:

- no pending order exists
- a pending order existed and expired

Only the second case should surface expiry messaging. The first should fall through to the normal conversation pipeline.

# Solution

## 1) Add explicit pending-order state classification

`conversation-state.ts` now distinguishes:

- `fresh`
- `expired`
- `missing`

That lets webhook logic decide whether to intercept or continue.

```typescript
export type PendingOrderState =
  | { status: 'missing'; order: null }
  | { status: 'expired'; order: null }
  | { status: 'fresh'; order: PendingOrder }
```

## 2) Consume the pending order through a single update-returning path

Confirmation now uses `consumePendingOrder()` instead of `peek` then later `clear`.

```typescript
// ✅ AFTER
const pendingState = await consumePendingOrder(sb, phone)
if (pendingState.status !== 'fresh') {
  await sendRestMessage(from, '⚠️ Comanda a expirat. Te rog trimite din nou.')
  return
}

const orderNumber = await createPendingOrderFromPending(sb, pendingState.order)
```

This moved consume semantics to the state boundary, which is the right place to defend against duplicate deliveries and double confirms.

## 3) Restore pending state if order creation fails after consume

Because confirmation now consumes before insert, failed order creation must not silently drop the pending order. The webhook now re-stores the consumed payload on insert failure before replying with an error.

## 4) Reserve expiry replies for actual stale pending orders

Text fallback now behaves like this:

- `fresh` pending order: handle `DA` / `NU`
- `expired` pending order: send expired-order reply
- `missing` pending order: return `false` and continue normal conversation flow

That preserves user-facing accuracy without weakening stale-order protection.

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-conversation-state.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/todos/094-complete-p1-atomic-pending-order-consume.md`
- `/Users/vladislavcaraseli/Documents/inventory-app/todos/095-complete-p2-da-nu-no-pending-regression.md`

# Prevention

- [x] Keep pending-order state classification explicit: `fresh`, `expired`, `missing`
- [x] Consume transactional state before confirm inserts, not after
- [x] Restore consumed pending state if downstream order persistence fails
- [x] Add regression coverage for no-pending `DA` fallback
- [x] Add regression coverage for stale pending-order expiry
- [ ] Add a concurrency-focused regression that simulates duplicate confirm delivery against the same pending order
- [ ] Prefer explicit reply-context metadata or button correlation ids once Twilio payload support is wired fully

## Related Documentation

- [stale-history-revives-old-order-WhatsAppAgent-20260312.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md)
- [button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md)
- [docs/plans/2026-03-12-refactor-whatsapp-chat-state-plan.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-12-refactor-whatsapp-chat-state-plan.md)
