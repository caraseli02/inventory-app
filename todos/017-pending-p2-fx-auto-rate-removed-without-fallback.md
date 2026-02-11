---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, invoice-ocr, fx-rate, ux]
dependencies: []
---

# Auto FX rate flow removed from invoice upload without replacement path

## Problem Statement

The invoice upload flow removed BNM auto-rate retrieval and related fallback controls, leaving only manual FX entry. This can regress usability and increase input mistakes during imports.

## Findings

- `getBnmEurRate` import and invoice-date auto-fetch effect were removed.
- UI controls for loading status, source badge (`BNM`/`manual`), and `Use BNM rate` were removed.
- Current flow always starts with manual FX handling.
- Evidence:
  - `src/components/invoice/InvoiceUploadDialog.tsx:33`
  - `src/components/invoice/InvoiceUploadDialog.tsx:232`
  - `src/components/invoice/InvoiceUploadDialog.tsx:779`

## Proposed Solutions

### Option 1: Restore BNM auto-rate flow with manual override

**Approach:** Re-introduce auto-fetch by invoice date and keep manual edit override.

**Pros:** Better UX, lower operator error.

**Cons:** External dependency and failure handling required.

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Keep manual-only but add explicit product requirement

**Approach:** Document manual-only decision in UI and product notes, add stronger validation and helper copy.

**Pros:** Simpler runtime behavior.

**Cons:** More user friction and potential data-entry errors.

**Effort:** Small

**Risk:** Medium

## Recommended Action


## Technical Details

- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/lib/exchangeRates.ts` (if restored)
- `src/locales/*.json`

## Acceptance Criteria

- [ ] FX-rate behavior is explicit and consistent with product expectation
- [ ] If auto-rate is intended, user can fetch/use it reliably
- [ ] If manual-only is intended, UX copy clearly states it and validation is robust

## Work Log

### 2026-02-11 - Review finding

**By:** Codex

**Actions:**
- Compared current invoice upload diff and verified auto-rate path removal.
- Captured regression risk as deferred decision item.

**Learnings:**
- Removing assistive defaults in financial workflows should be explicit and coordinated with product UX.
