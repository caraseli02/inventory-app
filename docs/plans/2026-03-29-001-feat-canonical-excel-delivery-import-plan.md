---
title: "feat: Canonical Excel delivery import fallback"
type: feat
status: active
date: 2026-03-29
origin: docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md
---

# feat: Canonical Excel delivery import fallback

Found source document from 2026-03-29: `excel-import-fallback`. Using as foundation for planning.

## Overview

Upgrade Excel import from a thin bulk uploader into a deterministic delivery-intake fallback for store owners when invoice import is unavailable, unstable, or not worth the extraction overhead (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`).

The plan keeps the Excel path stricter and simpler than invoice import, while targeting the same resulting inventory state for normal delivery data:
- canonical template instead of flexible spreadsheet support
- barcode-required matching instead of name-fallback heuristics
- batch-level duplicate protection instead of trusting operator memory
- shared action/diff semantics where that improves parity without copying invoice-only complexity
- only the canonical path is exposed in the Excel import UI for this slice

## Problem Statement / Motivation

Current Excel import is still a parse-preview-import path:
- `src/components/xlsx/ImportDialog.tsx` parses the file, shows a static table, then calls `onImport` with raw parsed rows.
- `src/lib/importRunners.ts` mostly treats Excel rows as `create`, with a narrow `update` path and no `receive_stock` semantics, no meaningful-diff logic, and no batch idempotency.
- `src/lib/xlsx/columnMapping.ts` and `src/lib/xlsx/index.ts` still reflect the older “barcode optional / flexible spreadsheet” posture.

Meanwhile, invoice import now has:
- reusable match/default-action logic in `src/hooks/useInvoiceComputed.ts`
- confirm-time readiness checks and import payload shaping in `src/hooks/useInvoiceConfirmImport.ts`
- stock-movement note idempotency in `src/lib/invoiceIdempotency.ts`
- partial-failure handling and toast detail in `src/lib/importRunners.ts`

That gap matters because the product now explicitly wants Excel to be the trusted fallback for delivery intake, not just a secondary bulk uploader (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`).

## Proposed Solution

### 1. Define a canonical Excel intake contract

Treat one supported workbook shape as the safe fallback path (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`).

Product behavior:
- Require the canonical headers already represented in `src/lib/xlsx/columnMapping.ts`, including `Barcode` and `Name`.
- Expose only the canonical delivery template path in the main Excel import UI for this slice.
- Reject non-canonical files instead of treating them as an equally supported fallback mode.
- Block rows missing barcode from the safe fallback path.
- Keep current normalized/diacritic header aliases only where they map unambiguously to the canonical template.
- Fail early when required columns are missing or when the uploaded file cannot be interpreted as the canonical delivery template.
- Continue to allow optional business fields (`Category`, `Price`, `Price 50%`, `Price 70%`, `Price 100%`, `Supplier`, `Expiry Date`), but treat quantity/stock as required whenever the resolved action includes stock receipt.

Planned decision:
- Update the fallback contract so `Barcode` is required for canonical delivery import, even though the current xlsx spec and parser treat it as optional.
- Do not ship a second permissive spreadsheet-import mode in the same UI surface during this slice.

### 2. Add a constrained preview decision engine for Excel

Do not mirror the invoice UI one-for-one. Reuse the useful decision logic, but keep the Excel review surface smaller and more deterministic (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`).

Product behavior:
- Match rows by barcode only for the canonical fallback path.
- Show whether each row will `create`, `receive_stock`, `update`, or `skip`.
- Default actions:
  - unmatched barcode -> `create`
  - matched barcode + no meaningful diffs -> `receive_stock`
  - matched barcode + meaningful diffs -> `update` plus stock receipt as the row outcome
  - already imported in the same batch -> `skip` by default, with update-only allowed only when meaningful catalog diffs exist and stock receipt remains blocked
- Show blocking row errors before confirm:
  - missing barcode
  - invalid required numeric values
  - rows that would receive stock but have no usable quantity
- Keep import count aligned with actionable rows, not raw parsed rows.

Planned decision:
- Extract or reuse source-agnostic helpers from invoice parity work:
  - barcode indexing and match computation from `src/hooks/useInvoiceComputed.ts`
  - update payload diffing from `src/lib/invoiceImportDiffs.ts`
  - row-level default action semantics, adapted so Excel uses barcode-only matching

### 3. Make Excel import batch-idempotent

Use the same trust model as invoice import: repeated imports must not double-stock the same delivery batch (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`).

Planned decision:
- Derive an `excelBatchId` from the uploaded file bytes, using a deterministic content hash.
- Assign each preview row a stable `excelRowId` from canonical file context such as sheet + row index + barcode.
- Persist stock note markers in `stock_movements.note`, parallel to invoice notes, for example:
  - `excel_import|batch=<batchId>|row=<rowId>|barcode=<barcode>`
- Preload already-imported row ids for the batch before import, and re-check during the runner as an import-time safety net.
- If the same file is re-imported:
  - stock receipt is skipped for already-applied rows
  - update-only remains available when meaningful product-field diffs exist

Why this approach:
- It keeps duplicate protection explicit and deterministic.
- It avoids manual batch labels in v1.
- It mirrors the successful invoice idempotency pattern without requiring OCR-style invoice identity.

Known limitation:
- Any content change produces a new batch hash. That is acceptable for v1 and should be made visible in copy/tooltips so operators do not assume “same supplier delivery” implies “same batch”.

### 4. Unify write semantics with invoice parity where it matters

The Excel fallback should land the same resulting product/stock changes as invoice import for equivalent delivery data, but without invoice-only logic such as OCR, FX, weight, or preview-pricing API calls (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`).

Planned decision:
- Reuse the invoice-style update payload rules:
  - prices update only when meaningfully different
  - supplier updates only when non-empty and changed
  - category updates only when non-empty/non-default and changed
  - do not rename matched products
  - do not mutate barcodes on matched products
- Extend the Excel runner to support:
  - `receive_stock`
  - `update` with optional stock receipt
  - `skip`
  - partial failure reporting when stock movement fails after product create/update
- Keep source-specific metadata on `ImportedProduct` so invoice and Excel can share the pipeline without mixed-source ambiguity.

### 5. Update docs and sample assets to match the new contract

The current docs/specs still describe a more permissive import path. The product contract needs to be aligned before implementation is considered complete.

Required doc updates:
- `docs/specs/xlsx_integration.md`
- sample workbook in `public/magazin.xlsx` if it remains the canonical template
- import copy/translations describing barcode-required canonical intake and duplicate-batch behavior

## Technical Considerations

### Architecture impacts

- `ImportDialog` currently only receives `onImport`. It will need inventory context or a preview hook that has access to `allProducts`, because safe action resolution depends on current inventory state.
- `ImportedProduct` in `src/lib/xlsx/index.ts` is already shared by invoice and Excel. Extending it for `excelBatchId` / `excelRowId` should preserve source separation and avoid mixed-source confusion in `useProductImport`.
- Current invoice helpers are split between UI hooks and runner utilities. The plan should extract only the reusable business rules, not invoice-only UI state.

### Performance implications

- Hash the uploaded file once at parse time.
- Build barcode indices once per preview session.
- Query batch idempotency markers once per batch, paginated like invoice lookup if needed.
- Keep preview rendering bounded; large imports should not require rendering every row at once to preserve responsiveness.

### Security considerations

- No new external service is needed.
- Stricter validation reduces ambiguous writes and accidental duplicate stock.
- File type checks remain client-side only; parsing and import code should continue to reject malformed content safely.

## System-Wide Impact

### Interaction graph

`InventoryListPage` opens `ImportDialog`, which currently calls `handleImport` from `useProductImport`, which then dispatches to `runXlsxImport`, which writes via `api-provider`, which persists `products` and `stock_movements`.

This plan adds one more decision stage before writes:
- parse canonical file
- compute matches/default actions/idempotency state against current inventory
- confirm only actionable rows
- execute runner with explicit row actions and batch metadata

### Error & failure propagation

- Parse/template failures should stop before preview.
- Preview-blocking validation should stop before import.
- Create/update success followed by stock failure should remain a partial row result, not a full rollback, matching current import runner behavior.
- Duplicate-batch detection should degrade safely: if pre-check fails, the import runner still re-checks during write.

### State lifecycle risks

- If Excel preview gains row-level actions, it must not use index-keyed state. Invoice learnings show row state drifts when mutable lists are keyed by array index.
- Stable preview row ids should be used for action overrides, skip flags, and duplicate badges.
- Stock note markers are written only when stock receipt succeeds. That is correct for retry behavior, but partial create/update outcomes must be surfaced clearly so operators understand what remains.

### API surface parity

- `runXlsxImport` should move closer to `runInvoiceImport` semantics, but not collapse both into one opaque path unless the shared logic is genuinely source-agnostic.
- `buildXlsxImportToast` should report duplicate-batch skips and partial rows, not just success/skip/error.
- `useProductImport` must continue to reject mixed-source batches.

### Integration test scenarios

- Canonical Excel row and equivalent invoice row produce the same create/update/stock intent.
- Re-importing the same Excel file skips duplicate stock receipt.
- Matched rows with meaningful diffs update product fields and still receive stock once.
- Rows with blocking validation errors never reach the runner.
- Partial stock failure after product create/update is reported clearly and leaves retry-safe state.

## Implementation Phases

### Phase 1: Canonical contract + metadata foundation

- [ ] Update xlsx parsing to distinguish canonical delivery import from the older permissive spreadsheet path.
- [ ] Require barcode in canonical delivery mode.
- [ ] Reject non-canonical files in the main Excel import UI instead of routing them through a permissive fallback path.
- [ ] Compute and retain `excelBatchId` and stable `excelRowId` for parsed rows.
- [ ] Add Excel idempotency helper(s), either alongside `invoiceIdempotency.ts` or as a shared import-note module.
- [ ] Decide note format and parsing utilities for Excel batch markers.
- [ ] Align `ImportedProduct` types with new Excel metadata.

Files likely involved:
- `src/lib/xlsx/index.ts`
- `src/lib/xlsx/columnMapping.ts`
- `src/lib/importRunners.ts`
- `src/lib/invoiceIdempotency.ts` or new import-note helper

### Phase 2: Excel preview parity, kept intentionally smaller than invoice

- [ ] Introduce an Excel preview state layer/hook that computes:
  - barcode match result
  - meaningful diffs
  - already-imported-in-batch status
  - resolved default action
  - actionable row count
  - blocking validation summary
- [ ] Pass `allProducts` or equivalent inventory context into the Excel preview path.
- [ ] Update `ImportDialog` to show:
  - match/result badges
  - explicit action/outcome column
  - duplicate-batch skip messaging
  - actionable import count
- [ ] Keep row state keyed by stable preview identity, not array index.
- [ ] Preserve a constrained UX: no invoice-only editing grid, no FX, no OCR, no background job complexity.

Files likely involved:
- `src/components/xlsx/ImportDialog.tsx`
- `src/pages/InventoryListPage.tsx`
- new hook/module for Excel computed preview state
- shared helpers extracted from `src/hooks/useInvoiceComputed.ts`

### Phase 3: Runner parity + safe write semantics

- [ ] Extend `runXlsxImport` to honor `create`, `receive_stock`, `update`, and `skip`.
- [ ] Reuse invoice-style diff payload rules for Excel updates.
- [ ] Preload already-imported batch row ids and enforce import-time duplicate guards.
- [ ] Write batch note markers on successful Excel stock movements.
- [ ] Preserve partial failure reporting when stock movement fails after create/update.
- [ ] Expand Excel toast reporting to include duplicate skips and partial rows.

Files likely involved:
- `src/lib/importRunners.ts`
- `src/hooks/useProductImport.ts`
- `src/lib/invoiceImportDiffs.ts` or extracted shared import diff helper
- `src/lib/api-provider.ts`
- `src/lib/supabase-api.ts`

### Phase 4: Tests + documentation backfill

- [ ] Unit tests for canonical parsing, required barcode enforcement, batch note build/parse, and duplicate-batch lookup.
- [ ] Unit tests for action/default matrix:
  - unmatched -> create
  - matched/no diffs -> receive_stock
  - matched/diffs -> update + stock
  - already imported + no diffs -> skip
  - already imported + diffs -> update only
- [ ] Component tests for Excel preview state:
  - import count reflects actionable rows
  - row overrides stay attached to stable row identity
  - blocking errors stop confirm
- [ ] Integration test asserting equivalent invoice vs Excel write intent for comparable rows.
- [ ] E2E update for `tests/import-xlsx.spec.ts` so it validates fallback behavior, not just “some products imported”.
- [ ] Update docs/specs and template/sample workbook to reflect the canonical contract.

## Alternative Approaches Considered

### 1. Keep Excel as a generic bulk uploader

Rejected because it does not solve the actual product need. It preserves convenience, but not trust, and leaves invoice import as the only safe delivery-intake path.

### 2. Make Excel copy invoice import UI and complexity one-for-one

Rejected because it would inherit invoice carrying cost without invoice’s specific problem domain. The product wants safe parity of outcome, not duplicate workflow complexity.

### 3. Support many supplier spreadsheet shapes as first-class safe imports

Rejected for this slice because it directly conflicts with the origin decision to prefer reliability over parsing flexibility (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`).

## Acceptance Criteria

- [ ] Excel import is explicitly positioned and implemented as a delivery-intake fallback, not just a raw bulk uploader. (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`)
- [ ] The safe fallback path supports one canonical Excel template. Files outside that contract fail or are clearly routed out of the safe path. (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`)
- [ ] The main Excel import UI exposes only the canonical safe path in this slice.
- [ ] Canonical fallback rows require barcode. Rows missing barcode are blocked before import. (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`)
- [ ] Rows whose resolved outcome includes stock receipt are blocked before import if quantity is missing or invalid.
- [ ] Matched rows with no meaningful diffs default to `receive_stock`. (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`)
- [ ] Matched rows with meaningful diffs default to update plus one stock receipt. (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`)
- [ ] Unmatched rows default to `create`, then receive stock when quantity is present. (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`)
- [ ] Re-importing the same Excel batch does not double-add stock. Duplicate-batch rows are surfaced clearly in preview and final toast messaging. (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`)
- [ ] Preview shows the resolved row action and outcome before confirmation. Import count reflects actionable rows only. (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`)
- [ ] Equivalent invoice and Excel delivery data produce equivalent product-field and stock-write outcomes for shared fields. (see origin: `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`)
- [ ] Tests cover parser contract, action matrix, batch idempotency, preview-state stability, and runner parity.

## Success Metrics

- Store owners can complete normal delivery intake with the canonical Excel template without depending on invoice extraction.
- Re-importing the same batch produces zero duplicate stock movements.
- Default actions in preview match what the runner actually performs.
- Support burden decreases because Excel fallback behavior is easier to explain and predict than invoice extraction.

## Dependencies & Risks

- Current invoice idempotency helper is Supabase-specific. If Airtable legacy mode must still support safe fallback semantics, that needs explicit scope or a degraded behavior path.
- File-hash batch identity is deterministic but intentionally strict; users editing and re-saving the same logical delivery file will create a new batch id.
- Shared diff/default-action extraction can regress invoice flow if tests do not guard both sources.
- The current xlsx spec/documentation says barcode can be optional; this plan intentionally changes that contract for the canonical fallback path.
- If older permissive parsing remains in code during transition, it must not remain exposed as an equal user-facing fallback path.
- If preview adds mutable row actions without stable row ids, invoice-style state drift bugs will reappear in Excel.

## Sources & References

### Origin

- **Origin document:** `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md`
  - Carried-forward decisions:
    - canonical template over flexible parsing
    - barcode-required intake
    - delivery workflow over catalog-only sync
    - whole-file batch identity for duplicate safety
    - safe parity over UI parity
    - canonical path only in the user-facing Excel import flow for this slice

### Internal references

- Current Excel preview/import UI: `src/components/xlsx/ImportDialog.tsx`
- Current Excel parser and import contract: `src/lib/xlsx/index.ts`
- Current xlsx column contract: `src/lib/xlsx/columnMapping.ts`
- Current import runners: `src/lib/importRunners.ts`
- Invoice action/default parity helpers: `src/hooks/useInvoiceComputed.ts`
- Invoice confirm-time readiness and payload shaping: `src/hooks/useInvoiceConfirmImport.ts`
- Invoice idempotency note precedent: `src/lib/invoiceIdempotency.ts`
- Current xlsx feature spec: `docs/specs/xlsx_integration.md`

### Institutional learnings

- `docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md`
  - Relevance: matching must use authoritative inventory state, not filtered/derived subsets; normalization and partial-failure reporting matter for imports.
- `docs/solutions/logic-errors/same-invoice-fx-reupload-false-update-defaults-InvoiceUploadDialog-20260225.md`
  - Relevance: default-action logic must have one shared resolver; already-imported rows can still allow update-only when real diffs exist.
- `docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md`
  - Relevance: row-level preview state cannot be keyed by index if rows can be skipped, removed, or re-evaluated.
- `docs/solutions/state-issues/invoice-preview-duplicate-rowid-key-collision-InvoiceUploadDialog-20260320.md`
  - Relevance: upstream row ids are not inherently safe UI keys; preview identity must be made uniquely stable.

### Research decision

- No external research performed. Current repo patterns and recent invoice parity work provide sufficient guidance for this plan.
