---
name: sendListPickerTemplate discards boolean return — callers can't detect list-picker send failures
description: transport.ts changed sendTemplateMessage to return boolean, but sendListPickerTemplate uses await (not return), so list-picker failures are silently swallowed
type: pending
priority: p2
issue_id: "120"
tags: [whatsapp, typescript, error-handling, transport]
dependencies: []
---

## Problem Statement

`transport.ts:92` — the PR correctly changed `sendTemplateMessage` to return `Promise<boolean>`. But `sendListPickerTemplate` was updated to `await sendTemplateMessage(...)` without capturing the return value, meaning all callers of `sendListPickerTemplate` silently swallow failures. There is no text fallback path for list-picker send failures.

`handleProductSelected` at `selection-resolver.ts:134` correctly checks the boolean, but `handleCategorySelected` (line 104), `sendCategoryPicker` (line 179), and two webhook.ts call sites (lines 180, 461) have no failure detection.

## Findings

- `transport.ts:92` — `await sendTemplateMessage(...)` — return value discarded
- `selection-resolver.ts:103–107` — `sendListPickerTemplate` called, no fallback if it fails
- `selection-resolver.ts:178–182` — same issue in `sendCategoryPicker`

## Proposed Solutions

### Option A — Return boolean from sendListPickerTemplate and add text fallbacks (Recommended)
Change signature to `Promise<boolean>`, return the value from `sendTemplateMessage`. Add text fallback in `handleCategorySelected` and `sendCategoryPicker` mirroring the `handleProductSelected` pattern.

**Pros:** Consistent failure handling across all template send paths
**Cons:** Requires fallback message copy for category/product lists
**Effort:** Small
**Risk:** Low

### Option B — Log warning only, don't add text fallback
Just capture and log the boolean without adding fallbacks.

**Pros:** Minimal change
**Cons:** Users still get silence on failure
**Effort:** Minimal
**Risk:** None (status quo)

## Recommended Action

Option A. The text-fallback pattern is already established in `handleProductSelected` — apply it consistently.

## Technical Details

- **Affected files:** `lib/whatsapp/transport.ts:92`, `lib/whatsapp/selection-resolver.ts:103–107, 178–182`

## Acceptance Criteria

- [ ] `sendListPickerTemplate` returns `Promise<boolean>`
- [ ] `handleCategorySelected` and `sendCategoryPicker` fall back to text if template fails
- [ ] Test: `sendListPickerTemplate` returning false triggers text fallback

## Work Log

- 2026-03-17: Identified by typescript-reviewer review of PR #171
