---
title: "feat: Invoice Import Pricing Parity with Excel + Manual Weight Editing"
type: "feat"
date: "2026-02-11"
brainstorm: "docs/brainstorms/2026-02-11-invoice-import-pricing-parity-brainstorm.md"
---

# feat: Invoice Import Pricing Parity with Excel + Manual Weight Editing

## Overview
Align invoice import pricing with the existing Excel workflow while keeping implementation simple and reliable now.

Chosen architecture now:
- FastAPI handles extraction + pricing preview
- Frontend performs final DB writes (create/update + stock movement) via existing app data layer

This avoids dependency on backend persistence mode and keeps invoice import working immediately with existing Supabase/Airtable flows.

## Found Brainstorm Context
Found brainstorm from `2026-02-11`: `invoice-import-pricing-parity`. Using as context for planning.

Key decisions carried forward:
- fixed FX rate `19.5`
- transport formula `weightKg * 1.5`
- margin tiers 50/70/100 based on landed cost
- existing products should be updated and stocked in
- allow manual weight adjustment per imported row
- temporary density assumption for liquids: `1L = 1kg` and `1000ml = 1kg`

## MVP Scope Lock (Updated)
Build now:
- `POST /extract`: include `row_id` and optional `weight_kg_candidate`
- `POST /invoice/preview-pricing`: validate and compute prices; row status `ok | needs_input`
- Frontend import writes to app DB (Supabase/Airtable) using existing create/update/stock APIs
- Core error handling only (`INVALID_PAYLOAD`, `MISSING_WEIGHT`, `INTERNAL_ERROR` on preview path)
- Rounding fixed to 4 decimals (as returned by preview API)

Deferred to v2:
- backend `/invoice/import` transactional endpoint + idempotency persistence
- parse confidence/size tokens/match hints
- rich warnings and expanded error taxonomy

## Local Research Summary
### Internal References
- Current import orchestration entrypoint: `src/pages/InventoryListPage.tsx:296`
- Existing create + stock flow already stable for xlsx: `src/pages/InventoryListPage.tsx:382`
- Invoice review/edit flow: `src/components/invoice/InvoiceUploadDialog.tsx:55`
- Import data shape shared between xlsx and invoice: `src/lib/xlsx/index.ts:16`
- Existing update capability in API layer: `src/lib/api-provider.ts:57`
- Existing pricing tier persistence in Supabase adapter: `src/lib/supabase-api.ts:421`

### Institutional Learnings
- Prevent NaN propagation in invoice numeric edits: `docs/solutions/ui-bugs/invoice-ocr-nan-input-validation-in-number-fields.md:22`
- Keep runtime validation strict on OCR payload mapping: `docs/solutions/runtime-errors/invoice-ocr-runtime-product-field-validation.md:34`

## Architecture Split (Simple Now)
### Backend responsibilities (FastAPI)
- OCR extraction and structured product rows.
- Return `row_id` and optional `weight_kg_candidate`.
- Validate + compute canonical pricing via `preview-pricing`.

### Frontend responsibilities (Web app)
- Upload PDF and show editable rows.
- Enforce/collect `weightKg` before import.
- Call `preview-pricing` and block import when rows are `needs_input`.
- Perform final DB writes using app data APIs:
  - match existing by barcode first, then normalized name
  - update/create product prices
  - add stock movement `IN`

## Proposed Solution
### 1) Backend API Usage (No backend write endpoint)
Use only:
- `POST /extract`
- `POST /invoice/preview-pricing`

Do not require `/invoice/import` for this phase.

### 2) Frontend Dialog and Validation
- Keep manual weight column and missing-weight gate.
- Preserve safe numeric handling and text edit behavior.
- Run preview-pricing before confirm import.

Target files:
- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/lib/invoiceOCR.ts`
- `src/locales/en.json`
- `src/locales/ro.json`
- `src/locales/es.json`
- `src/locales/ru.json`

### 3) Frontend Import Writes
- Invoice import path computes/receives final prices from preview response.
- Then write to DB via existing frontend data layer:
  - update existing product or create new
  - add stock movement
- Keep xlsx import behavior unchanged.

Target files:
- `src/pages/InventoryListPage.tsx`
- `src/lib/xlsx/index.ts`
- `src/lib/invoiceImportApi.ts`

## Acceptance Criteria
- [ ] Invoice import formulas match parity through preview API output.
- [ ] `row_id` and `weight_kg_candidate` are consumed from extract response.
- [ ] User can manually edit weight per row.
- [ ] Import blocked if any row is `needs_input`.
- [ ] On import confirm, products are persisted in app DB (not in-memory-only backend state).
- [ ] Existing matched product rows update price tiers and add stock-in.
- [ ] New rows create products and add stock-in.
- [ ] xlsx flow remains unchanged.
- [ ] No NaN values can be persisted from invoice edits.

## Implementation Tasks (Execution Checklist)
- [ ] `src/lib/invoiceOCR.ts`: support `row_id`, optional `weight_kg_candidate` (`null` accepted).
- [ ] `src/components/invoice/InvoiceUploadDialog.tsx`: weight UI + preview-pricing gate + payload mapping.
- [ ] `src/lib/invoiceImportApi.ts`: keep preview client and auth headers.
- [ ] `src/pages/InventoryListPage.tsx`: ensure invoice import writes through existing DB APIs.
- [ ] `src/lib/xlsx/index.ts`: keep invoice metadata fields needed for import orchestration.
- [ ] Add/adjust tests for missing-weight gate and invoice import persistence flow.
- [ ] Run `pnpm test:unit` and `pnpm lint`.
- [ ] Run explicit review pass before final commit.

## Risks and Mitigations
- Risk: frontend/backend formula drift.
  - Mitigation: frontend uses preview API as pricing source before write.
- Risk: wrong product match on normalized names.
  - Mitigation: barcode-first match and strict normalization logic.
- Risk: manual weight overhead.
  - Mitigation: auto-fill from `weight_kg_candidate` + parse fallback from name prefix.

## Testing and Validation
### Automated
- `pnpm test:unit`
- `pnpm lint`

### Manual
- Import invoice with parseable sizes (`200G`, `0.5L`) and verify rows auto-fill weight.
- Import invoice with missing size and verify UI blocks until weight entered.
- Delete all products, import invoice, verify inventory list shows persisted products.
- Confirm existing products are updated and stock increases.

## Out of Scope (This Plan)
- Backend transactional `/invoice/import` endpoint and idempotency persistence.
- Persistent product `weight` column.
- Dynamic FX source and density tables.
