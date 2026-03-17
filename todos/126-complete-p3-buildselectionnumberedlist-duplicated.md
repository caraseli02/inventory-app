---
name: buildNumberedList duplicated in webhook.ts and selection-resolver.ts
description: Identical one-liner exists in both files; format divergence would silently break button-to-text fallback parity
type: pending
priority: p3
issue_id: "126"
tags: [code-quality, whatsapp, duplication]
dependencies: []
---

## Problem Statement

`selection-resolver.ts:28–30` and `webhook.ts:147–149` both define:

```ts
function buildNumberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}) ${item}`).join('\n');
}
```

If the format ever diverges (different separator, different numbering), the text fallback for button flows will produce inconsistent output. The function is private in both files, so the duplication is invisible to callers.

## Proposed Solution

Export `buildNumberedList` from `selection-resolver.ts` and import it in `webhook.ts`. Remove the duplicate.

## Technical Details

- **Affected files:** `lib/whatsapp/selection-resolver.ts:28–30`, `lib/whatsapp/webhook.ts:147–149`

## Acceptance Criteria

- [ ] Single definition of `buildNumberedList`
- [ ] webhook.ts imports from selection-resolver.ts
- [ ] No behavior change

## Work Log

- 2026-03-17: Identified by architecture-strategist review of PR #171
