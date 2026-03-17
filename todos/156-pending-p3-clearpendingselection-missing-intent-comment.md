---
status: pending
priority: p3
issue_id: "156"
tags: [code-review, whatsapp, documentation]
dependencies: ["155"]
---

# `clearPendingSelection` should have a comment explaining best-effort intent

## Problem Statement

`clearPendingSelection` calls `storePendingProductSelection(sb, phone, {})` and discards the boolean. After PR #173 added boolean checks to every other caller, this site looks like an oversight. A future developer may add an abort guard, breaking the design intent that clearing is best-effort (TTL handles recovery). A one-line comment prevents this.

## Proposed Solution

```typescript
export async function clearPendingSelection(
  sb: ServerSupabaseClient,
  phone: string,
): Promise<void> {
  // Best-effort: if this write fails, TTL (30 min) will expire the stale selection.
  // Do not abort or throw on failure — clearing is not transactional.
  await storePendingProductSelection(sb, phone, {});
}
```

- Effort: Tiny

## Acceptance Criteria
- [ ] Comment at `clearPendingSelection` explains best-effort intent and TTL recovery
- [ ] No logic changes

## Work Log
- 2026-03-17: Found by kieran-typescript-reviewer agent in ce-review of PR #173
