---
status: complete
priority: p3
issue_id: "058"
tags: [code-review, invoice-import, fx-rate, i18n, ui]
dependencies: []
---

# Problem Statement

Invoice import preview pre-fills FX rate with `19.5`, but the UI badge still says “Manual”. This is mildly misleading and can reduce user trust (“did it auto-set something or is it my input?”).

# Findings

- `InvoiceUploadDialog` shows a badge labeled via `invoiceUpload.fx.manual` and default text “Manual”.
- With a default value present, badge should ideally communicate “Default (19.5)” until the user edits it (then “Manual”).

# Proposed Solutions

## Option A: Badge shows “Default (19.5)” until user changes input (recommended)
Track a boolean like `fxRateWasEdited` (reset on close/back). Badge:
- default: `Default (19.5)`
- after edit: `Manual`

**Pros:** Clear; minimal; matches actual behavior.  
**Cons:** Needs new i18n keys.

## Option B: Remove the badge entirely
Just show the input label + value.

**Pros:** Zero i18n changes.  
**Cons:** Less clarity; loses future extensibility (BNM vs manual).

## Option C: Always show “Manual”
Keep current behavior.

**Pros:** No work.  
**Cons:** Slightly misleading now that value is prefilled.

# Recommended Action

(Triage)

# Technical Details

- Affected file: `src/components/invoice/InvoiceUploadDialog.tsx`
- If implemented, update locales: `src/locales/en.json`, `src/locales/ro.json`, `src/locales/ru.json`, `src/locales/es.json`

# Acceptance Criteria

- [x] When dialog reaches preview with untouched FX input, badge reads “Default (19.5)” (localized).
- [x] After user edits FX input, badge reads “Manual” (localized).
- [x] Badge resets back to “Default (19.5)” after closing/reopening dialog.

# Work Log

### 2026-02-25 - Created from review

**By:** Codex

**Actions:**
- Noted UI badge mismatch after switching FX rate to a default value.

**Learnings:**
- Small wording issues matter when users rely on imports for accounting-ish data.

### 2026-02-25 - Fixed

**By:** Codex

**Actions:**
- Added `isFxManual` state; badge shows “Default (19.5)” until FX input is edited, then “Manual”.
- Added i18n keys under `invoiceUpload.fx` in `en.json`, `ro.json`, `ru.json`, `es.json`.

**Learnings:**
- Treat defaulted values as a distinct UI state to reduce accidental “wrong default” imports.

# Resources

- Brainstorm: `docs/brainstorms/2026-02-25-invoice-import-default-fx-rate-19-5-brainstorm.md`
