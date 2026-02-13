---
module: CheckoutPage
date: 2026-02-13
problem_type: ui_bug
component: page_component
symptoms:
  - "Checkout fallback warning relied on defaultValue (no locale key in translations)"
  - "Fallback warning could be hidden when missing-prices warning is also shown"
root_cause: config_error
resolution_type: code_fix
severity: low
tags: [checkout, i18n, locales, warning]
related_github_issue: null
commit: 37332778f3604cef198ec4b1263a5d9a61fddb13
---

# Problem Description

The checkout review modal displays a warning when some items are missing store tier prices and totals fall back to base cost. The UI used `t(..., { defaultValue })` without a real translation key, and the warning could be suppressed when the missing-prices warning was also active.

# Symptoms

- Non-English locales may not have consistent warning copy (depends on `defaultValue`).
- Operators can miss the fallback-to-base-cost condition when `missingPrices > 0`.

# Root Cause Analysis

The i18n key `checkout.storePriceFallbackWarning` did not exist in `src/locales/*.json`, and the rendering logic gated the fallback warning behind `missingPrices === 0`.

```tsx
// ❌ BEFORE - warning gated and relies on defaultValue
{missingPrices === 0 && fallbackPrices > 0 && (
  <div>⚠️ {t('checkout.storePriceFallbackWarning', { defaultValue: '...' })}</div>
)}
```

# Solution

1. Add `checkout.storePriceFallbackWarning` to all locale JSON files.
2. Render the fallback warning whenever `fallbackPrices > 0` (even if missing-prices warning is also shown).

# Files Changed

- `src/pages/CheckoutPage.tsx`
- `src/locales/en.json`
- `src/locales/ro.json`
- `src/locales/es.json`
- `src/locales/ru.json`

# Prevention

- Avoid relying on `defaultValue` for shipping UI copy: require real locale keys.
- Prefer showing all relevant operator warnings rather than mutually-exclusive gating.

