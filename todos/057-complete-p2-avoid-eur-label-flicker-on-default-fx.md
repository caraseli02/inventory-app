---
status: complete
priority: p2
issue_id: "057"
tags: [code-review, invoice-import, fx-rate, ui, react-state]
dependencies: []
---

# Problem Statement

Invoice import preview now defaults `fxRate` to `19.5`, making `isFxReady` true immediately. The preview renders currency labels/symbols as EUR while the initial `editableProducts` values may still be in LEI until the FX conversion `useEffect` runs.

This can cause a brief “wrong currency” flash (EUR label with LEI numbers) after extraction, especially on slower devices.

# Findings

- `src/components/invoice/InvoiceUploadDialog.tsx` initializes `fxRate` to `19.5`, so `isFxReady` is true immediately.
- After extraction success, the dialog sets `editableProducts` from OCR results without conversion, then transitions to `preview`.
- FX conversion runs in a `useEffect` keyed on `rawProducts` + `fxRate`, which runs after paint.
- The table renders values as EUR when `isFxReady`, so the first preview paint can be mislabeled.

# Proposed Solutions

## Option A: Apply conversion during extraction success (recommended)
When setting `editableProducts` after `extractInvoiceData` succeeds, if `fxRate` is valid, precompute EUR `unitPrice/totalPrice` immediately (same logic as the FX `useEffect`) before switching to `preview`.

**Pros:** No flicker; simplest mental model; preserves existing FX recalculation effect for later edits.  
**Cons:** Small duplication unless extraction path reuses shared helper.

## Option B: Gate EUR labels until conversion applied
Add a small state flag like `hasAppliedFx` that flips true after the conversion effect runs once; render LEI labels until then.

**Pros:** Avoids duplication of conversion logic.  
**Cons:** Adds more state and edge cases (resets on close/back).

## Option C: Derive displayed currency purely from source
Render LEI labels for raw OCR values and EUR labels only for computed values (requires explicit separation between raw vs computed fields).

**Pros:** Most correct model long-term.  
**Cons:** Larger refactor; likely YAGNI now.

# Recommended Action

(Triage)

# Technical Details

- Affected file: `src/components/invoice/InvoiceUploadDialog.tsx`
- Related behavior: currency labels/symbols rely on `isFxReady`.

# Acceptance Criteria

- [x] First render of preview after successful extraction never shows EUR symbol/labels with unconverted LEI values.
- [x] FX rate edits still recompute values correctly.
- [x] Existing “removed rows stay removed” and “import action stability” behavior remains correct when FX changes.
- [x] Unit/component test added or updated to protect against regression.

# Work Log

### 2026-02-25 - Created from review

**By:** Codex

**Actions:**
- Identified potential first-render currency mismatch after setting default FX rate.

**Learnings:**
- Defaulting `fxRate` changes timing assumptions around `useEffect`-based conversion.

### 2026-02-25 - Fixed

**By:** Codex

**Actions:**
- Pre-convert extracted invoice rows to EUR in `InvoiceUploadDialog` before switching to preview.
- Added unit assertion that preview renders `€` values immediately (no `LEI`).

**Learnings:**
- When UI labels depend on readiness state, avoid `useEffect`-after-paint for initial derived values.

# Resources

- Related change: default FX rate introduction in `InvoiceUploadDialog`.
