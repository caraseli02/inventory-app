---
module: WhatsAppAgent
date: 2026-03-12
problem_type: logic_error
component: api_client
symptoms:
  - "Fresh browse messages could trigger confirmation text for an older pending order"
  - "Product search candidates leaked from prior assistant confirmations into new turns"
  - "Order repair logic could reuse old quantity and pickup details from history"
root_cause: logic_error
resolution_type: code_fix
severity: critical
tags: [whatsapp, conversation-history, pending-order, stale-context, twilio, order-flow, llm]
related_github_issue: null
commit: null
---

# Problem Description

The WhatsApp agent could revive an older order while processing a new customer question.

Repro reported from production on 2026-03-12:

1. Customer previously created a milk pickup request.
2. Customer later sent a fresh browse message asking about meat.
3. Actual behavior: the webhook replied with a confirmation message for the older milk order instead of treating the message as a new inventory query.

This is a high-risk failure because it mixes conversational memory with transactional order state.

# Symptoms

- WhatsApp reply includes stale order lines such as:
  - `1x 370G LAPTE CONDEN INTEG ICINEA`
  - `Ridicare: mâine 10:30`
- Fresh browse text like `Ce aveti?` or `Ce aveti de carne?` can be interpreted through old order context.
- Debug output showed `repairedOrder: true` for a message that did not contain a fresh quantity or pickup time.

# Root Cause Analysis

Three pieces compounded:

## 1) Intent classification was too brittle

`classifyIncomingText()` depended on diacritic-specific matching, so `Ce aveti?` could miss `browse_inventory` classification and fall into `product_query`.

## 2) Search fallback reused assistant text

`extractSearchCandidatesFromHistory()` could read assistant confirmations like:

```text
Perfect — confirm: 1 × 370G LAPTE CONDEN INTEG ICINEA...
```

That leaked old item names back into later turns and biased inventory lookup toward the prior order.

## 3) Order repair borrowed missing fields from old history

`maybeRepairOrderReply()` could rebuild `ORDER:{...}` using quantity and pickup time that came only from prior history, not from the current user message.

That made a fresh browse query capable of rehydrating an old pending order shape.

# Solution

## 1) Normalize intent detection

Use normalized text matching so `Ce aveti?` is classified as `browse_inventory` even without Romanian diacritics.

## 2) Restrict history fallback to prior user turns

History-based product candidate reuse now ignores assistant replies by default.

## 3) Require current-turn order evidence for repair

Order repair now requires the current message to provide both:

- quantity
- pickup time

History can still help with product continuity, but it can no longer supply the entire transactional payload by itself.

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappAgent.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/integration/whatsapp-agent.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/AGENTS.md`
- `/Users/vladislavcaraseli/Documents/inventory-app/CLAUDE.md`
- `/Users/vladislavcaraseli/Documents/inventory-app/docs/runbooks/whatsapp_agent.md`
- `/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/whatsapp_agent.md`

# Prevention

- [x] Add regression coverage for "new browse query after pending order"
- [x] Keep assistant text out of default history-search fallback
- [x] Block history-only order repair
- [x] Document chat-state isolation in repo instructions
- [ ] Add `pending_order` expiry metadata and enforce it at confirmation time
- [ ] Prefer Twilio button payloads / reply context over free-form `DA` / `NU`

## Related Documentation

- [followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md)
- [quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md)
- [button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md)
