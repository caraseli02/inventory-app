---
status: pending
priority: p2
issue_id: "108"
tags: [code-review, quality, duplication]
dependencies: []
---

## Problem Statement
The maximum list-item title length limit (24 characters) is duplicated as both a named constant and as re-implemented manual truncation logic. If the limit changes in Twilio's API, the test script will silently use a stale value.

## Findings
- `lib/whatsapp/transport.ts` line 64: defines `MAX_LIST_ITEM_TITLE_LEN = 24`
- `scripts/test-twilio-full-flow.ts` line 42: re-implements the same value (including manual truncation logic) without importing from `transport.ts`

The test script duplicates knowledge that already lives in the transport layer.

## Proposed Solutions

### Option 1: Export constant from transport.ts and import in test script
Export `MAX_LIST_ITEM_TITLE_LEN` from `lib/whatsapp/transport.ts` and replace the hard-coded value + truncation logic in the test script with an import.

**Pros:** Single authoritative source; test script stays in sync automatically.
**Cons:** Test script gains a runtime dependency on a lib module (acceptable for a dev script).
**Effort:** Small
**Risk:** Low

### Option 2: Move constant to a shared constants file
Extract to `lib/whatsapp/constants.ts`, import from both `transport.ts` and the test script.

**Pros:** Neutral home with no awkward coupling direction.
**Cons:** Adds a new file; slight overkill if only one constant needs sharing.
**Effort:** Small
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files:
  - `lib/whatsapp/transport.ts` (line 64)
  - `scripts/test-twilio-full-flow.ts` (line 42)

## Acceptance Criteria
- [ ] `MAX_LIST_ITEM_TITLE_LEN` is defined in exactly one place
- [ ] `scripts/test-twilio-full-flow.ts` imports the constant rather than re-defining it
- [ ] Truncation logic in the test script uses the imported constant
- [ ] No behavior change to production code

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
