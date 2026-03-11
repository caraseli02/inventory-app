---
status: complete
priority: p2
issue_id: "076"
tags: [code-review, tests, whatsapp, ci]
dependencies: []
---

# Update webhook tests for the new acknowledgment behavior

## Problem Statement

The branch changes the first-message acknowledgment copy from the previous `⏳ Am primit...` / `⏳ Got it...` wording to `Bună ziua, procesăm...` / `Hello, processing your message...`, but the unit tests still assert the old strings.

As a result, the unit suite currently fails, so the branch is not merge-ready.

## Findings

- `api/whatsapp.ts:267-275` now returns new first-message acknowledgment strings.
- `tests/unit/api/whatsapp-webhook.test.ts:207`, `:258`, `:311`, and `:325` still assert the old copy and emoji.
- Running `pnpm test:unit -- --run tests/unit/api/whatsapp-webhook.test.ts` on 2026-03-10 fails with 4 assertion failures in that file.
- The PR body claims unit tests are passing, so the branch and its review artifacts are out of sync.

## Proposed Solutions

### Option 1: Update tests to assert the new copy

**Approach:** Change the expectations in `tests/unit/api/whatsapp-webhook.test.ts` to match the new acknowledgment behavior.

**Pros:**
- Smallest change
- Makes the test suite green if the new copy is intentional

**Cons:**
- Locks tests to exact phrasing again

**Effort:** Small

**Risk:** Low

---

### Option 2: Assert behavior, not exact wording

**Approach:** Keep one narrow copy test if needed, but otherwise assert that an XML message is returned for first-contact requests and empty TwiML is returned for returning customers.

**Pros:**
- Less brittle
- Better reflects the behavioral contract

**Cons:**
- Requires a slightly broader test refactor

**Effort:** Small-Medium

**Risk:** Low

## Recommended Action

Implemented Option 1. The webhook unit tests now match the current acknowledgment copy and the targeted unit suite passes again.

## Technical Details

**Affected files:**
- `api/whatsapp.ts:267`
- `tests/unit/api/whatsapp-webhook.test.ts:193`

## Resources

- **PR:** #156
- **Command:** `pnpm test:unit -- --run tests/unit/api/whatsapp-webhook.test.ts`

## Acceptance Criteria

- [x] `tests/unit/api/whatsapp-webhook.test.ts` matches the intended acknowledgment behavior
- [x] The targeted unit test file passes locally
- [x] The PR body/test plan is updated if behavior changed intentionally

## Work Log

### 2026-03-10 - Review finding

**By:** Codex

**Actions:**
- Ran the targeted unit suite for the WhatsApp webhook tests
- Confirmed 4 failures caused by outdated expectations after the ack-copy change
- Recorded the exact failing assertions for follow-up

**Learnings:**
- This is a straightforward test drift issue, but it currently blocks confidence in the branch’s “tests passing” claim

### 2026-03-10 - Fix implemented

**By:** Codex

**Actions:**
- Updated the acknowledgment assertions in `tests/unit/api/whatsapp-webhook.test.ts`
- Re-ran the targeted WhatsApp unit tests
- Re-ran repository typecheck to confirm the fixes did not introduce TS regressions

**Learnings:**
- These tests were over-coupled to exact copy; they are now aligned with the current behavior, though broader behavioral assertions would still be less brittle long-term
