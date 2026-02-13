---
status: complete
priority: p2
issue_id: "025"
tags: [code-review, invoice-ocr, frontend, reliability]
dependencies: []
---

# Use Safe Progress Wrapper For XHR Upload Callbacks

The invoice OCR client defines a `safeProgress()` wrapper to guard against exceptions from the UI progress callback, but the XHR upload path still calls the raw callback directly.

## Problem Statement

Progress callbacks are invoked from XHR event handlers. If the callback throws (or gets replaced with something that can throw), it can cause unpredictable behavior during uploads and undermine the purpose of `safeProgress()`.

## Findings

- `src/lib/invoiceOCR.ts:281-291` defines `safeProgress()`.
- `src/lib/invoiceOCR.ts:206-216` calls `onProgress?.(...)` directly inside XHR progress handlers.
- `src/lib/invoiceOCR.ts:381` passes the raw `onProgress` to `uploadWithProgress(...)` instead of `safeProgress`.

## Proposed Solutions

### Option 1: Pass `safeProgress` Into `uploadWithProgress` (Recommended)

**Approach:** Pass `safeProgress` to `uploadWithProgress(...)` and use that function for all progress updates inside the XHR helper.

**Pros:**
- Matches the intent of the existing wrapper.
- Prevents unexpected exceptions from breaking upload flow.
- Minimal code change.

**Cons:**
- Slight indirection (progress behavior is now always guarded).

**Effort:** 10-15 minutes

**Risk:** Low

---

### Option 2: Wrap Internally In `uploadWithProgress`

**Approach:** Keep passing `onProgress`, but wrap calls inside `uploadWithProgress` with `try/catch`.

**Pros:**
- Protects progress path without changing call sites.

**Cons:**
- Duplicates logic; now there are two "safe progress" implementations.

**Effort:** 10-15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/lib/invoiceOCR.ts`

## Resources

- Related: `docs/solutions/performance-issues/invoice-ocr-timeout-and-progress-tracking.md`

## Acceptance Criteria

- [ ] All progress updates in XHR upload path are guarded against callback exceptions.
- [ ] Unit tests still pass (`pnpm test:unit`).

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Codex

**Actions:**
- Noted mismatch between `safeProgress()` definition and raw callback usage in XHR upload helper.

**Learnings:**
- The helper path is still calling `onProgress` directly from event handlers.

---

### 2026-02-13 - Fix Implemented

**By:** Codex

**Actions:**
- Updated `extractInvoiceData()` to pass `safeProgress` into `uploadWithProgress()` so XHR event callbacks are guarded too.
- Ran `pnpm lint` and `pnpm test:unit` (pass).

**Learnings:**
- Guarding the callback at the boundary (XHR helper) keeps behavior stable even if UI code changes.
