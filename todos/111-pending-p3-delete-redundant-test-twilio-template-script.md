---
status: pending
priority: p3
issue_id: "111"
tags: [code-review, cleanup, quality]
dependencies: []
---

## Problem Statement
`scripts/test-twilio-template.ts` is a 168-line diagnostic script that overlaps heavily with `scripts/test-twilio-full-flow.ts`. Keeping it creates maintenance overhead and confusion about which script to run.

## Findings
- `scripts/test-twilio-template.ts` (168 lines):
  - Creates dynamic Content resources with the same payload shape as `test-twilio-full-flow.ts`
  - Sends messages via the same Twilio Messages API
  - Covers the same test scenarios
  - Contains a dead-code `findAccountSid()` function that is never called
- `scripts/test-twilio-full-flow.ts` covers all the same ground and is the more complete, up-to-date script
- ~80% duplication between the two files

## Proposed Solutions

### Option 1: Delete scripts/test-twilio-template.ts
Remove the file entirely. Any unique functionality it provides (if any) should be verified first and migrated to `test-twilio-full-flow.ts` before deletion.

**Pros:** Eliminates dead code and maintenance confusion; cleaner scripts directory.
**Cons:** Requires a quick audit to confirm nothing unique would be lost.
**Effort:** Small
**Risk:** Low

### Option 2: Keep but clearly mark as deprecated
Add a deprecation notice at the top of the file pointing to `test-twilio-full-flow.ts`.

**Pros:** Non-destructive.
**Cons:** Does not actually remove the duplication or dead code.
**Effort:** Small
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files:
  - `scripts/test-twilio-template.ts` (candidate for deletion)
  - `scripts/test-twilio-full-flow.ts` (the authoritative script)
- Dead code in `test-twilio-template.ts`: `findAccountSid()` function

## Acceptance Criteria
- [ ] `scripts/test-twilio-template.ts` is deleted (or explicitly superseded with a clear notice)
- [ ] Any unique functionality has been migrated to `test-twilio-full-flow.ts` before removal
- [ ] No references to the deleted script remain in package.json, CI config, or docs

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
