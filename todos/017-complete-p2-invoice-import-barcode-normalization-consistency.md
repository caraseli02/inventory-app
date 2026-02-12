---
status: complete
priority: p2
issue_id: "017"
tags: [code-review, invoice-import, data-integrity]
dependencies: []
---

# Normalize Barcodes Consistently During Import and Matching

## Problem Statement

Barcode-based matching is exact. If barcode values contain whitespace or formatting noise, updates can miss existing products and create duplicates. We already trimmed barcodes in one place, but the logic is inconsistent across import paths.

## Findings

- Invoice import now trims barcodes when constructing `ImportedProduct`:
  - `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx`
- Invoice import matching in the handler still contains conditions that check `imported.Barcode` (raw) rather than the normalized/trimmed value, which can lead to confusing behavior (truthy whitespace barcodes).
  - `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/pages/InventoryListPage.tsx`
- The non-invoice xlsx import path does not normalize barcodes before calling `getProductByBarcode(imported.Barcode)`.

## Proposed Solutions

### Option 1: Centralize Barcode Normalization Helper (Recommended)

**Approach:**
- Add a single `normalizeBarcode()` helper (trim, empty -> undefined) in a shared lib (or in import modules).
- Use it consistently before:
  - `getProductByBarcode(...)`
  - deciding whether a barcode is present
  - persisting `Barcode`

**Pros:**
- Eliminates a class of “phantom duplicates”.
- Easy to reason about and test.

**Cons:**
- Minor refactor touches multiple call sites.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Normalize Only at API Boundary

**Approach:**
- Normalize in `getProductByBarcode()` wrappers (api-provider), and in create/update payloads.

**Pros:**
- Fewer call sites to change.

**Cons:**
- Doesn’t fix UI “presence checks” that still look at raw strings.

**Effort:** 2-4 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx`
- `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/pages/InventoryListPage.tsx`
- `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/lib/api-provider.ts` (optional location for central normalization)

## Acceptance Criteria

- [x] Barcode matching behaves the same regardless of leading/trailing spaces.
- [x] Invoice import never creates duplicates solely due to barcode whitespace.
- [x] XLSX import also normalizes barcodes before lookup.
- [ ] Tests cover `normalizeBarcode` edge cases (empty string, whitespace, normal numeric strings).

## Work Log

### 2026-02-12 - Review Finding

**By:** Codex

**Actions:**
- Traced invoice/xlsx import matching paths and identified inconsistent normalization points.

### 2026-02-12 - Fix Implemented

**By:** Codex

**Actions:**
- Trimmed barcodes when converting invoice rows to `ImportedProduct`.
- Centralized `normalizeBarcode()` in the import handler and used it for barcode lookup and creation in both invoice and xlsx import paths.
