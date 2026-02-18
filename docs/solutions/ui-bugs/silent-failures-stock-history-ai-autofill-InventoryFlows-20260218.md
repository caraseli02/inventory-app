---
module: InventoryFlows
date: 2026-02-18
problem_type: ui_bug
component: react_component
symptoms:
  - "Product detail dialog showed 'No stock movements recorded' when API fetch failed"
  - "OpenFoodFacts requests could hang without timeout, delaying or freezing auto-fill feedback"
  - "Create product flow had no explicit AI status (found/not found/error), causing silent failures"
  - "New AI status badges initially lacked locale keys in non-English translations"
root_cause: missing_error_handler
resolution_type: code_fix
severity: high
tags: [inventory, product-detail, ai-autofill, openfoodfacts, timeout, i18n, react-query]
related_github_issue: 27
commit: null
---

# Problem Description

Multiple user-facing flows failed silently or ambiguously:
- stock history fetch errors were masked as empty data,
- AI lookups had no bounded timeout behavior,
- AI auto-fill outcomes were not clearly communicated,
- and localization coverage for new statuses was initially incomplete.

Impact was reduced user trust and unclear operator decisions during inventory operations.

# Symptoms

- In product detail, users saw "No stock movements recorded" even when backend fetch failed.
- OpenFoodFacts calls could wait indefinitely under poor network conditions.
- Create product form stopped showing loading without telling users if AI found data, found nothing, or failed.
- Non-English locales displayed English fallback text for new AI badges.

# Root Cause Analysis

The flows lacked explicit state modeling for failure and outcome paths.

```typescript
// ❌ BEFORE - stock movement fetch failures mapped to []
queryFn: async () => {
  try {
    return await getStockMovements(product.id);
  } catch {
    return [];
  }
}

// ❌ BEFORE - OpenFoodFacts without timeout
const response = await fetch(`${OFF_API_URL}/${barcode}.json`);

// ❌ BEFORE - AI flow only had loading boolean, no explicit result states
const [aiLoading, setAiLoading] = useState(false);
```

# Solution

Implemented explicit state and bounded failure handling in all affected flows.

```typescript
// ✅ AFTER - ProductDetailDialog has explicit error state + retry via React Query
const { isError, error, refetch } = useQuery({ retry: false, ... });

// ✅ AFTER - OpenFoodFacts uses AbortController timeout (default 8000ms)
const abortController = new AbortController();
setTimeout(() => abortController.abort(), timeoutMs);

// ✅ AFTER - CreateProductForm uses explicit AI state machine
type AiStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error';
```

Applied fixes:
1. `ProductDetailDialog`
- Added explicit error branch for movement-history fetch failures.
- Added retry action (`Try again`) and kept structured logging.
- Ensured empty state renders only after successful fetch with zero movements.

2. `openFoodFacts`
- Added `AbortController` timeout with safe cleanup in `finally`.
- Added timeout-specific warning vs non-timeout failure logging.
- Preserved return contract: `Promise<OpenFoodFactsResponse | null>`.

3. `CreateProductForm`
- Added `AiStatus` union state for deterministic UI feedback.
- Added badge feedback for `loading`, `found`, `not_found`, `error`.
- Added display guard so stale AI status is hidden when barcode becomes empty.

4. Localization follow-up
- Added new `product.aiStatusFound|NotFound|Error` keys in `en`, `ro`, `ru`, `es` locale files.

# Files Changed

- `src/components/inventory/ProductDetailDialog.tsx`
- `src/lib/ai/openFoodFacts.ts`
- `src/components/product/CreateProductForm.tsx`
- `src/locales/en.json`
- `src/locales/ro.json`
- `src/locales/ru.json`
- `src/locales/es.json`
- `tests/unit/lib/openFoodFacts.test.ts`
- `tests/unit/components/inventory/ProductDetailDialog.test.tsx`
- `tests/unit/components/product/CreateProductForm.test.tsx`

# Verification

- `pnpm vitest run tests/unit/lib/openFoodFacts.test.ts tests/unit/components/product/CreateProductForm.test.tsx tests/unit/components/inventory/ProductDetailDialog.test.tsx`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

All passed.

# Prevention

- [x] Add explicit error and retry UI for API-backed read states; never collapse errors into empty data.
- [x] Require timeouts for third-party network calls in user-critical flows.
- [x] Model async UX with explicit finite states (`loading/found/not_found/error`) instead of booleans only.
- [x] Add locale keys whenever new user-facing strings are introduced.
- [x] Cover timeout/error/empty-state branches with unit/component tests.
