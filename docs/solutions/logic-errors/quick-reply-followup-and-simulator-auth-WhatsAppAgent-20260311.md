---
module: WhatsAppAgent
date: 2026-03-11
problem_type: logic_error
component: webhook_handler
symptoms:
  - "WhatsApp follow-up orders like '1 de cada' could drift to unrelated products"
  - "Local WhatsApp integration tests failed with 401 Unauthorized from /api/whatsapp-simulate"
  - "Webhook tests passed without proving confirm/cancel/expired async side effects"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [whatsapp, twilio, simulator, integration-tests, quick-reply, conversation-history, order-flow]
related_github_issue: null
commit: "3c02cf4"
---

# Problem Description

After the Step 4 WhatsApp quick-reply work, the happy-path order flow worked manually, but the branch still had two reliability gaps:

1. Multi-turn follow-ups such as `1 de cada para recoger a las 19:00` were not deterministically tied to the products shown in the previous assistant reply.
2. The local integration suite for `/api/whatsapp-simulate` was brittle because the simulator required `x-notify-secret` when env vars were set, while the tests did not send that header.

This made the branch look greener than it really was: manual WhatsApp testing succeeded for the exact confirm flow, but automated coverage still missed the real regression shape from the Spanish transcript.

# Symptoms

- Manual WhatsApp transcript:
  - user asks for wines
  - assistant shows the correct wine list
  - user replies with a follow-up quantity/time message
  - assistant can drift into unrelated inventory or require extra clarification
- `pnpm vitest run tests/integration/whatsapp-agent.test.ts` failed locally with `Simulator failed: 401`
- Existing webhook tests only asserted immediate TwiML ack/response and did not prove async confirm, cancel, or expired-button side effects

# Root Cause Analysis

There were three separate issues:

## 1) Follow-up extraction only partially understood prior assistant output

The new follow-up path already used `history`, but the order extraction logic still assumed either:
- the user mentioned an exact product in the current message, or
- the assistant had presented a numbered disambiguation menu.

That was not enough for the real transcript shape, where the assistant had listed products in a plain bulleted reply and the user followed with a shorthand order like `1 de cada`.

## 2) Simulator auth and integration tests were misaligned

`api/whatsapp-simulate.ts` correctly enforced a local secret when `WHATSAPP_SIMULATOR_SECRET` or `VITE_NOTIFY_SECRET` was present, but the integration suite always sent only `Content-Type`.

That meant the suite failed before it could exercise any actual WhatsApp behavior.

## 3) Webhook tests covered only immediate response semantics

The webhook tests were strong on signature validation and TwiML shape, but they did not initially prove that button flows actually:
- consumed `pending_order`
- inserted the order on confirm
- skipped insert on cancel
- returned the expired-order message when nothing pending remained

```typescript
// ❌ BEFORE
// Tests asserted the immediate TwiML response, but not the async side effects
expect(res.statusCode).toBe(200)
expect(res.sentBody).toContain('<?xml')
```

# Solution

## 1) Make follow-up order creation reuse the last assistant product list

Added helper logic to extract product-shaped lines from recent assistant messages and reuse them for repeated-quantity follow-ups:

- `extractProductNamesFromAssistantText()`
- `findRecentAssistantProductMentions()`
- `parseRepeatedQuantity()`

This lets the deterministic follow-up path build an `ORDER:` payload from the last shown products when the user says `1 de cada` and provides a pickup time.

```typescript
// ✅ AFTER
if (repeatedQty && recentNames.length >= 2) {
  const payload = {
    customer_name: args.customerName,
    customer_phone: args.customerPhone,
    items: recentNames.map((name) => ({ name, qty: repeatedQty })),
    pickup_time: pickupTime,
  };

  return {
    text: `Perfect — confirm: ${itemsText}, ridicare la ${pickupTime}.\nORDER:${JSON.stringify(payload)}`,
    createdOrder: true,
  };
}
```

## 2) Preserve simulator debug output for deterministic paths

`runConversationTurn()` now returns `debug.intent` even for `store_info` and `cancel_order` branches, which makes integration assertions reliable and keeps the simulator useful for triage.

## 3) Align integration tests with simulator auth

The integration helper now sends `x-notify-secret` automatically when the simulator secret exists in env, so the suite can run in both protected and unprotected local setups.

It also resets state more aggressively between scenarios to avoid cross-test pollution from prior conversation history.

## 4) Harden webhook tests to cover async button side effects

Extended `tests/unit/api/whatsapp-webhook.test.ts` so confirm/cancel/expired cases now assert:

- pending order retrieval/clear
- order insertion on confirm
- no insert on cancel/expired
- final REST message body content

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/integration/whatsapp-agent.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappInventory.test.ts`

# Prevention

- [x] Integration tests now send the simulator secret header when needed
- [x] Added a regression test for `"de cada"` follow-ups reusing the last assistant list
- [x] Added webhook tests for confirm, cancel, and expired-button async effects
- [x] Reset state between natural-date parsing scenarios to avoid history bleed
- [ ] Add one more unit test ensuring summary bullets like `Total` or `Ridicare` are never parsed as product names
- [ ] Expand deterministic follow-up intent handling for Spanish phrases that do not include Romanian/English order verbs

# Related Documentation

- See also: [followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md)
