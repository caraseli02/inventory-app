---
module: ScanPage
date: 2026-02-27
problem_type: ui_bug
component: page_component
symptoms:
  - "Manual submit button looked enabled for 3-character input but pressing it did nothing"
  - "Users could hit a dead-end CTA in scan mode without any feedback"
  - "Validation behavior differed between UI state and submit handler"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [scan-page, manual-entry, barcode, ux, validation]
related_github_issue: null
commit: null
---

# Problem Description

After scan-page refactoring, the manual barcode entry flow had inconsistent rules:
- the button enabled at 3 characters,
- but submit logic only processed codes with 4+ characters.

This created a confusing no-op interaction where the UI suggested "ready to submit" but no lookup happened.

# Symptoms

- Enter 3 characters in manual barcode input.
- Submit button becomes active (styled as enabled).
- Pressing submit does not trigger scan lookup or state change.

# Root Cause Analysis

Minimum code length was implemented in two places with different values.

```typescript
// ❌ BEFORE
// ScanPage.tsx
disabled={manualCode.length < 3}
manualCode.length >= 3 ? "enabled-style" : "disabled-style"

// useScanState.ts
if (code.length >= 4) handleScanSuccess(code);
```

The duplicated threshold drifted (`3` vs `4`) during extraction.

# Solution

Centralized the threshold as a shared constant and reused it in both UI and submit logic.

```typescript
// ✅ AFTER - useScanState.ts
export const MIN_MANUAL_CODE_LENGTH = 4;
if (code.length >= MIN_MANUAL_CODE_LENGTH) handleScanSuccess(code);

// ✅ AFTER - ScanPage.tsx
disabled={manualCode.length < MIN_MANUAL_CODE_LENGTH}
manualCode.length >= MIN_MANUAL_CODE_LENGTH ? "enabled-style" : "disabled-style"
```

This removed the no-op path and made the interaction deterministic.

# Files Changed

- `src/hooks/useScanState.ts`
- `src/pages/ScanPage.tsx`

# Verification

- `pnpm lint`
- `pnpm typecheck`

Both passed after the fix.

# Prevention

- [x] Centralize cross-layer validation constants (UI + handler).
- [x] Avoid duplicating input rules in both component and hook.
- [ ] Add test that checks button state and submit behavior are aligned at boundary lengths.
- [ ] Add review checklist item for UI state/handler parity when extracting hooks/components.

# Related

- `docs/solutions/state-issues/render-phase-state-reset-useProductEdit-20260227.md`
- `todos/062-complete-p2-scan-manual-submit-threshold-mismatch.md`
