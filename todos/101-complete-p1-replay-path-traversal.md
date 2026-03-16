---
status: pending
priority: p1
issue_id: "101"
tags: [code-review, security, path-traversal, whatsapp]
dependencies: ["100"]
---

## Problem Statement

`replayId` is taken directly from the `x-whatsapp-replay-id` request header and interpolated into a filesystem path in `lib/whatsapp/replay-context.ts` without any sanitization:

```typescript
path.join(getReplayDir(), `${replayId}.jsonl`)
```

`path.join` does not neutralise `..` segments. A crafted header value such as `../../../etc/cron.d/malicious` resolves to an arbitrary path outside the intended replay directory. If the process has write permission (common in local dev and some serverless environments), this is an arbitrary file-write vulnerability. On read-only filesystems the impact is directory traversal for reads (information disclosure). The attack surface is directly reachable via the public webhook URL analysed in #100.

## Findings

- `replayId` is user-controlled input (HTTP header) with no validation before filesystem use.
- `path.join` normalises segments but does not prevent traversal: `path.join('/app/replays', '../../../etc/passwd')` resolves to `/etc/passwd`.
- The only existing guard is that the replay bypass is gated on the header being present — but #100 shows this gate has no production restriction.
- Serverless write targets include `/tmp` (writable on AWS Lambda, Vercel Edge); on traditional VMs the process may have broader write access.
- Even in read-only production environments, the path is used in a `fs.readFileSync` call, enabling reads of arbitrary `.jsonl`-suffixed files (or files with no extension if the suffix is stripped) relative to the traversal target.

## Proposed Solutions

### Option 1: Validate and allowlist `replayId` format with a strict regex
Reject any `replayId` that does not match a safe pattern before constructing the path:

```typescript
const SAFE_REPLAY_ID = /^[a-zA-Z0-9_-]{1,128}$/;
if (!SAFE_REPLAY_ID.test(replayId)) {
  throw new Error(`Invalid replay ID: ${replayId}`);
}
const replayPath = path.join(getReplayDir(), `${replayId}.jsonl`);
```

**Pros:** Simple, zero dependencies, fails closed on unexpected input, easy to understand and audit.
**Cons:** Must be applied at every call site that uses `replayId` in a path; easy to miss future usages.
**Effort:** Small
**Risk:** Low

### Option 2: Resolve path and assert it stays within the replay directory
After joining, resolve the absolute path and verify it starts with the replay directory prefix:

```typescript
const replayDir = path.resolve(getReplayDir());
const replayPath = path.resolve(replayDir, `${replayId}.jsonl`);
if (!replayPath.startsWith(replayDir + path.sep)) {
  throw new Error('Path traversal detected');
}
```

**Pros:** Defence-in-depth; catches traversal even if the regex is too permissive or bypassed. Works alongside Option 1.
**Cons:** Slightly more complex; `path.resolve` behaviour differs on Windows (path separator). Not a standalone fix — should be combined with Option 1.
**Effort:** Small
**Risk:** Low

### Option 3: Never accept `replayId` from HTTP headers in production; use a signed token
Require replay sessions to be initiated by a server-side process that issues a short-lived signed token (HMAC or JWT). The token encodes the intended replay fixture name. The webhook only accepts the token, never a raw filename.

**Pros:** Eliminates the entire class of header-injection attacks; tokens can encode expiry and scope.
**Cons:** Significant refactor of replay tooling; overkill for a dev-only feature if #100 is also fixed to block the header in production.
**Effort:** Large
**Risk:** Low (for security), Medium (for delivery)

## Recommended Action
(leave blank)

## Technical Details
- Affected files: `lib/whatsapp/replay-context.ts`
- Components: replay context loader, `getReplayDir`, path construction logic

## Acceptance Criteria
- [ ] A `replayId` value containing `..` or `/` is rejected before any filesystem operation
- [ ] The resolved file path is confirmed to be within the intended replay directory before open/read/write
- [ ] Unit test covers traversal attempts: `../secret`, `../../etc/passwd`, `foo/../../bar`
- [ ] No legitimate replay fixture names are rejected by the new validation
- [ ] Fix is applied at all call sites in `replay-context.ts` that construct paths from `replayId`

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
