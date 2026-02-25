---
module: InvoiceUploadDialog
date: 2026-02-25
problem_type: logic_error
component: dialog_component
symptoms:
  - "Re-uploading the same invoice with unchanged FX rate preselected many rows as Update instead of Skip"
  - "Changing FX rate behavior became inconsistent after idempotency/default-action fixes"
  - "Preview action shown in table could diverge from action used during confirm import fallback"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [invoice-import, idempotency, fx-rate, preview-pricing, rounding-drift, default-actions]
related_github_issue: null
commit: null
---

# Problem Description

After adding invoice row idempotency (`supplier + invoice number + row`) and smarter default actions (`Update` vs `Receive stock`),
the invoice preview regressed for repeat uploads:

- same invoice + same FX often showed `Update` for already-imported rows
- `Skip` detection looked broken to users
- fixing FX reactivity introduced logic duplication between UI defaults and confirm payload fallback

The impact was high because this changed the core trust model of the invoice import preview.

# Symptoms

- Re-upload the same invoice (already imported once)
- Leave FX rate unchanged
- Rows with `Already imported` badge still default to `Update` instead of `Skip`
- Changing FX sometimes changed row actions, but behavior did not match expectation consistently

User expectation (and final behavior):
- same invoice + same FX => `Skip`
- same invoice + changed FX => `Update` only for real price diffs (no duplicate stock)

# Root Cause Analysis

This was a combination of three logic issues:

## 1) Price diffing used lossy LEI↔EUR round-trips in preview

Preview pricing preload rebuilt `line_total_lei` from rounded EUR values:

```typescript
// ❌ BEFORE (drift-prone)
line_total_lei: roundCurrency(product.totalPrice * fxRate)
```

But `product.totalPrice` had already been derived from an earlier `LEI -> EUR` conversion and rounded to 2 decimals.
That caused false price diffs when rows were re-evaluated, especially for already-imported rows where price diffs were now allowed to drive `Update`.

## 2) Default-action logic was duplicated across multiple paths

The rule for already-imported rows ("price diffs only" should trigger `Update`) was implemented in:
- preview row rendering
- importable row count
- auto-default effect

But `handleConfirmImport` fallback still used a broader diff predicate (`hasDiffs`) in one path, which could produce payload actions different from what the UI showed.

## 3) Idempotency helper scanned a globally capped result set

`getAlreadyImportedRowIds()` loaded invoice notes with a global `limit(5000)` and filtered client-side. As historical data grows,
matching rows could fall outside the first page and dedupe would silently miss them.

# Solution

## 1) Introduce canonical per-row LEI totals in preview state

Added `lineTotalLei` to `InvoicePreviewProduct` and preserved it as the canonical row amount used for preview pricing requests.

```typescript
// ✅ AFTER (stable)
interface InvoicePreviewProduct extends InvoiceProduct {
  previewId: string;
  lineTotalLei: number;
  // ...
}
```

```typescript
// ✅ Use canonical LEI in preview-pricing requests
line_total_lei: product.lineTotalLei
```

This removes false price diffs caused by repeated LEI↔EUR rounding.

## 2) Centralize default-action resolution

Added a shared local resolver (`getResolvedDefaultAction(index)`) and reused it in:
- auto-default `useEffect`
- table row rendering
- importable count calculation
- confirm-import payload generation

This keeps UI and submitted payload behavior consistent.

## 3) Keep idempotent stock but allow price updates on re-upload

Already-imported rows now:
- default to `Skip` when no real price diff exists
- default to `Update` when real price diffs exist (for FX correction)
- never add duplicate stock movements (import-time guard still blocks stock-in)

## 4) Replace capped idempotency lookup with pagination

`getAlreadyImportedRowIds()` now paginates through invoice-import notes instead of relying on a fixed global cap, preventing false negatives as data grows.

# Files Changed

- `src/components/invoice/InvoiceUploadDialog.tsx`
  - Added canonical `lineTotalLei`
  - Unified default action resolver
  - Fixed preview-pricing request inputs
- `src/lib/invoiceImportDiffs.ts`
  - Diff/default-action helpers used by preview + import flow
- `src/pages/InventoryListPage.tsx`
  - Stock-idempotent import semantics (`Update` allowed, duplicate stock blocked)
- `src/lib/invoiceIdempotency.ts`
  - Paginated idempotency note lookup

# Prevention

- [x] Added unit tests for invoice idempotency note parsing and diff/default-action matrix
- [ ] Add unit test for "same invoice + same FX" round-trip drift scenario (canonical LEI prevents false `Update`)
- [ ] Add unit test for UI default action vs confirm payload action parity
- [ ] Avoid duplicating default-action logic; always route through one resolver/helper
- [ ] Prefer canonical source values (LEI row totals) over recomputed display values (rounded EUR) for business decisions

# Related

- `docs/solutions/logic-errors/invoice-import-name-dedup-override-InvoiceImport-20260225.md`
- `docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md`
- `docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md`
