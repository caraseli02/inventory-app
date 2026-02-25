---
module: InvoiceUploadDialog
date: 2026-02-25
problem_type: ui_bug
component: dialog_component
symptoms:
  - "Preview briefly showed EUR labels with unconverted LEI values after extraction"
  - "FX badge showed 'Manual' even though the FX rate was defaulted to 19.5"
root_cause: state_race
resolution_type: code_fix
severity: medium
tags: [invoice-import, fx-rate, mdl-eur, useeffect, i18n]
related_github_issue: null
commit: null
---

# Problem Description

After defaulting invoice import FX rate to `19.5`, the preview could render with EUR labels/symbols while the extracted values were still LEI (until the FX conversion `useEffect` ran). The FX badge also misleadingly showed “Manual” even when the value was a default.

# Symptoms

- Immediately after successful invoice extraction, preview showed `€` / `EUR` labels with numbers still in LEI for a brief moment (device-speed dependent).
- FX badge displayed “Manual” while the FX input was auto-filled with `19.5`.

# Root Cause Analysis

1) FX conversion happened in a post-render `useEffect` (derived state from `rawProducts` + `fxRate`). With `fxRate=19.5` by default, the UI considered FX “ready” immediately and rendered EUR labels before the conversion effect updated `editableProducts`.

2) Badge copy assumed the only non-empty FX state was user-entered (“Manual”), but the FX rate became defaulted.

```tsx
// ❌ BEFORE - conversion applied after first preview paint
setEditableProducts(result.data.products.map((product, index) => ({
  ...product,
  previewId: getPreviewId(product, index),
  // unitPrice/totalPrice still LEI here
})));
setStep('preview');
```

# Solution

1) Apply the same LEI→EUR conversion immediately when building `editableProducts` on extraction success (when `fxRate` is valid), so the first preview paint matches the EUR labels.

2) Add a minimal “default vs manual” state: badge shows “Default (19.5)” until the FX input is edited, then switches to “Manual”. Add i18n keys under `invoiceUpload.fx`.

```tsx
// ✅ AFTER - pre-convert before first preview paint (when FX is valid)
const totalPrice = isFxReadyNow ? roundCurrency(product.totalPrice / resolvedFxRate) : product.totalPrice;
const unitPrice = isFxReadyNow ? (quantity > 0 ? roundCurrency(totalPrice / quantity) : 0) : product.unitPrice;
```

# Files Changed

- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/locales/en.json`
- `src/locales/ro.json`
- `src/locales/ru.json`
- `src/locales/es.json`
- `tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx`

# Prevention

- [x] Add/extend unit test to assert preview renders EUR values immediately when default FX is set.
- [ ] When adding future “BNM auto-rate” behavior, keep a clear FX source state (`default | manual | fetched`) to avoid UI ambiguity.

# Related Issues

- See also: `docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md`
- See also: `docs/solutions/logic-errors/mdl-prices-treated-as-eur-InvoiceUploadDialog-20260206.md`

