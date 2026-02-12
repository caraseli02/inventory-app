---
status: complete
priority: p3
issue_id: "018"
tags: [code-review, invoice-import, ux, i18n]
dependencies: []
---

# Import Progress Messaging and UI Accuracy

## Problem Statement

The import loader currently displays progress as “products processed”, but the UI and translations still mix “created” vs “processed”. This can confuse users during invoice imports with many updates/skips/errors.

## Findings

- Loader text uses `invoiceUpload.status.importingProgress` with a default string.
  - `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx`
- The i18n key `invoiceUpload.status.importingProgress` likely exists only via default value fallback, while other locales may not include it consistently.
  - `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/locales/*.json`
- Progress updates count every row (including skips/errors). That is correct for “processed”, but if copy says “created” it becomes misleading.

## Proposed Solutions

### Option 1: Add Explicit i18n Keys for Importing Progress (Recommended)

**Approach:**
- Add/update `invoiceUpload.status.importingProgress` to all supported locales.
- Ensure copy consistently says “processed” (or “imported”) and optionally show a breakdown:
  - `processed`, `created`, `updated`, `skipped`, `failed`

**Pros:**
- Clearer UX.
- No reliance on defaultValue fallbacks.

**Cons:**
- Requires updating locale files.

**Effort:** 30-60 minutes

**Risk:** Low

---

### Option 2: Keep Simple Copy But Ensure Consistency

**Approach:**
- Keep “processed” copy and remove any “created” references.

**Pros:**
- Minimal.

**Cons:**
- Still lacks useful breakdown that explains why some products weren't created.

**Effort:** 15-30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx`
- `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/locales/en.json`
- `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/locales/ro.json`
- `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/locales/ru.json`
- `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/locales/es.json`

## Acceptance Criteria

- [x] Loader copy is consistent (no “created” when counting “processed”).
- [x] i18n keys exist in all supported locales (no reliance on defaultValue for core UI text).

## Work Log

### 2026-02-12 - Review Finding

**By:** Codex

**Actions:**
- Reviewed invoice import loader behavior and messaging.

### 2026-02-12 - Fix Implemented

**By:** Codex

**Actions:**
- Added progress callback from invoice import UI down to the import handler loop so the loader increments live.
- Updated `invoiceUpload.status.importingProgress` translations to use “processed” in `en`, `ro`, `ru`, `es`.
