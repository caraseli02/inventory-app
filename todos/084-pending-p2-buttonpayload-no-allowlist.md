---
status: pending
priority: p2
issue_id: "084"
tags: [code-review, security, whatsapp, validation]
dependencies: []
---

# Add explicit allowlist check for `ButtonPayload` values

## Problem Statement

The button handler enters `if (buttonPayload)` for any non-empty string, but only handles `'confirm'` and `'cancel'`. An unrecognized value silently returns after sending empty TwiML, wasting a Vercel invocation. More importantly, if future code adds another branch (e.g., `'delete_order'`), there is no gate — any `ButtonPayload` value gets in. The missing allowlist is also an implicit API surface that could mask logic errors.

## Findings

- `api/whatsapp.ts:135` — `if (buttonPayload)` gate accepts any non-empty string.
- `api/whatsapp.ts:142` — handles `'confirm'`.
- `api/whatsapp.ts:150` — handles `'cancel'`.
- Unrecognized values: `res.send(twiml(''))` is called at line 137, then the async IIFE completes without sending any message. Customer receives nothing.
- Twilio's sandbox Quick Reply button payloads are set by the content template — so in practice only `'confirm'` and `'cancel'` arrive. But explicit validation is defense-in-depth.

## Proposed Solutions

### Option 1: Allowlist at the gate (Recommended)

```typescript
if (buttonPayload) {
  if (buttonPayload !== 'confirm' && buttonPayload !== 'cancel') {
    console.warn('[whatsapp] unexpected ButtonPayload:', buttonPayload);
    return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(''));
  }
  // ... existing logic
}
```

**Pros:** Explicit; future-proof; unrecognized values logged and dropped cleanly.
**Effort:** Tiny
**Risk:** None

---

### Option 2: Type-narrow `buttonPayload`

**Approach:** Cast or parse `buttonPayload` to `'confirm' | 'cancel' | ''` using a type guard before the if block.

**Pros:** TypeScript-level safety.
**Cons:** Slightly more boilerplate; runtime behavior is the same as option 1.
**Effort:** Tiny
**Risk:** None

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `api/whatsapp.ts:134-175` — button handler block

## Acceptance Criteria

- [ ] Unrecognized `ButtonPayload` values are rejected or logged before async work starts
- [ ] `'confirm'` and `'cancel'` still work correctly
- [ ] `pnpm typecheck` passes

## Work Log

### 2026-03-10 — Found by security-sentinel review agent

## Resources

- **PR:** #156
