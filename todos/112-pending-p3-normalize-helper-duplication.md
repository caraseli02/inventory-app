---
status: pending
priority: p3
issue_id: "112"
tags: [code-review, quality, duplication]
dependencies: []
---

## Problem Statement
The diacritics-stripping normalization pattern is copy-pasted in two different files. If the normalization logic needs to change (e.g. additional character classes, locale-specific rules), both copies must be updated in sync.

## Findings
- `lib/whatsapp/selection-resolver.ts` lines 209-215: `findMatchingCategory` applies `normalize('NFD').replace(/\p{Diacritic}/gu, '')` plus whitespace collapse inline
- `lib/whatsapp/inventory.ts` lines 53-59: `normalizeProductText` applies the same `normalize('NFD').replace(/\p{Diacritic}/gu, '')` plus whitespace collapse

Both implementations are functionally identical. Neither imports from the other.

## Proposed Solutions

### Option 1: Extract to lib/whatsapp/text-utils.ts
Create `lib/whatsapp/text-utils.ts` with a named export `normalizeText` (or `stripDiacritics`). Replace both inline implementations with imports.

**Pros:** Single source of truth; logical home for all text-normalization helpers (including `buildNumberedList` from todo #107).
**Cons:** Adds a new file (minor overhead, but justified given #107 would also land here).
**Effort:** Small
**Risk:** Low

### Option 2: Export from inventory.ts and import in selection-resolver.ts
Keep `normalizeProductText` in `inventory.ts`, export it, and import it in `selection-resolver.ts`.

**Pros:** No new file needed.
**Cons:** Creates a dependency from `selection-resolver.ts` on `inventory.ts` that may be semantically awkward; `normalizeProductText` is a product-specific name for a generic utility.
**Effort:** Small
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files:
  - `lib/whatsapp/selection-resolver.ts` (lines 209-215, inside `findMatchingCategory`)
  - `lib/whatsapp/inventory.ts` (lines 53-59, `normalizeProductText`)
- Note: `lib/whatsapp/text-utils.ts` would also be the natural home for `buildNumberedList` (see todo #107), making this a related cleanup.

## Acceptance Criteria
- [ ] The diacritics-stripping + whitespace-collapse pattern exists in exactly one place
- [ ] Both `selection-resolver.ts` and `inventory.ts` import from the shared utility
- [ ] The shared utility is unit-tested for edge cases (empty string, all-diacritic input, mixed whitespace)
- [ ] No behavior change; existing tests still pass

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
