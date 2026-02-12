---
status: complete
priority: p2
issue_id: "020"
tags: [code-review, ui, pricing, scan-page]
dependencies: []
---

# Confirm price mode for ScanPage search dropdown (base vs store)

## Problem Statement

We changed shared search UI components to display **markup-tier store price** (via `getProductDisplayPrice`) to fix checkout/listing parity. Those same components are also used on `ScanPage` (Manage Stock).

If the Scan/Manage Stock workflow is intended to show **base cost** (supplier cost) instead of store price, this change is a behavioral regression and needs a deliberate design decision + possible split between "base price" vs "store price" display modes.

## Findings

- `src/components/search/ProductSearchDropdown.tsx` now uses `getProductDisplayPrice(product.fields)` to render the price.
- `src/pages/ScanPage.tsx` uses `ProductSearchDropdown` for search mode (both mobile and desktop).
- `src/pages/CheckoutPage.tsx` uses the same dropdown and also browse cards; showing store price there is desired.

Impact:
- Scan/Manage Stock search results now show store price (tier-based) instead of base cost (`fields.Price`).

## Proposed Solutions

### Option 1: Keep store price everywhere (documented decision)

**Approach:** Accept store price as the default displayed price across search surfaces, including ScanPage.

**Pros:**
- Consistency across the app
- Simple: no extra props/branches

**Cons:**
- Operators might need base cost in stock management context
- Base cost becomes less discoverable during scanning

**Effort:** 15-30 minutes

**Risk:** Low

---

### Option 2: Add explicit `priceMode` prop to shared search components

**Approach:** Add `priceMode: 'store' | 'base'` (default `'store'`) to:
- `ProductSearchDropdown`
- optionally `ProductBrowsePanel` + `QuickAddGrid` if they get reused outside checkout later

Then:
- Checkout passes `priceMode="store"`
- ScanPage passes `priceMode="base"` (if desired)

**Pros:**
- Clear, intentional behavior per screen
- Avoids hidden coupling between checkout + scan semantics

**Cons:**
- Slightly more API surface
- Needs follow-up edits in call sites

**Effort:** 30-60 minutes

**Risk:** Low

---

### Option 3: Split helpers (naming clarity) and keep UI dumb

**Approach:** Introduce explicit helpers:
- `getProductStorePrice(fields)` (tier-based)
- `getProductBaseCost(fields)` (base `Price`)

UI components receive the computed number as a prop.

**Pros:**
- Minimal implicit behavior inside UI components
- Encourages correctness at call sites

**Cons:**
- More plumbing through props

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

Decision (2026-02-12): **Scan/Manage Stock does not need base cost**. Keep store price display in ScanPage.

Action:
- Keep current implementation (store price everywhere for shared search surfaces).
- Downgrade priority/status during triage (this is no longer a fix-needed item).

## Technical Details

Affected files:
- `src/components/search/ProductSearchDropdown.tsx`
- `src/pages/ScanPage.tsx`
- `src/pages/CheckoutPage.tsx` (checkout should remain store/tier)

## Acceptance Criteria

- [ ] Decision recorded: ScanPage search shows base cost OR store price
- [ ] UI behavior matches the decision on both ScanPage and CheckoutPage
- [ ] If a prop-based approach is chosen, defaults are documented and call sites updated

## Work Log

### 2026-02-12 - Review Finding

**By:** Codex

**Actions:**
- Identified shared component reuse between checkout and scan flows
- Noted potential semantic mismatch (base vs store price)

**Learnings:**
- `ProductSearchDropdown` is used in both `ScanPage` and `CheckoutPage`

### 2026-02-12 - User Decision

**By:** User

**Actions:**
- Confirmed base cost is not needed in scanner (ScanPage).
- Chose to keep store price display for ScanPage search results.
