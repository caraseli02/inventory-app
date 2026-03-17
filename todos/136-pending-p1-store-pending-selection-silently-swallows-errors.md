---
status: pending
priority: p1
issue_id: "136"
tags: [code-review, whatsapp, error-handling, state-management]
dependencies: []
---

# storePendingProductSelection swallows errors — open checkbox from March 17 solution

## Problem Statement
`lib/whatsapp/conversation-state.ts` `storePendingProductSelection` catches all errors and returns `void` silently. Callers cannot detect failure. This was explicitly flagged as an unresolved risk in the Prevention section of `docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md` (open checkbox). If the DB write fails, the selection state appears persisted but wasn't — downstream state reads return stale/null data, breaking the cart flow.

## Findings
- `lib/whatsapp/conversation-state.ts` lines 209-222:
  ```typescript
  export async function storePendingProductSelection(...): Promise<void> {
    try {
      await (sb as any).from('conversation_history').upsert(...);
    } catch (err) {
      console.warn('[whatsapp] failed to store pending selection:', err);
      // returns void — caller sees success
    }
  }
  ```
- March 17 solution Prevention section: "storePendingProductSelection also swallows errors — if the cart write fails but selection is cleared, state is also corrupted. Consider the same fix there."
- No GitHub issue exists for this item — the checkbox is untracked
- `storePendingOrder` (by contrast) intentionally does NOT swallow errors — asymmetry is undocumented

## Proposed Solutions

### Option A: Re-throw after logging (Recommended for critical writes)
```typescript
} catch (err) {
  console.warn('[whatsapp] failed to store pending selection:', err);
  throw err; // let caller handle
}
```
Callers that treat this as best-effort would need explicit `try/catch` with empty body + comment.
- Effort: Small
- Risk: May surface previously hidden errors as user-facing 500s — requires caller audit

### Option B: Return boolean success indicator
Change return type to `Promise<boolean>`, return `false` on failure. Callers can then decide whether to proceed.
- Effort: Small-Medium (signature change + caller updates)
- More explicit than throwing

### Option C: Document as intentionally best-effort
Add explicit comment, update CLAUDE.md guardrails to note this is best-effort.
- Does not fix the data integrity risk
- Not recommended as standalone fix

**Recommended**: Option A or B. At minimum, Option C as a temporary mitigation while the full fix is planned.

## Technical Details
- Affected file: `lib/whatsapp/conversation-state.ts` lines 209-222
- Related: `docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md`
- Callers to audit: `lib/whatsapp/selection-resolver.ts` (all calls to `storePendingProductSelection`)

## Acceptance Criteria
- [ ] `storePendingProductSelection` failure is surfaced to callers (either throw or boolean)
- [ ] All callers handle the failure case explicitly
- [ ] OR: documented as intentionally best-effort with comment explaining why
- [ ] Open checkbox in March 17 solution doc closed (linked to this issue)

## Work Log
- 2026-03-17: Identified by data-integrity-guardian agent in ce-review; originally flagged in solution doc 20260317
