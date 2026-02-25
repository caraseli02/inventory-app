---
module: InvoiceUploadDialog
date: 2026-02-16
problem_type: state_issue
component: dialog_component
symptoms:
  - "Update/Skip selection moved to the wrong row after deleting a preview row"
  - "Deleted rows reappeared after FX rate changes"
  - "Invoice preview row behavior became unstable when list order changed"
root_cause: logic_error
resolution_type: refactor
severity: high
tags: [invoice-import, invoice-preview, react-state, row-identity, fx-rate]
related_github_issue: null
commit: null
---

# Problem Description

`InvoiceUploadDialog` used index-based row state for import actions and rebuilt preview rows from raw OCR data on FX updates. This made row-level state drift when rows were removed.

# Symptoms

- Set row A to `Skip`, remove another row, then row actions no longer matched intended products.
- Remove a row, change FX rate, and removed rows returned.
- Row-level behavior depended on array position instead of row identity.

# Root Cause Analysis

Mutable list state was keyed by array index. After deletions/rebuilds, indices changed.

```typescript
// ❌ BEFORE
const [importActions, setImportActions] = useState<Record<number, ImportAction>>({});

// actions read/written by index
const importAction = importActions[index] ?? (match ? 'update' : 'create');

// FX recalculation rebuilt from rawProducts and ignored deletions
setEditableProducts(rawProducts.map((product, index) => ({ ...product })));
```

# Solution

Introduce stable per-row preview identity and key row-level state by that identity.

```typescript
// ✅ AFTER
const [importActions, setImportActions] = useState<Record<string, ImportAction>>({});
const [removedPreviewIds, setRemovedPreviewIds] = useState<Set<string>>(new Set());

const getPreviewId = (product: InvoiceProduct, index: number): string => {
  const rowId = product.rowId?.trim();
  if (rowId) return `row:${rowId}`;
  return `idx:${index}`;
};

// FX remap keeps removals out and reuses state by previewId
if (removedPreviewIds.has(previewId)) return [];
const previous = prevById.get(previewId);
```

Also updated render/import paths to read and write actions via `product.previewId`, not index.

# Files Changed

- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/locales/en.json`
- `src/locales/es.json`
- `src/locales/ro.json`
- `src/locales/ru.json`

# Prevention

- [ ] Add component test: remove row after selecting `Skip/Update`, ensure other rows keep selections.
- [ ] Add component test: remove row, change FX rate, ensure removed row does not return.
- [ ] Avoid index-keyed state for mutable lists; require stable identifiers.
- [ ] Add a guard for duplicate OCR `rowId` values when generating `previewId`.

# Related

- `docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md`
- `docs/solutions/ui-bugs/fx-default-eur-preview-flicker-InvoiceUploadDialog-20260225.md`
- `todos/013-complete-p2-import-action-index-shift.md`
- `todos/014-complete-p2-removed-items-return-on-fx-change.md`
- `todos/019-complete-p2-invoice-preview-total-currency-mislabeled.md`
