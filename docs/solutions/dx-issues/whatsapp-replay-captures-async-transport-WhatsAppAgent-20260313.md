---
module: WhatsAppAgent
date: 2026-03-13
problem_type: developer_experience
component: utility
symptoms:
  - "`pnpm whatsapp:replay` only showed the immediate TwiML ack instead of the real async WhatsApp reply"
  - "Replay fixtures could pass while order/Q&A/confirm-cancel behavior was still wrong in the async send path"
  - "Docs labeled replay as the authoritative parity path before it captured async transport output"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [whatsapp, replay, twilio, transport, async, testing, parity]
related_github_issue: null
commit: null
---

# Problem Description

The new fixture-backed WhatsApp replay command was meant to become the local source of truth for phone parity, but the first version only parsed the immediate HTTP/TwiML response from `POST /api/whatsapp`.

That was insufficient because the real webhook often acknowledges immediately and sends the meaningful customer-visible reply later through async transport helpers. In practice, replay could say "success" while the real reply path was still broken.

# Symptoms

- Replay output showed only `Bună ziua, procesăm...` or empty TwiML.
- Q&A and order fixtures could complete without proving the actual REST/template response was correct.
- Confirm/cancel flows could look healthy at the route boundary while hiding wrong async behavior.
- The docs overclaimed that replay was authoritative before it observed the full transport path.

# Root Cause Analysis

The webhook control flow was split into two phases:

```typescript
// lib/whatsapp/webhook.ts
if (!hasHistory) sendTwiml(args.res, ack);
else sendTwiml(args.res, '');

waitUntil(
  buildReplyWithPending(...)
    .then(async (result) => {
      if (result.pending) {
        await sendPendingOrderConfirmation(...);
        return;
      }

      await sendRestMessage(args.from, result.reply);
    })
);
```

The replay CLI only inspected the first phase:

```typescript
// scripts/whatsapp-replay.ts
const result = await postReplayStep(...);
const twimlMessage = extractTwimlMessage(result.body);
```

So the replay command was testing signed request entry and immediate ack behavior, but not the actual async send path that users see on phone.

# Solution

Added a replay context seam that follows the real webhook request through async work and captures transport events to a shared local file.

## 1) Tag replay requests

Replay requests now send `x-whatsapp-replay-id`, and the webhook wraps request handling in an async-local replay context.

## 2) Capture real transport events

`transport.ts` now records:

- typing indicators
- REST sends
- template sends

When the request is a replay request, these events are appended to a local capture file. If Twilio credentials are missing locally, replay still captures the intended async send instead of silently losing visibility.

## 3) Read async outcomes in the replay CLI

`scripts/whatsapp-replay.ts` now:

- clears the capture file for each replay step
- posts the signed request to the real webhook route
- polls for captured async transport events
- prints those events
- supports assertions against async body text or template SID

```typescript
const replayEvents = await waitForReplayEvents(replayId, step.pauseMs ?? 1200);

for (const expectedText of getExpectationList(args.step.expectAsyncBodyIncludes)) {
  const matched = args.replayEvents.some(
    (event) => event.kind === 'rest' && event.body.includes(expectedText)
  );
  if (!matched) throw new Error(...);
}
```

## 4) Align docs with reality

Updated the testing guide and runbook so replay is described as authoritative only because it now captures async transport output too.

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/replay-context.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/transport.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/scripts/whatsapp-replay.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/docs/WHATSAPP_TESTING.md`
- `/Users/vladislavcaraseli/Documents/inventory-app/docs/runbooks/whatsapp_agent.md`
- `/Users/vladislavcaraseli/Documents/inventory-app/todos/096-complete-p2-webhook-replay-misses-async-replies.md`

# Prevention

- [x] Keep parity tooling tied to the full user-visible outcome, not only the initial webhook ack
- [x] Capture async transport events when the webhook is exercised in replay mode
- [x] Support fixture assertions for async body/template outcomes
- [ ] Add at least one starter fixture with concrete `expectAsync...` assertions against a known local dataset

## Related Documentation

- [quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md)
- [atomic-pending-order-consume-whatsappagent-20260312.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/atomic-pending-order-consume-whatsappagent-20260312.md)
