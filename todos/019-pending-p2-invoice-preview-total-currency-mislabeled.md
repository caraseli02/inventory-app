---
status: pending
priority: p2
issue_id: "019"
tags: [code-review, ui, pricing, currency]
dependencies: []
---

# Invoice preview total is mislabeled as EUR before FX conversion

## Problem Statement

In invoice upload preview, the summary total always renders with `€`, even when FX rate is not set and row totals are still LEI values.
This can mislead pricing validation and make users think conversion already happened.

## Findings

- `previewTotalAmount` is computed from `editableProducts.totalPrice`.
- Before FX rate is entered, `editableProducts.totalPrice` is still sourced from extracted invoice values (LEI).
- Summary UI still displays `€` regardless of `isFxReady`.
- Evidence:
  - `src/components/invoice/InvoiceUploadDialog.tsx:853`
  - `src/components/invoice/InvoiceUploadDialog.tsx:857`
  - `src/components/invoice/InvoiceUploadDialog.tsx:456`

## Proposed Solutions

### Option 1: Currency-aware summary label (recommended)

**Approach:** Render summary as `LEI` when `!isFxReady`, and `€` when FX conversion is active.

**Pros:** Accurate UX, minimal change.

**Cons:** Requires small conditional in summary rendering.

**Effort:** Small

**Risk:** Low

---

### Option 2: Hide summary total until FX is provided

**Approach:** Do not display preview summary total before FX is entered.

**Pros:** Avoids any currency ambiguity.

**Cons:** Users lose useful pre-conversion total context.

**Effort:** Small

**Risk:** Low

## Recommended Action


## Technical Details

- `src/components/invoice/InvoiceUploadDialog.tsx`

## Acceptance Criteria

- [ ] When FX is missing, preview summary total shows LEI (not EUR symbol)
- [ ] When FX is provided, preview summary total shows EUR symbol and converted value
- [ ] No regressions in invoice preview table currency labels

## Work Log

### 2026-02-11 - Review finding

**By:** Codex

**Actions:**
- Reviewed current invoice preview conversion flow.
- Verified table uses `isFxReady` for row-level labels while summary does not.
- Logged mismatch as P2 UX/data-clarity issue.

**Learnings:**
- Mixed-currency preview states need explicit labels in every aggregate and row-level UI element.
