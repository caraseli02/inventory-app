---
status: pending
priority: p2
issue_id: "088"
tags: [code-review, whatsapp, orders, data-integrity]
dependencies: []
---

# Restrict `de cada` follow-up extraction to real product lines

## Problem Statement

The new `"1 de cada"` follow-up path reuses the last assistant message as the source of product names, but the parser currently accepts any bulleted line. That means summary lines like `* Total: €21.51` or `* Recogida: hoy a las 19:00` are treated as products. In the best case, `processOrderIntent()` fails later with `NOT_FOUND_ITEM`; in the worst case, a broad catalog reply can turn `"1 de cada"` into an unintended many-item order.

## Findings

- `api/whatsapp.ts:920-929` — `extractProductNamesFromAssistantText()` accepts every bullet / numbered line, not just product rows.
- `api/whatsapp.ts:1126-1136` — when `parseRepeatedQuantity()` matches, the code converts *all* `recentNames` into order items without validating that each line is a product.
- The recent assistant messages in this flow can include non-product bullets such as total, pickup, or other helper copy.

## Proposed Solutions

### Option 1: Parse only inventory/product-shaped lines (Recommended)

Only accept lines that look like product rows, for example lines containing a price marker (`— €`) or lines previously extracted from menu options.

**Pros:** Keeps `"de cada"` deterministic and safe.
**Effort:** Small
**Risk:** Low

### Option 2: Validate extracted names against inventory before building the repeated order

Intersect `recentNames` with `extractInventoryNames(args.inventoryText)` before creating the `ORDER:` payload.

**Pros:** Rejects totals / pickup lines automatically.
**Cons:** Fails when the assistant list contains products not present in the current filtered inventory snapshot.
**Effort:** Small
**Risk:** Low

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `api/whatsapp.ts:920-929`
- `api/whatsapp.ts:1126-1136`

## Acceptance Criteria

- [ ] `"1 de cada"` only uses actual product names from the last assistant list
- [ ] Summary/meta lines like total or pickup are never turned into order items
- [ ] A unit test covers assistant replies that mix product bullets with non-product bullets

## Work Log

### 2026-03-11 — Found during workflows-review

## Resources

- **PR:** #156
