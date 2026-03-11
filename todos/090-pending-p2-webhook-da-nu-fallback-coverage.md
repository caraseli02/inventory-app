---
status: pending
priority: p2
issue_id: "090"
tags: [code-review, testing, whatsapp, webhook]
dependencies: []
---

# Add real webhook coverage for typed DA/NU and YES/NO fallback

The WhatsApp refactor plan treats typed `DA/NU` and `YES/NO` confirmation/cancellation in the real webhook as a required pre-Phase-2 seam, but the Phase 2 changes still do not add that route-level coverage. This leaves a critical transactional branch unguarded while further extraction is planned.

## Problem Statement

The real `POST /api/whatsapp` handler has a dedicated branch for typed confirmation/cancellation when a pending order exists, but the new Phase 2 test additions only cover the extracted state module and the button-payload path. If a later refactor changes the pending-order read/clear flow, reply mode, or REST/TwiML fallback behavior for typed `DA/NU` / `YES/NO`, current tests will not catch it.

## Findings

- The plan’s test gate explicitly requires webhook-route coverage for typed `DA/NU` or `YES/NO` fallback before deeper splitting: [2026-03-11-refactor-whatsapp-module-split-plan.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md)
- The production branch still exists in [whatsapp.ts](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts#L163) through [whatsapp.ts](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts#L205), where typed text confirmation/cancellation reads and clears pending state and chooses REST vs TwiML response handling.
- The new tests in [whatsapp-conversation-state.test.ts](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-conversation-state.test.ts) validate state helpers in isolation, not the route branch.
- A search of the touched webhook and integration suites does not show direct assertions for typed `DA`, `NU`, `YES`, or `NO` in the real webhook path.

## Proposed Solutions

### Option 1: Add focused webhook unit tests for typed fallback

**Approach:** Extend [whatsapp-webhook.test.ts](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts) with cases for `DA`, `NU`, `YES`, and `NO` when `pending_order` exists and when it does not.

**Pros:**
- Covers the exact branch that Phase 3+ refactors will keep touching
- Fast and deterministic
- Validates both pending-order clearing and response mode

**Cons:**
- Still relies on route-level mocks
- Duplicates some helper expectations already covered elsewhere

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Add a higher-level integration test through the webhook contract

**Approach:** Add a signed-request integration-style test that posts real Twilio form data into the webhook and asserts typed fallback behavior end to end.

**Pros:**
- Covers signature validation plus route behavior together
- Better regression protection for future splits

**Cons:**
- More setup and mocking complexity
- Slower than focused unit coverage

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 3: Do both unit and one signed-request integration case

**Approach:** Add focused webhook unit tests for the decision matrix plus one integration test for a representative typed confirm flow.

**Pros:**
- Best confidence for future module extraction
- Aligns with the plan’s stated gate

**Cons:**
- Highest effort
- More maintenance surface

**Effort:** 3-5 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- [whatsapp.ts](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts)
- [whatsapp-webhook.test.ts](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-webhook.test.ts)
- [2026-03-11-refactor-whatsapp-module-split-plan.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md)

**Related components:**
- Pending order retrieval/clearing in [conversation-state.ts](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/conversation-state.ts)
- Twilio REST/TwiML response selection in [whatsapp.ts](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts)

**Database changes:**
- No

## Resources

- Current review target: uncommitted Phase 2 WhatsApp refactor changes on `main`
- Plan gate: [2026-03-11-refactor-whatsapp-module-split-plan.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md)

## Acceptance Criteria

- [ ] Real webhook tests cover typed `DA` confirm with existing pending order
- [ ] Real webhook tests cover typed `NU` cancel with existing pending order
- [ ] Real webhook tests cover English `YES` / `NO` fallback or explicitly document why unsupported
- [ ] Tests assert response mode selection (`sendRestMessage` vs TwiML) for typed fallback
- [ ] Tests assert pending-order clearing semantics for typed fallback

## Work Log

### 2026-03-11 - Review finding created

**By:** Codex

**Actions:**
- Reviewed the Phase 2 diff for WhatsApp state extraction
- Compared the plan’s stated pre-Phase-2 test gate with the actual added tests
- Searched webhook and integration suites for typed fallback coverage
- Documented the missing route-level regression coverage as a pending todo

**Learnings:**
- The state extraction itself is clean, but the transactional typed fallback branch remains protected only indirectly
- Future Phase 3/4 extraction work will benefit from a direct webhook seam test here

## Notes

- This is a testing gap and merge-risk, not a proven production bug in the current diff.
