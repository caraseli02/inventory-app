---
module: InventoryListPage
date: 2026-03-06
problem_type: performance_issue
component: page_component
symptoms:
  - "Inventory route chunk stayed above 560KB even when users only browsed products"
  - "Optional import/invoice flows were loaded in the default inventory path"
  - "CSS and route payload growth lacked CI guardrails and could regress silently"
root_cause: logic_error
resolution_type: refactor
severity: high
tags: [performance, code-splitting, lazy-loading, bundle-budget, inventory, orders]
related_github_issue: null
commit: null
description: "Inventory route bundled optional dialogs eagerly; fixed via lazy-loading and CI size budgets."
related_solutions: [invoice-ocr-fake-progress-reporting, invoice-ocr-timeout-and-progress-tracking]
status: complete
---

# Problem Description

The inventory page was paying startup cost for heavy optional UI flows (Excel import and invoice upload) even when users only viewed or filtered inventory. This increased default route JS size and made future regressions hard to catch because no bundle-size gate existed in CI.

# Symptoms

- Production build showed a large inventory route chunk (`InventoryListPage` ~561KB raw JS before the fix).
- Import and invoice-related code paths were present in the inventory route bundle graph by default.
- No CI budget check failed when route or CSS size drifted.

# Root Cause Analysis

`InventoryListPage` imported optional dialogs at module load time. Static imports forced those modules into the initial route payload.

```tsx
// BEFORE - eager imports on initial inventory route load
import { ImportDialog } from '../components/xlsx/ImportDialog';
import { InvoiceUploadDialog } from '../components/invoice/InvoiceUploadDialog';
```

The Orders card also imported `invoiceAuth` eagerly, coupling order list render path with notification auth utilities.

```tsx
// BEFORE - eager dependency in Orders path
import { resolveSupabaseAccessToken } from '@/lib/invoiceAuth';
```

# Solution

## 1. Lazy-load optional inventory dialogs

Converted dialog imports to `React.lazy` and rendered them only when open.

```tsx
const ImportDialog = lazy(async () => {
  const module = await import('../components/xlsx/ImportDialog');
  return { default: module.ImportDialog };
});

const InvoiceUploadDialog = lazy(async () => {
  const module = await import('../components/invoice/InvoiceUploadDialog');
  return { default: module.InvoiceUploadDialog };
});

{importDialogOpen && (
  <Suspense fallback={<Spinner size="sm" label="Loading import dialog..." />}>
    <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} onImport={handleImport} />
  </Suspense>
)}
```

## 2. Add CI bundle/CSS guardrails

Created `scripts/check-bundle-size.js`, added `pnpm check:bundle-size`, and wired it into CI after `pnpm build`.

Tracked budgets:
- `InventoryListPage` chunk
- `OrdersPage` chunk
- `index.css`
- total emitted JS

## 3. Reduce Orders payload coupling and simplify styling

- Switched `resolveSupabaseAccessToken` to dynamic import inside `notifyCustomer` to avoid eager dependency in Orders render path.
- Simplified several high-variance Tailwind classes in `OrderCard` action UI.

# Measurements

Baseline and post-fix measurements from this session:

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `InventoryListPage` chunk | 561,585 B | 510,374 B | -51,211 B (-9.1%) |
| `OrdersPage` chunk | 15,627 B | 15,659 B | +32 B |
| `index.css` | 140,313 B | 139,968 B | -345 B |
| total emitted JS | 2,022,972 B | 2,027,147 B | +4,175 B |
| Build time (local) | 6.90s (pre-fix snapshot) | 3.39s | improved in this run |

Split chunks created for on-demand loading:
- `ImportDialog`: 9,089 B
- `InvoiceUploadDialog`: 45,450 B

# Files Changed

- `src/pages/InventoryListPage.tsx` (lazy-load optional dialogs)
- `src/pages/orders/OrderCard.tsx` (defer invoice auth import + simplify classes)
- `scripts/check-bundle-size.js` (bundle budget gate)
- `package.json` (add `check:bundle-size` script)
- `.github/workflows/ci.yml` (run budget check in CI)

# Prevention

- [x] Added CI bundle budget enforcement for key route chunks and CSS
- [x] Documented route-level code-splitting pattern for optional dialogs
- [x] Verified fix with production build output and chunk-size checks
- [ ] Add route-level runtime budget test (throttled mobile profile) to CI or scheduled audit

# Related Documentation

- See also: `docs/solutions/performance-issues/invoice-ocr-fake-progress-reporting.md`
- See also: `docs/solutions/performance-issues/invoice-ocr-timeout-and-progress-tracking.md`
