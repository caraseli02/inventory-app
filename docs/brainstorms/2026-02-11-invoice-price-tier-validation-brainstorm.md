---
date: 2026-02-11
topic: invoice-price-tier-validation
---

# Invoice Price Tier Validation Brainstorm

## What We're Building

A manual validation workflow to confirm invoice imports produce correct pricing fields:
- `Price`
- `Price 50%`
- `Price 70%`
- `Price 100%`

Expected rule for this validation: tiers are auto-calculated from base unit price:
- `Price 50% = Price * 1.5`
- `Price 70% = Price * 1.7`
- `Price 100% = Price * 2.0`

Rounded to 2 decimals.

## Why This Approach

Goal is confidence after recent PR merge on invoice processing, with fast feedback and no automation setup.

## Approaches Considered

### Approach A (Recommended): UI end-to-end manual check with known invoice values
Use invoice upload flow in app, import products, open product detail/edit UI, compare all four fields against precomputed expected values.

Pros:
- Closest to real operator flow
- Validates extraction + mapping + persistence + display

Cons:
- Manual repetition

Best for: immediate post-merge confidence.

### Approach B: DB-level verification after UI import
Run SQL/Supabase table checks after import and compare persisted `price`, `price_50`, `price_70`, `price_100`.

Pros:
- Direct source-of-truth check

Cons:
- Requires DB access and query comfort

Best for: deeper debugging after UI mismatch.

### Approach C: Export-to-xlsx cross-check
Import invoice, then export inventory and compare pricing columns in exported xlsx.

Pros:
- Verifies downstream reporting/export path

Cons:
- Adds one extra step and tooling

Best for: release readiness checks.

## Key Decisions

- Validate all 4 fields, not just base `Price`.
- Use deterministic expected values precomputed from invoice unit prices.
- Mark test failed on any mismatch > 0.01.
- Run on at least 3 products with decimal prices to catch rounding edge cases.

## Open Questions

- Should tier calculation happen during invoice import path, backend create/update, or both (defense in depth)?

## Next Step

If mismatch appears, open a fix task for invoice import mapping so tiers are populated at create time.
