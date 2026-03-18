---
module: WhatsAppAgent
date: 2026-03-17
problem_type: logic_error
component: webhook_handler
symptoms:
  - "User receives a pickup-time prompt or product list-picker but state was never stored — any reply falls through to LLM with no cart context"
  - "After DB write failure in handleButtonPayload confirm-cart path, user sees '🕐 La ce oră...' prompt but pending_selection is still 'building_order' — reply is misrouted"
  - "LLM receives next message with no pending_selection context and treats it as a fresh query"
  - "Cart state silently lost in webhook.ts paths even after fix was applied to selection-resolver.ts"
severity: high
root_cause: missing_error_handler
resolution_type: code_fix
related_issues: ["136", "149"]
linked_solutions:
  - "docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md"
tags: [whatsapp, state-machine, storePendingProductSelection, webhook, cart-flow]
---

# webhook.ts — 3 unchecked `storePendingProductSelection` callers after partial PR fix

## Problem

PR #173 fixed `storePendingProductSelection`'s return type from `Promise<void>` to `Promise<boolean>` and updated 4 callers in `lib/whatsapp/selection-resolver.ts` to abort with a user error on `false`. However, 3 state-advancing callers in `lib/whatsapp/webhook.ts` were missed and continued calling the function without checking the return value.

All 3 missed callers transition the state machine forward:
- `handleButtonPayload` (line 290): `building_order → awaiting_pickup_time`
- `tryTextTemplateInterception` choice=2 (line 349): `building_order → awaiting_pickup_time`
- `handleRestConversation` LLM listPicker path (line 457): `(none) → product_list`

On a DB failure, each caller sent a prompt or list-picker to the user with no corresponding stored state. The user's reply would find no `pending_selection` and fall through to the LLM, which would handle it as a new query.

## Root Cause

The fix in PR #173 was scoped to `selection-resolver.ts` only. `webhook.ts` imports and calls `storePendingProductSelection` directly in 3 places that were not audited as part of the PR change. The partial fix created a false sense of completeness — the PR description said "4 callers updated" which was accurate for `selection-resolver.ts` but missed the `webhook.ts` call sites.

## Solution

Apply the same `stored` check + early return pattern to all 3 missed call sites:

```typescript
// Before (webhook.ts line 290 — same pattern at 349 and 457)
await storePendingProductSelection(sb, phone, { selection_type: 'awaiting_pickup_time', ... });
await sendRestMessage(from, '🕐 La ce oră...');

// After
const stored = await storePendingProductSelection(sb, phone, { selection_type: 'awaiting_pickup_time', ... });
if (!stored) {
  await sendRestMessage(from, 'A apărut o eroare. Încearcă din nou.');
  return;
}
await sendRestMessage(from, '🕐 La ce oră...');
```

For the LLM listPicker path (line 457), the `return` after the error message was sufficient since the path is inside a void handler.

## Prevention

- **Grep before closing a PR that changes a function's contract**: any change to `storePendingProductSelection`'s return type should be followed by `grep -n "storePendingProductSelection" lib/whatsapp/` to find all call sites, not just those in the file being modified.
- **The fix pattern is now consistent**: every state-advancing call to `storePendingProductSelection` in both `selection-resolver.ts` and `webhook.ts` checks the boolean and aborts on `false`. Clearing calls (`clearPendingSelection`, `handleCartPickupTime` clear step) intentionally ignore the return value — these are best-effort writes protected by the 30-minute TTL.
- **When a fix applies to "all callers of X"**, search the whole codebase, not just the files in the current diff.
