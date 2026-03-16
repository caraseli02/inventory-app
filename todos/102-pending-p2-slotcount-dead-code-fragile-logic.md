---
status: pending
priority: p2
issue_id: "102"
tags: [code-review, typescript, quality]
dependencies: []
---

## Problem Statement

`sendListPickerTemplate` in `lib/whatsapp/transport.ts` contains dead code in the `slotCount` expression and an unused parameter, making the function's intent unclear and harder to maintain.

## Findings

The `slotCount` ternary reads:

```ts
count === 6 || !sid || sid === contentSid ? 6 : count
```

However, earlier in the same function body there is:

```ts
if (!sid) sid = contentSid;
```

After that assignment, `!sid` is always `false` at the point of the ternary — `sid` is guaranteed to be non-null. The effective logic is therefore:

```ts
sid === contentSid ? 6 : count
```

Additionally, the `_title: string` parameter is accepted by the function signature but is never referenced in the body (the leading underscore signals intentional suppression, but the parameter should either be used or removed from the signature entirely).

## Proposed Solutions

### Option 1: Remove dead branch and unused parameter
Rewrite the ternary to reflect the actual logic, and drop `_title` from the signature (or use it if it was intended to be passed to the template).

**Pros:** Eliminates confusion; makes the real invariant explicit; reduces surface area for future bugs.
**Cons:** Minor — requires verifying no caller passes a meaningful `_title` value that should be forwarded.
**Effort:** Small
**Risk:** Low

### Option 2: Add an assertion comment only
Leave the code as-is but add a comment explaining why `!sid` is unreachable.

**Pros:** Zero code change risk.
**Cons:** Does not fix the dead code; future readers still have to re-derive the invariant.
**Effort:** Small
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files: `lib/whatsapp/transport.ts`
- Key lines: `slotCount` ternary expression; `_title: string` parameter in `sendListPickerTemplate`

## Acceptance Criteria
- [ ] `slotCount` expression contains no unreachable branches
- [ ] `_title` parameter is either removed from the signature or actively used in the template call
- [ ] Existing unit/integration tests continue to pass after the change

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
