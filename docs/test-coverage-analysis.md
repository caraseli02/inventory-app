# Test Coverage Analysis

**Date**: 2026-02-07
**Status**: Analysis complete

---

## Current State

| Metric | Value | Assessment |
|--------|-------|------------|
| Unit test files | 9 (+ 1 skipped) | Low |
| Integration test files | 1 | Adequate for API layer |
| E2E test files | 9 | Mostly exploratory |
| Passing unit tests | 133 | Moderate |
| Skipped tests | 3 (invoiceOCR) | Blocked on mocking |
| Components with unit tests | 0 / 61 | Critical gap |
| Hooks with unit tests | 1 / 9 | Critical gap |
| Lib files with unit tests | 5 / 13 | Partial |
| Coverage config scope | 5 files | Very narrow |
| Coverage thresholds | 80/80/70/80 | Good, but only enforced on 5 files |

### What passes today

```
pnpm test:run
# 9 test files passed, 1 skipped
# 133 tests passed, 3 skipped
```

Coverage (v8, only for the 5 configured files):

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| hooks/useLowStockAlerts.ts | 93.9% | 90.9% | 100% | 93.8% |
| lib/errors.ts | 100% | 100% | 100% | 100% |
| lib/filters.ts | 78.9% | 76.9% | 100% | 78.9% |
| lib/logger.ts | 100% | 72.2% | 100% | 100% |
| lib/ai/index.ts | 95.2% | 95.8% | 100% | 100% |

---

## Gap Analysis: Where to Improve

### Priority 1 — High-risk business logic with zero tests

These files contain core business logic that users depend on. Bugs here cause data corruption or broken workflows.

#### 1a. `src/lib/supabase-api.ts` — unit tests for each exported function

**Risk**: This is the primary data layer. Only event-ordering invariants are tested (8 tests in `supabase-api-fixes.test.ts`). The actual CRUD logic — validation, mapping, error-code handling — has no unit-level coverage.

**What to test**:
- `mapSupabaseProduct` — field mapping correctness, null/undefined handling, image array conversion
- `mapSupabaseStockMovement` — mapping fidelity
- `validateNonEmptyString` — empty, whitespace, valid inputs
- `createProduct` — validation errors (empty name, non-finite price), successful insert path, event append after DB success
- `updateProduct` — diff logic (no-op when unchanged), partial updates, validation on productId/Name/Price
- `deleteProduct` — FK violation (23503) mapped to ValidationError, RLS violation (PGRST116), product-not-found
- `addStockMovement` — quantity signing (IN → positive, OUT → negative), validation (zero, negative, non-finite), date generation
- `calculateStockLevel` — sum aggregation, empty movements → 0
- `getAllProducts` — stock-level aggregation across products

**Approach**: Mock `supabase` client (`.from().select().eq()` chain). The existing `supabase-api-fixes.test.ts` already demonstrates the mocking pattern — extend it.

#### 1b. `src/lib/exchangeRates.ts` — pure logic + fetch mocking

**Risk**: Currency conversion affects pricing display. Incorrect rates or unhandled XML parsing failures silently corrupt prices.

**What to test**:
- `formatBnmDate` — day/month zero-padding, correct format
- `parseNumber` — comma decimals (`"19,45"` → `19.45`), null, empty string, NaN
- `parseBnmXml` — valid XML extraction, missing EUR node, invalid rate values, parser errors
- `getBnmEurRate` — fallback day logic (tries previous days), max lookback exceeded
- `fetchBnmXml` — HTTP error status, network failure

**Approach**: Unit-test the pure functions (`formatBnmDate`, `parseNumber`, `parseBnmXml`) directly. Mock `fetch` for `fetchBnmXml` and `getBnmEurRate`.

#### 1c. `src/lib/imageUpload.ts` — upload fallback chain

**Risk**: Silent failure leaves products without images. The Vercel → imgbb fallback has three failure modes that should be verified.

**What to test**:
- `isDataUrl` — data URLs vs regular URLs
- `uploadImage` — returns non-data URLs unchanged (passthrough)
- `uploadToVercelBlob` — success, HTTP error, missing URL in response
- `uploadToImgbb` — success, missing API key, invalid base64, HTTP error
- Fallback chain: Vercel fails → imgbb succeeds; both fail → descriptive error

**Approach**: Mock `fetch`. Mock `import.meta.env` for API key presence.

---

### Priority 2 — Untested hooks (8 of 9)

Hooks contain filtering, sorting, caching, and mutation logic. The `useInventoryList` hook in particular has ~130 lines of filtering/sorting logic that's easy to break during refactors.

#### 2a. `src/hooks/useInventoryList.ts` (highest value)

**What to test**:
- Search filter: matches name, matches barcode, case-insensitive, trims whitespace
- Category filter: exact match, combined with search
- Low stock filter: only products with `minStock > 0` and `currentStock < minStock`
- Sorting: by name (string), stock (number), price (number), category (string)
- Sort direction: ascending and descending
- `categories` derivation: unique, sorted, excludes empty/null
- `resetFilters`: returns to defaults
- Edge cases: empty product list, products with missing fields

**Approach**: Use `renderHook` from `@testing-library/react` with a `QueryClientProvider` wrapper. Mock `getAllProducts` to return fixture data.

#### 2b. `src/hooks/useStockMutation.ts`

**What to test**: Optimistic update behavior, rollback on error, cache invalidation after success.

#### 2c. `src/hooks/useProductLookup.ts`

**What to test**: Disabled when barcode is null, no retries, stale time configuration, successful lookup, error propagation.

#### 2d. Remaining hooks (`useProductSearch`, `useMarkupSetting`, `useRecentProducts`, `useAgentInbox`)

Lower priority — test as time allows.

---

### Priority 3 — Unblock skipped tests

#### 3a. `tests/unit/lib/invoiceOCR.test.ts` — 48 tests skipped

These tests exist but are wrapped in `describe.skip()` because they mock `fetch()` while the implementation uses `XMLHttpRequest`.

**Fix options**:
1. Refactor `invoiceOCR.ts` to use `fetch()` instead of XHR (preferred — simpler, modern)
2. Add XHR mocking to the test setup (e.g., `vi.stubGlobal('XMLHttpRequest', ...)`)
3. Use MSW with `http` handlers that intercept both fetch and XHR

Unblocking these 48 tests is high leverage — the tests are already written.

---

### Priority 4 — Strengthen E2E tests

The 6 non-core Playwright files (`product-crud.spec.ts`, `crud-error-handling.spec.ts`, `import-xlsx.spec.ts`, etc.) are exploratory — they take screenshots and `console.log` but lack assertions. Converting them to assertion-based tests would catch regressions in user-facing flows.

**Key flows to assert**:
- Create product → verify it appears in inventory list
- Edit product → verify changes persist after refresh
- Delete product → verify removal from list
- Stock IN/OUT → verify stock count updates
- Excel import → verify imported products appear with correct data
- Error states → verify error messages display for invalid inputs

---

### Priority 5 — Expand coverage config

The `vitest.config.ts` coverage `include` array only tracks 5 files. As tests are added, expand it:

```ts
include: [
  'src/lib/errors.ts',
  'src/lib/logger.ts',
  'src/lib/filters.ts',
  'src/lib/ai/index.ts',
  'src/hooks/useLowStockAlerts.ts',
  // Add as tests are written:
  'src/lib/supabase-api.ts',
  'src/lib/exchangeRates.ts',
  'src/lib/imageUpload.ts',
  'src/hooks/useInventoryList.ts',
  'src/hooks/useStockMutation.ts',
  'src/hooks/useProductLookup.ts',
],
```

---

## Recommended Implementation Order

| Order | Target | Est. Tests | Impact |
|-------|--------|-----------|--------|
| 1 | `supabase-api.ts` unit tests | ~30 | Protects core data layer |
| 2 | `useInventoryList` hook tests | ~20 | Protects filtering/sorting logic |
| 3 | Unblock `invoiceOCR.test.ts` | ~48 (existing) | Free coverage from existing tests |
| 4 | `exchangeRates.ts` unit tests | ~15 | Protects currency conversion |
| 5 | `imageUpload.ts` unit tests | ~12 | Protects image upload chain |
| 6 | `useStockMutation` hook tests | ~10 | Protects optimistic updates |
| 7 | `useProductLookup` hook tests | ~8 | Protects barcode lookup |
| 8 | Convert E2E tests to assertions | ~20 | Catch UI regressions |

Total: ~160 new tests, roughly doubling the current count from 133 to ~290.

---

## Summary

The tested files have strong coverage (80-100%), but the coverage scope is narrow — only 5 of ~80 source files are measured. The three highest-impact gaps are:

1. **`supabase-api.ts`** — the entire data layer runs untested at unit level
2. **`useInventoryList.ts`** — 130 lines of filter/sort logic with no tests
3. **48 skipped invoice OCR tests** — already written, just need mocking fixed

Addressing items 1-3 alone would cover the most critical business logic paths.
