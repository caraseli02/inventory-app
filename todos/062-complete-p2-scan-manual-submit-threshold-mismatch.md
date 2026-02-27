---
status: complete
priority: p2
issue_id: "062"
tags: [code-review, ux, scan-page, typescript]
dependencies: []
---

# Align manual barcode submit threshold

Make manual-entry validation consistent between button state and submit logic.

## Problem Statement

The manual barcode submit button becomes enabled at 3 characters, but submit logic only accepts 4+ characters. This creates a no-op click path that looks broken.

## Findings

- `src/pages/ScanPage.tsx:74` enables submit styling/interaction at `manualCode.length >= 3`.
- `src/pages/ScanPage.tsx:73` disables only when `< 3`.
- `src/hooks/useScanState.ts:81` accepts manual submit only when `code.length >= 4`.
- Result: 3-character inputs show active CTA, but nothing happens on submit.

## Proposed Solutions

### Option 1: Raise button threshold to 4

**Approach:** Change UI enable/disable + visual state checks from `3` to `4`.

**Pros:**
- No behavioral change to backend/query logic
- Fast and low-risk

**Cons:**
- Keeps strict min length rule (may be debated)

**Effort:** 15-30 minutes

**Risk:** Low

---

### Option 2: Lower submit threshold to 3

**Approach:** Keep current UI behavior; accept 3-character manual codes in `handleManualSubmit`.

**Pros:**
- No UI change
- Allows shorter custom codes

**Cons:**
- May increase noisy lookups
- Changes current business rule

**Effort:** 15-30 minutes

**Risk:** Medium

---

### Option 3: Centralize min-length constant

**Approach:** Define one shared `MIN_MANUAL_CODE_LENGTH` and use it in UI + submit logic.

**Pros:**
- Prevents drift
- Improves maintainability

**Cons:**
- Slightly more refactor

**Effort:** 30-45 minutes

**Risk:** Low

## Recommended Action

Done: Option 3 implemented with shared `MIN_MANUAL_CODE_LENGTH = 4`.

## Technical Details

**Affected files:**
- `src/pages/ScanPage.tsx`
- `src/hooks/useScanState.ts`

**Related components:**
- `ScanInputSection`
- `useScanState`

**Database changes (if any):**
- No

## Resources

- **PR:** #140
- **PR URL:** https://github.com/caraseli02/inventory-app/pull/140

## Acceptance Criteria

- [x] Manual submit button state matches submit handler rule
- [x] No-op submit for 3-char input is removed
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes
- [x] Relevant tests updated/added if behavior changes

## Work Log

### 2026-02-27 - Review finding captured

**By:** Codex

**Actions:**
- Compared extracted scan UI + hook behavior in PR #140.
- Verified threshold mismatch between button enablement and submit guard.
- Documented options and acceptance criteria.

**Learnings:**
- Refactors can preserve latent UX bugs; shared constants reduce this class of drift.

### 2026-02-27 - Fix implemented and verified

**By:** Codex

**Actions:**
- Added `MIN_MANUAL_CODE_LENGTH` in `src/hooks/useScanState.ts`.
- Updated submit guard to use shared constant.
- Updated manual submit button enable/disabled + styling checks in `src/pages/ScanPage.tsx`.
- Ran `pnpm lint` and `pnpm typecheck`.

**Learnings:**
- Shared constants keep UI and behavior aligned during refactors.

## Notes

- Priority `p2` because this is user-facing confusion, not data/security risk.
