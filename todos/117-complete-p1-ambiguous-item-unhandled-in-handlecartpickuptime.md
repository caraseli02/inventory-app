---
name: AMBIGUOUS_ITEM error unhandled in handleCartPickupTime — falls to generic crash
description: resolveOrderItems throws AMBIGUOUS_ITEM:... but handleCartPickupTime only handles OUT_OF_STOCK_ITEM and NOT_FOUND_ITEM; ambiguous items hit the outer error handler, user gets generic error and stays stuck
type: pending
priority: p1
issue_id: "117"
tags: [whatsapp, error-handling, cart, typescript]
dependencies: []
---

## Problem Statement

`selection-resolver.ts:264–277` — the catch block handles two error prefixes:

```ts
if (msg.startsWith('OUT_OF_STOCK_ITEM:')) { ... }
else if (msg.startsWith('NOT_FOUND_ITEM:')) { ... }
else { throw err; }
```

`inventory.ts:222` also throws `AMBIGUOUS_ITEM:name|candidates` for products matched to multiple DB entries. This falls through to `throw err`, which propagates to `handleRestConversation`'s outer catch at `webhook.ts:482`. The user receives the generic "Ne pare rău, a apărut o eroare" message. Worse, `pending_selection` remains as `awaiting_pickup_time` — the user is stuck and cannot retry.

## Findings

- `selection-resolver.ts:264–277` — missing `AMBIGUOUS_ITEM:` branch
- `inventory.ts:222` — throws `AMBIGUOUS_ITEM:name|candidates`
- After unhandled throw, state is NOT rolled back (see also todo #118)

## Proposed Solutions

### Option A — Add AMBIGUOUS_ITEM branch with rollback (Recommended)
```ts
} else if (msg.startsWith('AMBIGUOUS_ITEM:')) {
  const name = msg.slice('AMBIGUOUS_ITEM:'.length).split('|')[0];
  await sendRestMessage(args.from,
    `⚠️ *${name}* corespunde mai multor produse. Contactați magazinul pentru clarificare.`);
  // roll back to building_order so user can modify cart
  await storePendingProductSelection(args.sb, args.phone,
    withTimestamp({ selection_type: 'building_order', cart }));
} else {
  throw err;
}
```

**Pros:** User gets actionable message; state rolls back correctly
**Cons:** None
**Effort:** Small
**Risk:** Low

### Option B — Remove ambiguous items from cart and let user re-add
More complex UX — inform user which item was removed.

**Effort:** Medium
**Risk:** Medium

## Recommended Action

Option A. Friendly message + state rollback to `building_order`.

## Technical Details

- **Affected files:** `lib/whatsapp/selection-resolver.ts:264–277`, `lib/whatsapp/inventory.ts:222`

## Acceptance Criteria

- [ ] `AMBIGUOUS_ITEM` throws a user-friendly message in Romanian
- [ ] State rolls back to `building_order` on ambiguous item
- [ ] Unit test: `resolveOrderItems` throwing `AMBIGUOUS_ITEM:` is intercepted correctly
- [ ] User can continue the flow after the error

## Work Log

- 2026-03-17: Identified by typescript-reviewer and data-integrity-guardian review of PR #171
