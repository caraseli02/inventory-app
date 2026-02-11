---
status: pending
priority: p2
issue_id: "016"
tags: [code-review, ui, pricing, clarity]
dependencies: []
---

# Transport hint contradicts displayed pricing formula

## Problem Statement

In the pricing card, the formula now displays transport-inclusive math (for example `70% tier: (€6.15 + €0.75 = €6.90) → €11.73`) even when the invoice breakdown inputs are empty, but the hint below says transport is not included.

## Findings

- Formula row uses inferred transport from saved prices when manual inputs are empty.
- Hint row still renders `markup.transportMissingHint` in the same state.
- This creates a direct contradiction and confuses users.
- Evidence:
  - `src/components/product/EditProductDialog.tsx:522`
  - `src/components/product/EditProductDialog.tsx:549`

## Proposed Solutions

### Option 1: Align hint with inferred formula path

**Approach:** Replace missing-transport hint with text that transport is inferred from current saved prices when manual inputs are empty.

**Pros:** Minimal change, no math behavior changes.

**Cons:** Still relies on inferred transport which can be opaque.

**Effort:** Small

**Risk:** Low

---

### Option 2: Show inferred vs manual source explicitly

**Approach:** Add a small source tag (`inferred` / `manual`) beside formula and hint.

**Pros:** Removes ambiguity completely.

**Cons:** Slight UI complexity.

**Effort:** Small

**Risk:** Low

## Recommended Action


## Technical Details

- `src/components/product/EditProductDialog.tsx`
- `src/locales/*.json`

## Acceptance Criteria

- [ ] When manual inputs are empty, formula and hint text are consistent
- [ ] No message claims transport is missing if transport is shown in formula
- [ ] Existing pricing display behavior remains unchanged

## Work Log

### 2026-02-11 - Review finding

**By:** Codex

**Actions:**
- Reviewed formula path and hint fallback conditions.
- Confirmed contradictory states in default empty-input view.

**Learnings:**
- Explanatory copy must follow the same decision path as computed display values.
