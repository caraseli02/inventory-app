---
status: complete
priority: p2
issue_id: "060"
tags: [code-review, invoice-import, ui-state, consistency]
dependencies: []
---

# Align Confirm Import Fallback Action Logic With Preview Defaults

Ensure `handleConfirmImport` uses the same already-imported price-only defaulting rule as the table render/import action effect.

## Problem Statement

The preview table and import button count compute default actions using `hasPriceDiffs` for already-imported rows, but `handleConfirmImport` fallback still uses `flags.hasDiffs`. If `importActions` is stale/missing for a row, the submitted action can differ from what the UI showed.

## Findings

- Preview render and `importableRowCount` use `flags.isAlreadyImported ? flags.hasPriceDiffs : flags.hasDiffs` in `/Users/vladislavcaraseli/Documents/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx:530` and `/Users/vladislavcaraseli/Documents/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx:555`.
- `handleConfirmImport` fallback action uses `hasDiffs: Boolean(flags?.hasDiffs)` without the already-imported override in `/Users/vladislavcaraseli/Documents/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx:729`.
- This creates a hidden divergence between visible default selection and payload generation logic.

## Proposed Solutions

### Option 1: Extract Shared `getRowDefaultAction(flags, match)` Helper (Recommended)

**Approach:** Centralize the exact default-action calculation in one local function and reuse it in render, count, effect, and confirm payload.

**Pros:**
- Eliminates drift across call sites
- Easier to reason about future behavior changes

**Cons:**
- Small refactor touching multiple call sites

**Effort:** 30-60 minutes

**Risk:** Low

---

### Option 2: Persist Fully Resolved Actions Before Import

**Approach:** Require `importActions` to be fully populated and never fallback during confirm.

**Pros:**
- Removes repeated fallback calculations

**Cons:**
- More brittle if state initialization races
- Requires gating import on action initialization

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx:725`

## Resources

- **Branch:** `codex/feat-invoice-import-idempotent-actions`

## Acceptance Criteria

- [ ] Rendered default action, import count, and payload action match for already-imported rows
- [ ] Unit test covers already-imported + supplier/category diff only (no price diff)

## Work Log

### 2026-02-25 - Code Review Discovery

**By:** Codex

**Actions:**
- Compared default-action logic across render/effect/count/confirm paths
- Found one fallback path using broader diff predicate than UI

**Learnings:**
- Logic duplication is already causing behavior drift during rapid iteration

## Notes

- Likely low-frequency today, but it will cause hard-to-debug “UI said skip, backend updated” reports.
