---
status: pending
priority: p2
issue_id: "107"
tags: [code-review, quality, duplication]
dependencies: []
---

## Problem Statement
`buildNumberedList` is defined identically in two separate files. If the two implementations diverge — e.g. formatting tweaks or edge-case handling — they will produce inconsistent output silently.

## Findings
- `lib/whatsapp/selection-resolver.ts` line 24: defines `buildNumberedList`
- `lib/whatsapp/webhook.ts` line 143: defines an identical `buildNumberedList`

Both implementations have the same signature and body. There is no shared utility that either file imports from.

## Proposed Solutions

### Option 1: Extract to a shared utility file
Create `lib/whatsapp/text-utils.ts` (or add to an existing shared module), export `buildNumberedList` from there, and replace both local definitions with imports.

**Pros:** Single source of truth; any future changes propagate automatically.
**Cons:** Requires a new file or careful choice of destination module.
**Effort:** Small
**Risk:** Low

### Option 2: Export from selection-resolver.ts and import in webhook.ts
Keep the definition in `selection-resolver.ts`, export it, and import it in `webhook.ts`.

**Pros:** No new file needed.
**Cons:** Creates a coupling from `webhook.ts` to `selection-resolver.ts` that may be semantically awkward.
**Effort:** Small
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files:
  - `lib/whatsapp/selection-resolver.ts` (line 24)
  - `lib/whatsapp/webhook.ts` (line 143)

## Acceptance Criteria
- [ ] `buildNumberedList` exists in exactly one place
- [ ] Both `selection-resolver.ts` and `webhook.ts` import from the shared location
- [ ] No behavior change; existing tests still pass

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
