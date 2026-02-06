---
date: 2026-02-06
topic: invoice-import-pricing-mdl-eur
---

# Invoice Import Pricing (MDL → EUR) & Category Accuracy

## What We're Building
Improve invoice import so price, store price, and category are correct for items coming from invoice OCR. Invoice unit cost is in MDL and must be converted to EUR using the BNM daily rate based on invoice date (fallback to previous available rate). The converted EUR unit cost becomes the product base price (`Price`). Store price should be derived from the active markup tier (default 70%). Missing categories should be auto-assigned via AI/heuristics, but still editable in preview.

## Why This Approach
We want a low-friction import that fixes the current pricing errors (MDL treated as EUR, missing tier prices) without adding heavy UI. Approach A keeps the flow simple: auto-convert, auto-assign, auto-compute active tier price, and show a concise preview. Exceptions (existing product matches) get per-item decisions only when needed.

## Key Decisions
- `Price` represents supplier unit cost converted from MDL to EUR.
- FX source is BNM; use invoice date, fallback to most recent previous rate.
- FX rate is auto-fetched but can be overridden per import.
- All invoices are MDL for now (no currency detection).
- Store price uses active markup tier only (default 70%); other tiers left empty.
- Total is recomputed as `qty × converted unit price` for consistency.
- Auto-assign category via AI/heuristics when missing.
- If barcode matches existing product, prompt per item in preview to update vs skip.
- If no barcode, attempt exact/normalized name match before creating a new product.
- Do not store original MDL cost; keep EUR only.

## Open Questions
- What counts as a “match” for name normalization (case, punctuation, diacritics)?
- Where should per-item update/skip controls live in the preview UI to stay lightweight?

## Next Steps
→ `/workflows:plan` for implementation details
