---
status: pending
priority: p3
issue_id: "091"
tags: [code-review, quality, tests, whatsapp]
dependencies: []
---

# Add direct tests for extracted WhatsApp orchestration modules

## Problem Statement

Phase 4 extracted prompt-building, LLM orchestration, and simulator composition into dedicated modules, but the new modules are still covered only indirectly through route-level and integration tests. That makes the split safer structurally, yet leaves the new seams under-specified if a later refactor changes provider fallback, prompt assembly, or local simulator behavior without changing the route contract.

## Findings

- `lib/whatsapp/prompts.ts` now owns the system prompt, but there is no direct unit test asserting the expected sections and interpolation boundaries.
- `lib/whatsapp/llm.ts` now owns `runConversationTurn()`, Anthropic retry/fallback wiring, and simulator provider helpers, but current tests reach this logic only through `api/whatsapp.ts` or integration flows.
- `lib/whatsapp/simulator.ts` now owns simulator fallback selection and direct `ORDER:` handling, but there is no direct unit coverage for its provider selection branches.
- Existing suites still pass, so this is not a behavior regression today; it is a maintainability/testing gap introduced by the extraction.

## Proposed Solutions

### Option 1: Add focused module-level unit tests (Recommended)

**Approach:** Add new unit suites for `prompts.ts`, `llm.ts`, and `simulator.ts` with mocked DB/provider boundaries.

**Pros:**
- Covers the new ownership seams directly
- Keeps future refactors from relying on route tests alone
- Fast, deterministic feedback

**Cons:**
- Requires some mocking of provider and Supabase dependencies
- Adds a bit more test maintenance

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Rely on existing route/integration coverage

**Approach:** Do nothing and trust current webhook/simulator/integration tests.

**Pros:**
- No additional work now
- Avoids more mocks

**Cons:**
- New module seams stay unguarded
- Failures will be harder to localize

**Effort:** None

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `lib/whatsapp/prompts.ts`
- `lib/whatsapp/llm.ts`
- `lib/whatsapp/simulator.ts`
- `tests/unit/api/whatsapp-webhook.test.ts`
- `tests/unit/api/whatsapp-simulate.test.ts`

## Resources

- **Plan:** `docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md`
- **Related todo:** `todos/086-pending-p3-duplicate-normalize-functions-and-dead-code.md`

## Acceptance Criteria

- [ ] Add direct unit tests for `buildSystemPrompt()`
- [ ] Add direct unit tests for `runConversationTurn()` or its exported provider entrypoints
- [ ] Add direct unit tests for `buildSimulatorReply()` provider selection and `buildLocalSimulationReply()` `ORDER:` parsing path
- [ ] Existing WhatsApp route/integration suites still pass
- [ ] `pnpm typecheck` passes

## Work Log

### 2026-03-11 - Review follow-up

**By:** Codex

**Actions:**
- Reviewed Phase 4 extraction for `prompts.ts`, `llm.ts`, and `simulator.ts`
- Verified current validation still relies on route-level and integration coverage
- Logged direct-module test coverage as a non-blocking follow-up

**Learnings:**
- The refactor preserved existing behavior
- The main remaining gap is test locality, not runtime correctness
