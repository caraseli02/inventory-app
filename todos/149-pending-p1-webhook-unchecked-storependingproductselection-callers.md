---
status: done
priority: p1
issue_id: "149"
tags: [code-review, whatsapp, error-handling, state-management]
dependencies: ["136"]
---

# webhook.ts — 3 unchecked `storePendingProductSelection` callers after PR #173

## Problem Statement

PR #173 fixed 4 callers of `storePendingProductSelection` in `selection-resolver.ts` to abort on `false`. However, 3 callers in `lib/whatsapp/webhook.ts` were missed and still do not check the boolean return. All 3 are state-advancing writes (they move the machine to `awaiting_pickup_time` or `product_list`). If the DB write fails, the user receives a list-picker or prompt with no backing state — any subsequent response finds no `pending_selection` and falls through to the LLM, producing a confused reply.

## Findings

**Line 290** — `handleButtonPayload`, "confirm cart" button path:
```typescript
await storePendingProductSelection(sb, phone, { selection_type: 'awaiting_pickup_time', cart, ... });
await sendRestMessage(from, '🕐 ...');  // sends prompt even if state write failed
```

**Line 349** — `tryTextTemplateInterception`, `choice === 2` path:
```typescript
await storePendingProductSelection(args.sb, args.phone, { selection_type: 'awaiting_pickup_time', cart, ... });
await sendRestMessage(args.from, '🕐 ...');  // sends prompt even if state write failed
```

**Line 457** — `handleRestConversation`, LLM `listPicker` path:
```typescript
await storePendingProductSelection(sb, args.phone, { selection_type: 'product_list', items: result.listPicker, ... });
await sendListPickerTemplate(...);  // sends picker even if state write failed
```

The fix applied in `selection-resolver.ts` (check `stored`, call `sendRestMessage` on `false`) must be applied symmetrically here.

## Proposed Solutions

### Option A: Apply the same guard pattern as selection-resolver.ts (Recommended)
```typescript
const stored = await storePendingProductSelection(sb, phone, { ... });
if (!stored) {
  await sendRestMessage(from, 'A apărut o eroare. Încearcă din nou.');
  return;
}
// proceed with template send
```
- Effort: Small (3 call sites, 4 lines each)
- Risk: None — matches already-approved pattern

### Option B: Extract shared guard helper
Create `assertSelectionStored(stored: boolean, from: string): Promise<void>` that throws on `false`, and wrap the 3 call sites. More DRY but more churn.
- Effort: Medium
- Risk: Low

**Recommended**: Option A — match the existing pattern exactly to avoid inconsistency.

## Technical Details
- Affected file: `lib/whatsapp/webhook.ts` lines 290, 349, 457
- Reference fix: `lib/whatsapp/selection-resolver.ts` (all 4 checks introduced in PR #173)
- This is the same blocker identified in todo 136 but for webhook.ts callers

## Acceptance Criteria
- [ ] Line 290: boolean checked, error message sent and return early on `false`
- [ ] Line 349: boolean checked, error message sent and return early on `false`
- [ ] Line 457: boolean checked, error message sent and return early on `false`
- [ ] Unit test added for at least one of the `false` return paths in webhook.ts
- [ ] `pnpm vitest run tests/unit/whatsappAgent.test.ts tests/integration/whatsapp-agent.test.ts` — all pass

## Work Log
- 2026-03-17: Found by kieran-typescript-reviewer agent in ce-review of PR #173; confirmed by manual grep of webhook.ts
