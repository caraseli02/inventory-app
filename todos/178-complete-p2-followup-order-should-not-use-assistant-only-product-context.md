---
status: complete
priority: p2
issue_id: "178"
tags: [code-review, whatsapp, state-machine, correctness]
dependencies: []
---

# Guard follow-up ORDER creation against assistant-only product context

## Problem Statement

After moving inventory lookups out of system prompts for non-local providers, `maybeHandleOrderFollowup()` can now proceed using `recent assistant product mentions` even when `inventoryText` is empty. In the single-candidate case, this can create an `ORDER:` without the user ever re-stating/selecting the product on the current turn.

## Findings

- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation.ts:309` now allows followup flow with `inventoryText` empty when `recentNames.length > 0`.
- In the `candidateNames.length === 1` path, product may come solely from previous assistant output (not a menu selection or explicit user mention).
- Guardrails in `CLAUDE.md` emphasize “current-turn evidence” for transactional order state.

## Proposed Solutions

### Option 1: Require explicit current-turn selection/mention

**Approach:** In followup path, only allow auto-order when:
- user message contains the normalized product name, OR
- user message is an explicit menu selection (`1`, `2`, …) handled by `maybeHandleMenuSelection`.

**Pros:**
- Aligns with transactional guardrails
- Reduces accidental wrong-item orders

**Cons:**
- Slightly more friction for “yes 2 tomorrow 11” flows

**Effort:** 1–2 hours  
**Risk:** Medium

---

### Option 2: Persist “last_product_candidates” as transactional state

**Approach:** Store the last candidate list + timestamp in DB (like `pending_selection`), and require it to be fresh before using it.

**Pros:**
- Explicit state machine, fewer heuristics

**Cons:**
- More schema/state changes

**Effort:** 4–6 hours  
**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation.ts:309`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:241`

## Acceptance Criteria

- [x] Followup “yes/da + qty + pickup time” does not create `ORDER:` unless product is explicitly selected or mentioned
- [x] Unit test covers assistant-single-candidate scenario

## Work Log

### 2026-03-20 - Code review finding

**By:** Codex

**Actions:**
- Flagged potential guardrail regression after inventory prompt removal

### 2026-03-20 - Fixed

**By:** Codex

**Actions:**
- Updated follow-up logic to require explicit mention/selection for auto-order when only assistant context is present (`lib/whatsapp/conversation.ts`).
- Added unit test asserting no `ORDER:` from assistant-only single mention (`tests/unit/whatsappAgent.test.ts`).
