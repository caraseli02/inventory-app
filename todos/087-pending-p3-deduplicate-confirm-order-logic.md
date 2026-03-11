---
status: pending
priority: p3
issue_id: "087"
tags: [code-review, quality, whatsapp, refactor]
dependencies: ["078"]
---

# Extract shared `handleConfirmOrder` helper to deduplicate button + DA/NU confirm logic

## Problem Statement

The button-tap confirm path (inside `waitUntil`, lines 141–149) and the DA text confirm path (lines 201–214) both do the same thing: call `getPendingOrder` → call `createPendingOrderFromPending` → send a REST or TwiML confirmation message. The logic is copy-pasted with slightly different structure. If the confirm message changes or error handling evolves, both branches must be updated in sync — a maintenance risk.

## Findings

- `api/whatsapp.ts:141-149` — button confirm: `getPendingOrder → createPendingOrderFromPending → sendRestMessage`.
- `api/whatsapp.ts:201-214` — DA text confirm: same sequence, plus `canUseRest` branching for TwiML fallback.
- The confirmation message string `✅ Cererea ${orderNumber} a fost înregistrată și așteaptă confirmarea magazinului.` is duplicated at lines 149 and 208.
- `⚠️ Comanda a expirat. Te rog trimite din nou.` is in the button path (line 145) but not in the DA path (DA path skips to LLM handling if no pending order — different but arguably should show the same expiry message).

## Proposed Solutions

### Option 1: Extract `handleConfirmOrder(sb, phone, from)` returning a reply string

```typescript
async function handleConfirmOrder(
  sb: ReturnType<typeof createClient>,
  phone: string,
  from: string,
): Promise<string> {
  const pending = await getPendingOrder(sb, phone);
  if (!pending) return '⚠️ Comanda a expirat. Te rog trimite din nou.';
  const orderNumber = await createPendingOrderFromPending(sb, pending);
  return `✅ Cererea ${orderNumber} a fost înregistrată și așteaptă confirmarea magazinului.`;
}
```

Both call sites call this, then route the reply via REST or TwiML based on `canUseRest`.

**Pros:** Single source for confirm logic; confirmation message string in one place; error handling unified.
**Cons:** Slight restructuring of button handler's `waitUntil` async block.
**Effort:** Small
**Risk:** Low

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `api/whatsapp.ts:135-175` — button handler
- `api/whatsapp.ts:186-226` — DA/NU handler

## Acceptance Criteria

- [ ] Confirm-order logic extracted into a shared helper
- [ ] Button path and DA text path both use the helper
- [ ] Confirmation message string appears only once
- [ ] `pnpm typecheck` passes
- [ ] No behavior change

## Work Log

### 2026-03-10 — Found by code-simplicity-reviewer

## Resources

- **PR:** #156
- **Related:** todo 078 (atomic RPC — implement first, then this cleanup is cleaner)
