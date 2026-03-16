---
status: pending
priority: p3
issue_id: "110"
tags: [code-review, testing, whatsapp]
dependencies: []
---

## Problem Statement
`tryTextTemplateInterception` is the new orchestration entry point that routes incoming free-text messages to template flows. Its three routing branches are untested at the webhook level, leaving regressions in the routing logic undetected even when the underlying resolver tests pass.

## Findings
- `lib/whatsapp/webhook.ts` lines 286-342: `tryTextTemplateInterception` contains three interception paths:
  1. Browse/product search text → list-picker template
  2. Numeric input → selection resolution
  3. Category-name text → category resolution
- 26 unit tests exist for `selection-resolver.ts` covering the underlying logic
- No dedicated unit or integration tests cover the routing in `tryTextTemplateInterception` itself — e.g. that the correct path is taken for each message shape, that the function returns `false` when no path matches, or that an unrecognized input falls through cleanly

## Proposed Solutions

### Option 1: Add unit tests for tryTextTemplateInterception
Mock the dependencies (`resolveSelection`, `resolveCategory`, `resolveProductBrowse`) and assert that each interception path is triggered for the appropriate input shapes. Also assert the `false` / fall-through return for non-matching input.

**Pros:** Fast, isolated, directly tests the routing logic.
**Cons:** Requires mocking internal dependencies; test setup is slightly involved.
**Effort:** Medium
**Risk:** Low

### Option 2: Add integration-level webhook tests for each interception path
Drive the full webhook handler with fixture payloads and assert on reply messages or side effects.

**Pros:** Higher confidence; tests the full stack including template rendering.
**Cons:** Slower; more brittle to unrelated changes.
**Effort:** Medium
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files:
  - `lib/whatsapp/webhook.ts` (lines 286-342, `tryTextTemplateInterception`)
  - Relevant test file to create or extend: `tests/unit/lib/whatsapp-webhook.test.ts` (or similar)

## Acceptance Criteria
- [ ] At least one test per interception branch (browse, numeric, category-name)
- [ ] At least one test for the fall-through (non-matching input returns `false`)
- [ ] Tests live in the unit or integration test suite and run in CI

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
