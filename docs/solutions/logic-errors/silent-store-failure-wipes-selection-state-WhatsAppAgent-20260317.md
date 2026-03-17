---
module: WhatsAppAgent
date: 2026-03-17
problem_type: logic_error
component: api_client
symptoms:
  - "Customer's cart silently disappears after providing pickup time on Supabase transient error"
  - "User sees order confirmation summary text but no pending_order exists in DB"
  - "No way for user to retry — both pending_selection (cart) and pending_order are gone"
  - "storePendingOrder returns void even when the DB write fails"
root_cause: missing_error_handler
resolution_type: code_fix
severity: critical
tags: [whatsapp, cart, order, supabase, silent-failure, data-integrity, state-machine, error-handling]
related_github_issue: null
commit: b2be189
---

# Problem Description

In `handleCartPickupTime`, the order-creation sequence was:

```typescript
await storePendingOrder(sb, phone, pending);          // step 1
await storePendingProductSelection(sb, phone, {});    // step 2 — clears cart
```

`storePendingOrder` had a bare `try/catch` that logged the error and returned void. If step 1 failed (Supabase transient error, timeout, network blip), the error was swallowed, step 2 still ran, and the customer's cart was permanently destroyed. The user received the "Rezumat comandă" text (rendered client-side before the DB write) but no order existed in the database.

This is a critical ordering invariant: **never clear transactional state before confirming the write succeeded**.

# Symptoms

- Supabase temporarily unavailable → `storePendingOrder` logs error silently → `storePendingProductSelection(…, {})` wipes cart
- User gets confirmation summary text but cart is gone — no order was created
- No retry possible: pending_selection is `{}`, pending_order is null
- Appears as "lost order" in production; customer may reorder thinking first attempt failed

# Root Cause Analysis

`conversation-state.ts` — `storePendingOrder` swallowed all errors:

```typescript
// ❌ BEFORE — error swallowed, caller cannot detect failure
export async function storePendingOrder(sb, phone, order): Promise<void> {
  try {
    await sb.from('conversation_history').upsert({ ... });
  } catch (err) {
    console.error('[whatsapp] failed to store pending order:', err);
    // returns void — caller sees success
  }
}
```

`selection-resolver.ts` — caller cleared cart unconditionally:

```typescript
// ❌ BEFORE — cart cleared even if order write failed
await storePendingOrder(args.sb, args.phone, pending);
await storePendingProductSelection(args.sb, args.phone, {}); // runs regardless
```

# Solution

Remove the try/catch from `storePendingOrder` so errors propagate to the caller:

```typescript
// ✅ AFTER — error propagates; caller decides what to do
export async function storePendingOrder(sb, phone, order): Promise<void> {
  // Intentionally not catching errors — callers must handle failure so they
  // don't clear the cart (pending_selection) when the order write fails.
  const pendingOrder = { ...order, pending_order_created_at: order.pending_order_created_at ?? nowIso() };
  await sb.from('conversation_history').upsert(
    { phone_number: phone, pending_order: pendingOrder as unknown },
    { onConflict: 'phone_number' }
  );
}
```

The caller's error path (from the outer try/catch in `handleRestConversation`) will surface the Supabase error as a generic "a apărut o eroare" message — but crucially, `pending_selection` (cart) is NOT cleared. The user can retry by sending the pickup time again.

```typescript
// ✅ AFTER — cart is only cleared after confirmed order write
await storePendingOrder(args.sb, args.phone, pending);    // may throw
await storePendingProductSelection(args.sb, args.phone, {}); // only if above succeeded
```

# Files Changed

- `lib/whatsapp/conversation-state.ts` (storePendingOrder — removed try/catch)

# Prevention

- [ ] Rule: **Never clear transactional state (cart, selection) before confirming the write of dependent state (order) succeeded.** The dependent write must either propagate errors or return a success boolean.
- [ ] Pattern: any function that writes transactional state and is followed by a cleanup step must propagate errors, not swallow them.
- [ ] The same pattern applied here: `storePendingProductSelection` also swallows errors — if the cart write fails but selection is cleared, state is also corrupted. Consider the same fix there.

## See Also

- [atomic-pending-order-consume-whatsappagent-20260312.md](./atomic-pending-order-consume-whatsappagent-20260312.md) — related: atomic consume to prevent double-confirm race
- [whatsapp-ga-hardening-dedup-rate-limit-atomic-order.md](./whatsapp-ga-hardening-dedup-rate-limit-atomic-order.md) — broader order lifecycle hardening
