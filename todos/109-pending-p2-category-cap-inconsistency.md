---
status: pending
priority: p2
issue_id: "109"
tags: [code-review, architecture, whatsapp]
dependencies: []
---

## Problem Statement
Two separate places enforce a cap on the number of list-picker items, but neither is derived from the other. The comment on the inventory cap now gives a false reason (it claims the Twilio template has 6 variable slots, which is no longer the binding constraint after dynamic Content creation was introduced).

## Findings
- `lib/whatsapp/inventory.ts`: `getDistinctCategories` hard-codes `.slice(0, 6)` with comment "Cap for list-picker template (6 variable slots)"
- `lib/whatsapp/selection-resolver.ts`: defines `MAX_LIST_PICKER_ITEMS = 6` which enforces the same cap

Neither constant is imported from the other. With dynamic Content creation now supporting 1-10 items, the actual ceiling is 10 (a UX/product choice), not a Twilio hard limit of 6.

## Proposed Solutions

### Option 1: Single shared constant + updated comment
Define one constant (e.g. `MAX_CATEGORY_LIST_ITEMS = 10`) in a shared location (`lib/whatsapp/constants.ts` or `transport.ts`). Update `getDistinctCategories` and `selection-resolver.ts` to import it. Update comments to reflect that this is a UX cap, not a Twilio constraint.

**Pros:** Eliminates the false comment; single source of truth; makes it easy to tune the cap in one place.
**Cons:** Requires deciding the new value (6 vs 10 is a product decision).
**Effort:** Small
**Risk:** Low

### Option 2: Keep cap at 6 but fix the comment and consolidate
Keep the limit at 6 (conservative UX choice), consolidate into one constant, and correct the comment to say "UX cap — dynamic Content supports up to 10" rather than referencing variable slots.

**Pros:** No behavior change; still a safe improvement.
**Cons:** Does not take advantage of the newly available headroom.
**Effort:** Small
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files:
  - `lib/whatsapp/inventory.ts` (`getDistinctCategories`, `.slice(0, 6)` and comment)
  - `lib/whatsapp/selection-resolver.ts` (`MAX_LIST_PICKER_ITEMS = 6`)

## Acceptance Criteria
- [ ] Only one constant controls the category list cap
- [ ] Both `inventory.ts` and `selection-resolver.ts` reference the same constant
- [ ] Comment accurately describes the cap as a UX choice, not a Twilio template-variable constraint
- [ ] Existing tests pass with no behavior change (or updated to reflect new cap if raised)

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
