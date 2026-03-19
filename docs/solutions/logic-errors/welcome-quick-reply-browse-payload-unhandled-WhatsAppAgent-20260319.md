---
module: WhatsAppAgent
date: 2026-03-19
problem_type: logic_error
component: webhook_handler
symptoms:
  - "Clicking the welcome template quick reply '🔍 Caut un produs' replies with: 'Nu am înțeles selecția. Încearcă din nou...'"
  - "Vercel logs show: '[BUTTON] unrecognized payload' with ButtonPayload=browse"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [whatsapp, twilio, welcome-template, quick-reply, buttonpayload, selection-flow]
related_github_issue: null
commit: "1e8a132"
---

# Welcome quick reply `browse` payload was not handled

## Problem Description

We restored the Twilio welcome Content Template so first-contact users immediately see the available options (quick replies). One of those quick replies routes the user into the browse flow ("🔍 Caut un produs").

In production testing (2026-03-19 14:54), clicking that quick reply produced a fallback error:

> Nu am înțeles selecția. Încearcă din nou sau trimite un mesaj text.

Server logs showed Twilio sent `ButtonPayload=browse`, but our webhook treated it as unknown and hit the catch-all branch.

## Root Cause Analysis

`handleButtonPayload()` had handlers for:

- confirm/cancel (DA/NU)
- legacy `product_N` callbacks from older list-picker messages

but did not include a deterministic handler for the welcome template’s `browse` quick reply payload. As a result, the payload fell through to the unrecognized-payload fallback.

## Solution

Add an explicit handler for `ButtonPayload=browse` in [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts):

- `browse` → `sendCategoryPicker({ sb, from, phone })`

This keeps the welcome UX template-based, but routes the actual selection into our text-only deterministic picker flow (numbered categories).

## Tests

Added fixture-backed replay coverage to lock the payload contract:

- [`fixtures/whatsapp-replay/welcome-browse-button.json`](/Users/vladislavcaraseli/Documents/inventory-app/fixtures/whatsapp-replay/welcome-browse-button.json)

Run locally:

```bash
pnpm whatsapp:replay welcome-browse-button
```

Expected outcome:

- Step 1 sends the welcome template (async template event)
- Step 2 posts `ButtonPayload=browse` and results in an async REST message containing `Categorii disponibile:`

## Prevention

- Treat Twilio template quick replies as a strict API contract: every new `ButtonPayload` must have an explicit handler or deterministic mapping.
- Keep a replay fixture for each template quick reply (one fixture per payload) so we catch missing handlers before deploying.
- When troubleshooting on Vercel, compare the timestamp of the last deployment to the chat transcript time; here the failing transcript (14:54) happened before the fix commit (14:56).

## See Also

- [confirm-only-template-fallback-cart-state-whatsappagent-20260319.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/confirm-only-template-fallback-cart-state-whatsappagent-20260319.md)
- [quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md)

