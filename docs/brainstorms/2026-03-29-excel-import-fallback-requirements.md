---
date: 2026-03-29
topic: excel-import-fallback
---

# Excel Import Fallback

## Problem Frame

Invoice import currently covers the richer intake workflow, but it also carries extraction ambiguity and edge-case risk. The product needs a second intake path that a store owner can trust when invoice import is unavailable, unstable, or simply not worth the overhead. That fallback should prioritize deterministic behavior and safe stock receipt over flexibility.

## Requirements

- R1. Excel import must be maintained as a first-class fallback intake path for store owners adding delivery items when invoice import is not the right option.
- R2. The fallback must optimize for a reliable supplier-delivery workflow, not generic spreadsheet ingestion.
- R3. The supported fallback flow must use one canonical Excel intake template as the primary path.
- R4. Every import row in the canonical template must include a barcode; rows without a barcode must be blocked from import.
- R5. For rows whose barcode matches an existing product and have no meaningful catalog diffs, the default action must be `receive_stock`.
- R6. For rows whose barcode matches an existing product and do have meaningful catalog diffs, the default action must be `update` and `receive_stock` as part of the same intake outcome.
- R7. For rows whose barcode does not match an existing product, the default action must be `create`, then receive stock when quantity is present.
- R8. Re-importing the same Excel batch must not duplicate stock receipt for rows already applied from that batch.
- R9. The preview must clearly show the resolved row action and what will happen before the user confirms import.
- R10. The Excel fallback should aim for the same resulting inventory state as invoice import for equivalent delivery data, while remaining stricter and less ambiguous in how it gets there.

## Success Criteria

- A store owner can use the canonical Excel template to complete normal delivery intake without relying on invoice extraction.
- Re-importing the same batch does not double-add stock.
- Matched rows default to stock receipt, and matched rows with meaningful diffs also keep pricing/catalog fields in sync.
- The Excel fallback is simpler and more predictable than invoice import, not a second copy of invoice complexity.

## Scope Boundaries

- No attempt to support arbitrary supplier spreadsheets as first-class safe intake inputs in this slice.
- No name-only matching in the canonical fallback path.
- No barcode-optional intake in the canonical fallback path.
- No requirement to reproduce invoice extraction, OCR, or document-processing behavior.
- No requirement to preserve every invoice-only edge-case rule if the same safe inventory outcome can be reached through a stricter Excel workflow.

## Key Decisions

- Canonical template over flexible parsing: reliability matters more than accommodating many spreadsheet shapes.
- Barcode-required intake: the fallback needs a stable identifier for safe matching and duplicate protection.
- Delivery workflow over catalog-only sync: the default matched-row behavior should land stock, not just update metadata.
- Whole-file batch identity over loose row-content heuristics: duplicate safety should be explicit and understandable.
- Safe parity over UI parity: Excel should reach the same inventory outcome as invoice import for normal deliveries, but it does not need to mirror invoice UX complexity one-for-one.

## Dependencies / Assumptions

- Existing product records continue to use barcode as the primary stable identity for intake matching.
- The app can store enough batch metadata to recognize when a canonical Excel batch was already applied.
- The canonical template can be distributed to store owners and used consistently enough to justify stricter validation.

## Outstanding Questions

### Deferred to Planning

- [Affects R3][Technical] How strict the parser should be when a file deviates slightly from the canonical template before it becomes a hard failure.
- [Affects R8][Technical] What batch identity is safest and most understandable for users, such as file hash alone versus file hash plus explicit batch metadata.
- [Affects R9][Technical] Whether the Excel preview should expose invoice-style per-row action controls or a more constrained fallback-specific review UI.
- [Affects R10][Needs research] Which invoice-side field-diff rules should be shared directly versus simplified for the canonical Excel fallback.

## Next Steps

→ /prompts:ce-plan for structured implementation planning
