---
module: useCreateProduct
date: 2026-02-27
problem_type: ui_bug
component: custom_hook
symptoms:
  - "Image upload failure toast was shown only in English for non-English locales"
  - "Refactor moved upload error handling into hook and lost translation call"
root_cause: missing_error_handler
resolution_type: code_fix
severity: medium
tags: [i18n, create-product, image-upload, refactor, react-query]
related_github_issue: null
commit: null
---

# Problem Description

A refactor extracted product-creation logic into `useCreateProduct`, but the image upload failure branch started throwing a hardcoded English string. Users on localized UIs no longer got translated error text.

# Symptoms

- Camera/URL image upload failure produced English-only toast text.
- Regression appeared after extraction from `CreateProductForm` to `useCreateProduct`.
- Other error paths stayed localized, making this inconsistent.

# Root Cause Analysis

During extraction, translation (`t(...)`) was no longer available inside the helper and the fallback string became the primary message.

```typescript
// ❌ BEFORE
throw new Error('Failed to upload product image. Please try again or proceed without an image.');
```

# Solution

Thread localized copy into the extracted helper and keep rendering unchanged.

```typescript
// ✅ AFTER
mutationFn: (data) => createProductWithStock(
  barcode,
  data,
  t('errors.imageUploadFailed', 'Failed to upload product image. Please try again or proceed without an image.'),
)

// helper
throw new Error(imageUploadFailedMessage);
```

Implemented changes:
1. Added `imageUploadFailedMessage` parameter to `createProductWithStock`.
2. Passed localized message from `useCreateProduct` mutation using `t('errors.imageUploadFailed', ...)`.
3. Kept existing toast error display path (`onError`) unchanged.

# Files Changed

- `src/hooks/useCreateProduct.ts`
- `todos/064-complete-p2-hook-extraction-loses-image-upload-i18n.md`

# Verification

- `pnpm lint`
- `pnpm typecheck`

Both passed.

# Prevention

- [x] Do not introduce hardcoded user-facing copy in extracted hooks/helpers.
- [x] When refactoring UI logic into hooks, pass translated strings at boundaries.
- [x] Add a review check for localization regressions in refactors.
- [x] Keep i18n-related review findings tracked in `todos/` until fixed.

# Related Documentation

- `docs/solutions/ui-bugs/silent-failures-stock-history-ai-autofill-InventoryFlows-20260218.md`
