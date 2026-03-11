---
module: WhatsAppAgent
date: 2026-03-10
problem_type: logic_error
component: api_client
symptoms:
  - "Customer button-confirm flow created orders with status confirmed immediately"
  - "WhatsApp order state no longer matched the owner-side confirm workflow"
  - "Customer confirmation bypassed the documented pending-before-confirmed lifecycle"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [whatsapp, orders, twilio, pending-order, status-flow, inventory]
related_github_issue: null
commit: "b747f5c"
---

# Problem Description

The WhatsApp quick-reply confirmation flow drifted from the product spec and the existing orders domain model.

When a customer tapped the confirm button, or replied `DA` / `YES`, the webhook inserted the order directly with `status: 'confirmed'`. That made the WhatsApp path semantically different from the in-app Orders flow, where new orders are created as `pending` and only the owner-side confirm action advances them to `confirmed`.

This was risky because the system already treated owner confirmation as the authoritative inventory transition point.

# Symptoms

- Customer confirmation from WhatsApp inserted orders as `confirmed` immediately.
- The WhatsApp path no longer matched the requirement in `docs/specs/whatsapp_agent.md` that order creation should produce `pending` orders first.
- Future code reading `confirmed` could no longer safely assume "owner has already confirmed this order".
- The flow became harder to reason about because one status meant different things depending on the entry point.

# Root Cause Analysis

The new button-confirm logic reused an existing success message and final order insert pattern, but it skipped the domain rule that separates:

1. **Customer intent captured** → `pending`
2. **Owner operational confirmation** → `confirmed`

That rule already existed in both the spec and the owner-side `confirmOrder()` implementation, but the webhook branch introduced a second interpretation of `confirmed`.

In practice, the bug was caused by status semantics drifting across two codepaths:

```typescript
// ❌ BEFORE
await sb.from('orders').insert({
  customer_name: pending.customer_name,
  customer_phone: pending.customer_phone,
  items: pending.items,
  total_price: pending.total_price,
  pickup_time: pending.pickup_time,
  status: 'confirmed',
})
```

# Solution

Restored a single meaning for order statuses: customer confirmation now records a `pending` order request, and owner confirmation remains the transition to `confirmed`.

## 1) Extract the insert into a dedicated helper

This made the intended behavior explicit and avoided repeating the wrong status in multiple branches.

```typescript
// ✅ AFTER
async function createPendingOrderFromPending(sb, pending): Promise<string> {
  const { data: order, error } = await sb
    .from('orders')
    .insert({
      customer_name: pending.customer_name,
      customer_phone: pending.customer_phone,
      items: pending.items,
      total_price: pending.total_price,
      pickup_time: pending.pickup_time,
      status: 'pending',
    })
    .select('order_number')
    .single()

  if (error) throw error
  return order?.order_number ?? '—'
}
```

## 2) Use the helper from both customer-confirm paths

- Quick Reply button payload: `confirm`
- Plain text fallback: `DA` / `YES`

Both paths now create the order as `pending`.

## 3) Update customer-facing copy

The reply text was changed from "order confirmed" wording to "request recorded and awaiting store confirmation", which matches the actual state transition.

## 4) Lock behavior with a unit test

A unit test now asserts that the helper inserts `status: 'pending'`, so future changes have to opt out of that rule deliberately.

# Files Changed

- `api/whatsapp.ts`
- `tests/unit/whatsappAgent.test.ts`
- `docs/whatsapp_agent_overview.md`

# Prevention

- [x] Centralize status-sensitive insert logic in a named helper instead of duplicating raw inserts.
- [x] Keep one meaning per order status across all entry points.
- [x] Add a unit test that asserts customer-confirm paths persist `pending`, not `confirmed`.
- [ ] Add an integration test that exercises button confirm end-to-end and asserts the created row remains `pending`.
- [ ] When changing WhatsApp flow semantics, update the spec and overview docs in the same commit.

## Related Documentation

- `docs/specs/whatsapp_agent.md`
- `docs/solutions/api-errors/client-bundled-secret-whatsapp-notify-20260305.md`
