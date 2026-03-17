---
name: Inline CartItem type import in webhook.ts should be top-level
description: webhook.ts:282 uses inline import() for CartItem type instead of adding it to the existing top-level import from selection-resolver.js
type: pending
priority: p3
issue_id: "128"
tags: [code-quality, typescript, whatsapp]
dependencies: []
---

## Problem Statement

`webhook.ts:282`:

```ts
const cart = (selection?.cart as import('./selection-resolver.js').CartItem[] | undefined) ?? [];
```

`CartItem` is already exported from `selection-resolver.ts`. It should be imported at the top of the file alongside the other imports from that module. Inline type imports in the middle of function bodies are hard to grep and signal a rushed addition.

## Proposed Solution

Add `CartItem` to the existing import at the top of `webhook.ts`:

```ts
import { ..., CartItem } from './selection-resolver.js';
```

Then use `CartItem[]` directly at line 282.

## Technical Details

- **Affected files:** `lib/whatsapp/webhook.ts:282`

## Acceptance Criteria

- [ ] `CartItem` imported at top level in webhook.ts
- [ ] No inline `import()` in function body
- [ ] TypeScript compiles cleanly

## Work Log

- 2026-03-17: Identified by typescript-reviewer review of PR #171
