---
title: "feat: Invoice import idempotency + smarter default actions"
type: feat
date: 2026-02-25
brainstorm: docs/brainstorms/2026-02-25-invoice-import-idempotent-default-actions-brainstorm.md
---

# feat: Invoice import idempotency + smarter default actions

Found brainstorm from 2026-02-25: `invoice-import-idempotent-default-actions`. Using as context for planning.

## Overview
Invoice import preview should:
- Stop “always same import count” on re-upload (practical idempotency).
- Not default/show “Update” unless it will change product fields.
- Still allow receiving stock for matched products on *new* invoices.

Constraints:
- Supabase backend only (Airtable retired).
- Keep “simple mode” (frontend performs DB writes). Backend transactional `/invoice/import` is out of scope (deferred per `docs/specs/invoice-import-api-contract.md`).

## Problem Statement / Motivation
Current invoice import preview:
- Defaults matched rows to `Update`, even when no product changes are intended/needed.
- “Import {{count}}” uses raw extracted rows count (`editableProducts.length`), so it doesn’t shrink when rows are skipped or already imported.
- Re-uploading the same invoice can re-stock products unintentionally (no dedupe marker).

## Proposed Solution
Add 3 concepts to the invoice import flow:

1) **Invoice identity + row idempotency (resume behavior)**
- Invoice key = `supplier + invoice_number`.
- Store an idempotency marker in Supabase `stock_movements.note` on stock IN created by invoice import.
- On preview: query stock movements for this invoice key once, parse imported `row_id`s into a set.
- Default `Skip` only for rows already imported; allow importing remaining rows (resume after partial failure).
- Safety net: re-check at import time and force-skip already-imported rows even if user toggles.

2) **Smarter defaults for matched rows (update only on diffs)**
For rows with a match (barcode/name):
- Compute “meaningful diffs” between imported computed fields and existing product fields.
- Default action:
  - `skip` if already imported
  - `update` only if diffs exist
  - otherwise `receive_stock` (new action; stock-only)

3) **Import count reflects what will happen**
- “Import {{count}}” uses the number of rows not `skip` and not “already imported”.

## Technical Approach

### Data model (Supabase-only)
Use existing `stock_movements.note` (already in schema; not currently written by invoice import).

**Note format (string, stable + parseable):**
`invoice_import|supplier=<supplier>|invoice=<invoice_number>|row=<row_id>`

Rules:
- Encode/escape `|` and newlines in values (simple replace) to keep parsing safe.
- Treat presence of *any* stock_movement note for a row as “already imported”.

### UI action model
Update `ImportAction` for invoice import UI:
- Existing: `create | update | skip`
- Add: `receive_stock` (stock IN only; no product field update)

UI copy:
- Replace “Update” default where there are no diffs with “Receive stock”.
- For already imported rows, show a badge like “Already imported” and default to `Skip`.

### Diff rules (v1)
Compute diffs only against fields invoice import can (and should) write:
- Prices: `Price`, `Price 50%`, `Price 70%`, `Price 100%` (tolerance `<= 0.0001`)
- Supplier: only consider diff if imported supplier is non-empty
- Category: only consider diff if imported category is non-empty and != `General` (avoid overwriting curated values with default)

Non-diffs:
- Name (invoice import currently shouldn’t rename existing products by default)
- Barcode (should not be changed by invoice import on match)

### Backend API surface changes (internal app lib)
To write and later query idempotency markers:
- Extend stock movement creation to accept optional `note`.
- Add helper to query imported invoice row ids by invoice key.

Keep component/backend separation (no direct Supabase calls in components):
- Put Supabase query helpers in `src/lib/…`, then call from `InvoiceUploadDialog`.

## Implementation Tasks

### Phase 1: Idempotency helpers (Supabase)
- [x] Extend `addStockMovement` signature to accept optional `note`
  - Files: `src/lib/api-provider.ts`, `src/lib/supabase-api.ts`, `src/types/index.ts` (StockMovement note parity)
  - Keep Airtable impl compiling (optional note ignored or threaded if easy).
- [x] Add helper: `src/lib/invoiceIdempotency.ts`
  - `buildInvoiceKey({ supplier, invoiceNumber })`
  - `buildInvoiceRowNote({ supplier, invoiceNumber, rowId })`
  - `getAlreadyImportedRowIds({ supplier, invoiceNumber }): Promise<Set<string>>`
    - Implementation: Supabase `stock_movements` query with `ilike('note', pattern)` + parse `row=…`.

### Phase 2: Preview defaults + “already imported” UI
- [x] In `src/components/invoice/InvoiceUploadDialog.tsx`
  - [x] Load `alreadyImportedRowIds` once invoice meta is available (supplier + invoice number).
  - [x] Compute per-row flags:
    - `isAlreadyImported`
    - `hasDiffs` (matched rows only)
  - [x] Default action logic:
    - `skip` if already imported
    - `update` if matched + diffs
    - `receive_stock` if matched + no diffs
    - `create` if no match
  - [x] Add dropdown option “Receive stock” for matched rows
  - [x] Add visual label for already imported rows (badge + muted row style)
  - [x] “Import {{count}}” uses importable rows count (exclude `skip` + already imported)
  - [x] Ensure imported payload includes `invoiceRowId` + `invoice meta` needed to build notes downstream

### Phase 3: Import handler changes (write behavior)
- [x] In `src/pages/InventoryListPage.tsx` invoice import path:
  - [x] Respect `receive_stock` action: only add stock movement
  - [x] For `update`: only call `updateProduct` when diffs exist (avoid no-op updates)
  - [x] Add stock movement note for all invoice stock-ins (create/update/receive_stock)
  - [x] Add safety net: if “already imported” detected at import-time, force-skip row and report in toast summary

### Phase 4: i18n + messaging
- [x] Add missing `invoiceUpload.table.*` keys for new copy:
  - `receiveStock`, `alreadyImported`, `match` column labels if desired
  - Files: `src/locales/en.json`, `src/locales/ro.json`, `src/locales/ru.json`, `src/locales/es.json`

### Phase 5: Tests (Vitest)
- [x] Unit tests for:
  - Note build/parse + escaping (`invoiceIdempotency.ts`)
  - Default action selection (match + diffs + alreadyImported matrix)
  - Diff detection tolerance + category guard
- [x] Suggested location: `src/lib/__tests__/invoiceIdempotency.test.ts` + `src/lib/__tests__/invoiceImportDiffs.test.ts`

## Acceptance Criteria
- [ ] Re-uploading the same invoice (same `supplier + invoice #`) defaults already-imported rows to `Skip`.
- [ ] If only some rows were previously imported, re-upload defaults remaining rows to import (resume behavior).
- [ ] Matched rows show/default to:
  - [ ] `Update` only when meaningful diffs exist
  - [ ] `Receive stock` when no diffs exist (new invoice)
- [ ] “Import {{count}}” equals the number of rows that will actually be processed (excluding `Skip` + already imported).
- [ ] Import writes stock IN with a `stock_movements.note` idempotency marker for invoice rows.
- [ ] Import is safe against double-stocking even if user tries to import same invoice twice (import-time guard).

## Success Metrics
- Fewer accidental re-imports: repeated invoice upload leads to 0 (or only remaining) rows importable by default.
- Less confusion: “Update” appears only when it changes product fields.

## Dependencies & Risks
- Supabase query by `note` (string) is MVP-simple but not strongly structured; parsing bugs risk false positives/negatives.
- Missing supplier/invoice number from OCR disables idempotency; must degrade gracefully (no crash; no dedupe).
- Requires touching shared API surface (`addStockMovement` types) → ensure other callers keep working (checkout, manual stock adjust).

## Alternative Approaches Considered
- Backend `POST /invoice/import` transactional endpoint + dedicated idempotency table (explicitly deferred in `docs/specs/invoice-import-api-contract.md`).
- Persist invoice import records in a new `invoice_imports` table and link to movements (more robust; more work).

## References
- Brainstorm: `docs/brainstorms/2026-02-25-invoice-import-idempotent-default-actions-brainstorm.md`
- Spec: `docs/specs/invoice-import-api-contract.md` (idempotency deferred to v2)
- Prior fix learnings: `docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md`
- Current UI: `src/components/invoice/InvoiceUploadDialog.tsx`
- Current import handler: `src/pages/InventoryListPage.tsx`
- Supabase schema: `src/lib/database.types.ts` (`stock_movements.note`)
