---
name: isSelectionExpired treats invalid/corrupt timestamps as valid (not expired)
description: selection-resolver.ts:39 returns false (not expired) for corrupt created_at values — safer to expire invalid state than to act on it
type: pending
priority: p3
issue_id: "127"
tags: [whatsapp, state-machine, defensive-coding]
dependencies: []
---

## Problem Statement

`selection-resolver.ts:36–41`:

```ts
function isSelectionExpired(selection: Record<string, unknown> | null): boolean {
  if (!selection?.created_at) return false; // no timestamp = legacy, treat as valid
  const createdAt = new Date(String(selection.created_at)).getTime();
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false;  // corrupt = treat as valid
  return Date.now() - createdAt > PENDING_SELECTION_TTL_MS;
}
```

Line 39 returns `false` (not expired) when `created_at` is present but unparseable. This biases toward accepting potentially corrupt state. It is safer to expire an invalid selection than to act on it.

## Proposed Solution

```ts
if (!Number.isFinite(createdAt) || createdAt <= 0) return true;  // corrupt = treat as expired
```

The "legacy" case (no `created_at` at all) is already handled by the first guard returning `false` — that intent is preserved.

## Technical Details

- **Affected files:** `lib/whatsapp/selection-resolver.ts:39`

## Acceptance Criteria

- [ ] Corrupt `created_at` values treated as expired
- [ ] Missing `created_at` still treated as valid (legacy behavior preserved)
- [ ] Unit test: `{ created_at: 'not-a-date' }` returns expired

## Work Log

- 2026-03-17: Identified by architecture-strategist review of PR #171
