---
module: WhatsAppAgent
date: 2026-03-19
problem_type: logic_error
component: server_component
symptoms:
  - "After removing browse/qty templates, confirmation (DA/NU) could be dropped when Twilio rejected the template, leaving the customer stuck."
  - "A stale confirm/cancel click could clear an unrelated active cart (`pending_selection`)."
  - "Cart-flow could clear selection state after a pending-order write that returned a Supabase error object."
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [whatsapp, twilio, confirmation-flow, pending-order, pending-selection, text-fallback, state-machine, templates]
related_github_issue: null
commit: null
---

# Confirm-only templates: enforce text fallback and protect cart state

## Problem Description

After a week of instability with Twilio Content templates, we removed interactive templates everywhere except the final order confirmation (DA/NU buttons). That refactor exposed a set of subtle transactional/state bugs:

- confirmation could be silently dropped when Twilio rejected the template (no text fallback)
- stale DA/NU clicks could wipe an unrelated in-progress cart
- cart-flow could clear `pending_selection` after a failed `storePendingOrder` upsert that returned `{ error }` without throwing

## Root Cause Analysis

### 1) Transport contract mismatch (`false` is failure, not success)

`sendTemplateMessage()` returns `false` on Twilio non-2xx; it does not throw. Call sites that only used `try/catch` handled exceptions but missed the `false` path, so confirmation could be dropped with no fallback.

### 2) Transactional state cleared too broadly

`pending_selection` is transactional cart/selection state. Clearing it on *any* confirm/cancel attempt (including missing/expired/already-* outcomes) can destroy a newer cart flow when a user taps an older message.

### 3) Supabase `{ error }` was not surfaced as an exception

The Supabase client commonly returns `{ data, error }` instead of throwing. `storePendingOrder()` awaited `.upsert(...)` but didn’t check `{ error }`, so callers could proceed as if the pending order was stored even when it wasn’t.

## Solution

### 1) Centralize confirmation delivery + fallback in one helper

Added [`confirm-prompt.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/confirm-prompt.ts) to own the confirmation send contract:

- try `TWILIO_CONFIRM_CONTENT_SID`
- fall back to text if SID missing
- fall back to text if template send returns `false`
- fall back to text if template send throws

Both confirmation entry points now call this helper:
- pending-order path: [`webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts)
- cart-flow path: [`selection-resolver.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/selection-resolver.ts)

### 2) Only clear cart state after a real pending-order transition

Updated confirm/cancel button handling so `pending_selection` is cleared only when:

- the pending order actually transitions (confirmed/cancelled), and
- the current `pending_selection.created_at` is not newer than the pending order’s `pending_order_created_at` (so an older DA/NU tap can’t wipe a newer cart flow)

Missing/expired/already-* outcomes do not wipe cart state. See [`webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts).

### 3) Make `storePendingOrder()` fail loud on Supabase `{ error }`

Updated [`conversation-state.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts) so `storePendingOrder()` checks the returned `{ error }` and throws. This ensures cart-flow cannot clear `pending_selection` after a failed pending-order write.

### 4) Text-only flow boundary and rollout safety fixes

- Accept numeric selection `10` (matches max 10 disambiguation items). See [`webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts).
- Increased category picker cap to 10 (template-era cap was 6). See [`selection-resolver.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/selection-resolver.ts).
- Restored legacy `product_N` callback handling so older list-picker messages don’t dead-end during rollout. See [`webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts).

## Tests

Added/updated unit tests to lock behavior:

- Confirmation fallback on boolean `false`: [`whatsapp-confirm-prompt.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/lib/whatsapp-confirm-prompt.test.ts)
- Confirm button does not wipe a newer cart flow: [`whatsapp-webhook.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts)
- `storePendingOrder()` throws on upsert `{ error }`: [`whatsapp-conversation-state.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-conversation-state.test.ts)
- Cart-flow confirmation fallback and “don’t clear selection on pending-order write failure”: [`whatsapp-selection-resolver.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/lib/whatsapp-selection-resolver.test.ts)

## Prevention

### Hard rules

1. **Boolean-return transport must be treated as failure on `false`.**
   Wrap delivery behind a single helper (like `sendConfirmPrompt`) so call sites can’t forget the `false` path.

2. **Never clear transactional state before the dependent write is confirmed.**
   `pending_selection` must not be cleared unless:
   - `storePendingOrder()` succeeded without `{ error }`
   - confirm/cancel actually transitioned the *fresh* pending order

### Suggested regression tests

- `sendConfirmPrompt` falls back when SID missing, when it returns `false`, and when it throws.
- stale confirm/cancel does not clear `pending_selection` when pending order is missing/expired/already-*.
- numeric parsing accepts `10` when 10 options are shown.

## See Also

- [atomic-pending-order-consume-whatsappagent-20260312.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/atomic-pending-order-consume-whatsappagent-20260312.md)
- [silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md)
- [stale-history-revives-old-order-WhatsAppAgent-20260312.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md)
- [dynamic-list-picker-content-api-any-item-count-WhatsAppAgent-20260316.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/integration-issues/dynamic-list-picker-content-api-any-item-count-WhatsAppAgent-20260316.md) (historical context)
- [twilio-21656-undeclared-variables-dynamic-template-WhatsAppAgent-20260317.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/integration-issues/twilio-21656-undeclared-variables-dynamic-template-WhatsAppAgent-20260317.md) (historical context)
