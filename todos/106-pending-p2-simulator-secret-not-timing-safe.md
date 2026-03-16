---
status: pending
priority: p2
issue_id: "106"
tags: [code-review, security]
dependencies: []
---

## Problem Statement

The WhatsApp simulator endpoint in `vite.config.ts` compares the `x-notify-secret` header using JavaScript's `!==` operator. String equality comparisons are not constant-time, meaning an attacker can use a timing oracle to recover the secret byte-by-byte. The production webhook already uses `crypto.timingSafeEqual()` for Twilio signature verification — the simulator should follow the same pattern.

## Findings

In `vite.config.ts` (the Vite dev-server middleware for the local simulator), the secret check reads approximately:

```ts
if (req.headers['x-notify-secret'] !== process.env.WHATSAPP_NOTIFY_SECRET) {
  res.statusCode = 401;
  return res.end('Unauthorized');
}
```

`!==` on strings in V8 short-circuits on the first differing byte, leaking timing information proportional to the length of the matching prefix.

By contrast, `api/lib/twilio-signature.ts` already uses:

```ts
crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
```

This inconsistency means the simulator's secret is weaker to attack than the production secret, which matters when the simulator is exposed over a shared network (e.g., ngrok tunnel during demos or CI).

## Proposed Solutions

### Option 1: Extract a shared `timingSafeStringEqual` utility and use it in both places
Create `lib/timing-safe-equal.ts`:

```ts
import { timingSafeEqual } from 'crypto';

export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Buffers must be same length for timingSafeEqual
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
```

Replace the `!==` comparison in `vite.config.ts` with `!timingSafeStringEqual(...)`.

**Pros:** Consistent security posture across all secret comparisons; reusable; easy to test.
**Cons:** Adds a small utility file.
**Effort:** Small
**Risk:** Low

### Option 2: Inline `crypto.timingSafeEqual` directly in `vite.config.ts`
Mirror the pattern from `api/lib/twilio-signature.ts` without extracting a helper.

**Pros:** No new file; minimal diff.
**Cons:** Duplicates logic; length-mismatch edge case must be handled separately in each location.
**Effort:** Small
**Risk:** Low

### Option 3: Accept the risk for the simulator only (document it)
Add a comment explaining the timing risk is acceptable because the simulator is dev-only and never exposed without an explicit tunnel.

**Pros:** Zero code change.
**Cons:** The assumption (dev-only) is not enforced; tunnels are common in this project; inconsistency with production patterns is confusing.
**Effort:** Trivial
**Risk:** Medium (relies on operational discipline)

## Recommended Action
(leave blank)

## Technical Details
- Affected files: `vite.config.ts` (simulator middleware), `api/lib/twilio-signature.ts` (reference implementation)
- Pattern to match: `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`

## Acceptance Criteria
- [ ] `x-notify-secret` comparison in `vite.config.ts` uses a constant-time comparison
- [ ] Length-mismatch case returns `false` without leaking length information
- [ ] The same utility or pattern is used wherever shared secrets are compared in the codebase
- [ ] A unit test covers both matching and non-matching inputs

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
