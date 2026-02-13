---
status: complete
priority: p3
issue_id: "025"
tags: [code-review, ui, observability, react]
dependencies: []
---

# Quick adjust lock should not warn-spam logs

## Problem Statement

The new quick-adjust concurrency lock logs `warn` whenever a fast double-tap is blocked. This can create noisy logs in normal usage (especially on touch devices) and makes real warnings harder to spot.

## Findings

- `/Users/vladislavcaraseli/.codex/worktrees/0881/inventory-app/src/pages/InventoryListPage.tsx` logs:
  - `logger.warn('Prevented concurrent quick adjust', { productId });`
- Trigger is user-behavioral (double tap), not necessarily a system fault.

## Proposed Solutions

### Option 1: Downgrade to `debug` (recommended)

**Approach:** Change `logger.warn` to `logger.debug` (or remove entirely).

**Pros:**
- Keeps signal for troubleshooting
- Avoids warning noise

**Cons:**
- Might be missed in default log level

**Effort:** 2 minutes

**Risk:** Low

---

### Option 2: Log once per product per session

**Approach:** Track a `Set` of productIds already warned for and only log first occurrence.

**Pros:**
- Keeps warning-level signal without flooding

**Cons:**
- Extra state + complexity for little value

**Effort:** 10-15 minutes

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/.codex/worktrees/0881/inventory-app/src/pages/InventoryListPage.tsx`

## Resources

- Related issue: https://github.com/caraseli02/inventory-app/issues/30

## Acceptance Criteria

- [ ] Preventing a concurrent quick-adjust does not emit `warn` logs repeatedly during normal use
- [ ] Quick-adjust remains concurrency-safe

## Work Log

### 2026-02-13 - Review Finding

**By:** Codex

**Actions:**
- Noted `warn` log on lock-hit in quick-adjust path

### 2026-02-13 - Completed

**By:** Codex

**Actions:**
- Changed lock-hit log level from `warn` to `debug`
- Ran `pnpm test:unit` and `pnpm lint`
