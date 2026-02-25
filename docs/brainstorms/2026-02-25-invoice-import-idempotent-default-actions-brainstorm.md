---
date: 2026-02-25
topic: invoice-import-idempotent-default-actions
---

# Invoice Import: Idempotency + Smarter Defaults

## What We're Building
Improve invoice import preview so it:
- Doesn’t repeatedly suggest importing the same invoice rows.
- Doesn’t show/default to “Update” unless the import would actually change product fields.
- Still allows receiving stock for matched products when it’s a *new* invoice.

Scope: invoice import only (`InvoiceUploadDialog` + invoice import handler). Supabase backend only (Airtable retired).

## Why This Approach
Current flow is frontend-write “simple mode” (no backend transactional import / idempotency table). We can still achieve practical idempotency by marking stock movements with invoice metadata and using that to detect “already imported” rows on re-upload.

This avoids building the deferred v2 backend `/invoice/import` endpoint while fixing the UX pain today.

## Key Decisions
- **Invoice identity**: invoice key = `supplier + invoice_number`.
- **Re-upload behavior**: “resume” mode — skip only rows already imported; default-import remaining rows.
- **Default “Update” only on diffs**: matched rows default to an action that *does not* imply product field changes unless we detect diffs.
- **Backend assumption**: Supabase only; we can use `stock_movements.note` to store invoice markers.

## Proposed UX Behavior (Preview Table)
For each extracted row:
1) **Find match** (existing behavior): barcode first, else normalized name.
2) **Compute “already imported?”**:
   - If we have `supplier` + `invoice_number` and `row_id`, treat row as already imported when a stock IN movement exists with a note containing this invoice key + row id (format TBD).
3) **Compute “diffs?”** (only for matched products):
   - Compare imported computed fields (price + tiers + supplier + category rules) vs existing product fields.
4) **Default action**:
   - If **already imported** → default `Skip` (row visually marked “Already imported”).
   - Else if **diffs exist** → default `Update` (because changes are meaningful).
   - Else (no diffs, not imported yet) → default “stock-only” behavior.

Note: Current dropdown is `Update` / `Skip`. To support “stock-only”, we either:
- Add a third action (recommended) like `Receive stock`, OR
- Keep 2 actions but redefine “Update” label/behavior to include “receive stock” even when no diffs (less clear; likely repeats the original confusion).

## Import Count (Button + Summary)
Import button count should reflect *importable* rows:
- Exclude `Skip`
- Exclude “Already imported”
This fixes “I always see the same amount to import” on re-upload.

## Data/Idempotency Marker (Supabase)
Use `stock_movements.note` (already in schema) to store:
- invoice key (`supplier|invoice_number`)
- invoice row id (`row_id`)
This enables per-row “already imported” detection and resume behavior.

## Open Questions
- **Diff rules**: which fields count as “meaningful” diffs (Price? tiers? Category only if non-General? Supplier?) and what tolerances (rounding) apply?
- **Missing invoice metadata**: what if supplier or invoice number is missing from OCR — disable idempotency and fall back to current behavior?
- **Stock quantity semantics**: always stock IN by invoice quantity when action isn’t Skip?
- **UI wording**: best labels for actions to avoid conflating “receive stock” with “update product fields”.

## Next Steps
→ `/workflows:plan` to turn this into an implementation plan (UI action model + idempotency marker + import count logic).

