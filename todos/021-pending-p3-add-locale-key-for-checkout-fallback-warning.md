---
status: complete
priority: p3
issue_id: "021"
tags: [code-review, i18n, ui, checkout]
dependencies: []
---

# Add i18n locale key for checkout store-price fallback warning

## Problem Statement

Checkout review modal displays a warning when a product is missing its active tier price and totals fall back to base cost. The warning currently relies on `defaultValue` passed to `t(...)` rather than a real translation key in `src/locales/*.json`.

This reduces translation consistency and makes it harder to audit or improve copy in non-English locales.

## Findings

- `src/pages/CheckoutPage.tsx` uses:
  - `t('checkout.storePriceFallbackWarning', { defaultValue: '...' })`
- There is no corresponding key in `src/locales/en.json`, `src/locales/ro.json`, `src/locales/es.json`, `src/locales/ru.json`.

Also:
- If both `missingPrices > 0` and `fallbackPrices > 0`, only the missing-prices warning is shown. That may hide the fallback condition.

## Proposed Solutions

### Option 1: Add the translation key to all locales (minimal)

**Approach:**
- Add `checkout.storePriceFallbackWarning` to all locale JSON files.
- Keep `defaultValue` (optional) as a safety net.

**Pros:**
- Simple and clean
- Keeps translation coverage explicit

**Cons:**
- Requires maintaining 4 locale files

**Effort:** 15-30 minutes

**Risk:** Low

---

### Option 2: Extract warning logic into a helper and show combined warnings

**Approach:**
- Add key(s) for both conditions.
- If both conditions exist, show a combined warning or two stacked warnings.

**Pros:**
- More accurate operator feedback

**Cons:**
- Slightly more UI complexity

**Effort:** 30-60 minutes

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

Affected files:
- `src/pages/CheckoutPage.tsx`
- `src/locales/en.json`
- `src/locales/ro.json`
- `src/locales/es.json`
- `src/locales/ru.json`

## Acceptance Criteria

- [x] `checkout.storePriceFallbackWarning` exists in all locale JSONs
- [x] No UI copy relies solely on `defaultValue` for this warning
- [x] When both missing and fallback cases occur, operator receives clear messaging

## Work Log

### 2026-02-12 - Review Finding

**By:** Codex

**Actions:**
- Noted new warning uses `defaultValue` without locale keys
- Identified combined-warning visibility gap (optional improvement)

### 2026-02-13 - Completed

**By:** Codex

**Actions:**
- Added `checkout.storePriceFallbackWarning` to all locale JSONs
- Updated checkout review warnings to show fallback warning even when missing-price warning is also shown
