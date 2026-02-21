---
status: pending
priority: p3
issue_id: "052"
tags: [security, mcp, code-review]
dependencies: ["042"]
---

# Bearer token comparison uses non-constant-time equality — timing attack vector

## Problem Statement

`auth !== \`Bearer ${SECRET}\`` uses JavaScript string equality, which is not constant-time. An attacker with measurement capability can recover `MCP_SECRET` byte-by-byte via response timing differences (shorter mismatch = faster short-circuit). This is a known attack class against secret comparison.

## Findings

**Location:** `mcp/main.ts:28`

```typescript
if (auth !== `Bearer ${SECRET}`) {
```

## Proposed Solutions

### Solution 1: Use crypto.timingSafeEqual (Recommended)
```typescript
import crypto from 'node:crypto';

function isValidBearer(auth: string | undefined, secret: string): boolean {
  if (!auth) return false;
  const provided = Buffer.from(auth);
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}
```
**Effort:** Small. **Standard practice** for secret comparison in Node.js.

## Recommended Action

Solution 1 — straightforward security hardening. Lower priority than #042 and #043 since timing attacks require local network measurement capability.

## Acceptance Criteria

- [ ] `crypto.timingSafeEqual` used for bearer token comparison
- [ ] Length check before `timingSafeEqual` call

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Security Sentinel Agent)

## Technical Details

**Affected Files:**
- `mcp/main.ts:28`
