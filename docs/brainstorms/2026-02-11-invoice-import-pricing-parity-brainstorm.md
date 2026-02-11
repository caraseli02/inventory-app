---
date: 2026-02-11
topic: invoice-import-pricing-parity
---

# Invoice Import Pricing Parity

## What We're Building
Bring invoice upload behavior to parity with the existing Excel pricing workflow so owners can stop doing manual Excel work while preserving trusted pricing outputs.

When importing supplier invoices, the app should compute the same transport-adjusted cost and margin tiers used in the spreadsheet:
- `transport = weight * 1.5`
- `price_euro = (invoice_line_total / quantity) / 19.5`
- `price50 = (price_euro + transport) * 1.5`
- `price70 = (price_euro + transport) * 1.7`
- `price100 = (price_euro + transport) * 2.0`

For weight sourcing, invoice import should first reuse catalog knowledge (existing product match by barcode/name). If a product is new and has no known weight, owner provides weight in the preview before confirm.

For existing products found during import, invoice flow should update price tiers and add stock movement (restocking behavior), not skip.

## Why This Approach
### Recommended: Excel parity with catalog-weight fallback
Pros:
- Matches owner’s current trusted business logic exactly
- Removes most manual Excel effort while keeping pricing confidence
- Fits real grocery restock flow (update prices and stock together)

Cons:
- Requires explicit handling for missing weight on new products
- More complex than plain margin-only calculations

### Alternative A: Margin-only from OCR unit price
Pros:
- Simple and fast
Cons:
- Breaks parity with existing spreadsheet
- Ignores transport, causing pricing drift

### Alternative B: Keep base price only
Pros:
- Minimal implementation
Cons:
- Pushes manual pricing work back to owner
- Fails core automation goal

## Key Decisions
- Pricing formulas must match Excel exactly, including transport and margin tiers.
- Exchange rate is fixed at `19.5` for invoice import parity.
- Weight source is existing catalog first; missing weight on new items is collected in preview.
- Existing matched products are updated (price tiers) and stocked-in via stock movement.

## Open Questions
- No open product decisions for the brainstorm scope.
- Implementation-level details (UI validation rules, matching confidence, conflict resolution precedence) are deferred to planning.

## Next Steps
Proceed to `/workflows:plan` to define implementation details, acceptance tests, and rollout sequence.
