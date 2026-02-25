---
title: "feat: Invoice import default FX rate (MDL/EUR) = 19.5"
type: "feat"
date: "2026-02-25"
brainstorm: "docs/brainstorms/2026-02-25-invoice-import-default-fx-rate-19-5-brainstorm.md"
---

# feat: Invoice import default FX rate (MDL/EUR) = 19.5

## Overview
Invoice import preview currently blocks “EUR-first” pricing until user manually fills FX Rate.

Change: prefill FX Rate with **19.5 MDL per 1 EUR** so converted EUR totals/prices show immediately.

Scope: `InvoiceUploadDialog` (invoice import preview only). No backend changes.

## Found Brainstorm Context
Found brainstorm from `2026-02-25`: `invoice-import-default-fx-rate-19-5`. Using as context for planning.

Key decisions carried forward:
- Default FX rate = `19.5`
- Still user-editable
- No backend move for now

## Local Research Summary
### Internal References
- FX rate state + recalculation: `src/components/invoice/InvoiceUploadDialog.tsx:132`
- FX rate UI input/badge: `src/components/invoice/InvoiceUploadDialog.tsx:780`
- BNM FX fetch helper (unused in UI now): `src/lib/exchangeRates.ts:1`
- Existing dialog flow test: `tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx:1`

### Institutional Learnings (Keep Intact)
- FX changes previously caused row state drift; keep stable row identity + removed rows behavior: `docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md`
- MDL→EUR conversion path already exists and depends on `fxRate` being valid: `docs/solutions/logic-errors/mdl-prices-treated-as-eur-InvoiceUploadDialog-20260206.md`

## SpecFlow / Edge Cases
- Open dialog → upload step: FX default should be ready before first transition to preview.
- Close dialog (Cancel / Done) → reopen: FX should reset back to `19.5` (not persist old edits unless explicitly added later).
- Invalid FX input: keep existing validation (sets `fxRate = null` + blocks import).
- FX change after row edits/removals: must not reintroduce “deleted rows reappear / actions shift” regressions.

## Proposed Solution (High-Level)
- Initialize `fxRate` to `19.5` (and reset to `19.5` inside `resetState()`).
- Optional UX (if desired): badge reflects source:
  - “Default (19.5)” until user edits
  - “Manual” after first user change

## Acceptance Criteria
- [x] On entering preview, FX input shows `19.5` without user typing.
- [x] Preview prices recompute to EUR immediately (no “FX rate required” blocker by default).
- [x] User can still override FX rate and see prices update.
- [x] Closing and reopening the dialog resets FX back to `19.5`.
- [x] Existing row-removal + import-action stability remains correct when FX changes.

## Implementation Tasks (Execution Checklist)
- [x] `src/components/invoice/InvoiceUploadDialog.tsx`: set default `fxRate` state to `19.5`.
- [x] `src/components/invoice/InvoiceUploadDialog.tsx`: update `resetState()` to restore `fxRate = 19.5` (not `null`).
- [x] (Optional) `src/components/invoice/InvoiceUploadDialog.tsx`: add minimal “default vs manual” badge state.
- [x] (If badge changes) update locales for new key(s): `src/locales/en.json`, `src/locales/ro.json`, `src/locales/ru.json`, `src/locales/es.json`.

## Tests
- [x] Update/add to `tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx`:
  - open dialog → extract mocked invoice → preview shows FX input value `19.5`
  - changing FX keeps removed rows removed (guard against regression)
