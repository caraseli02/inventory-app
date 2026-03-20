---
status: complete
priority: p2
issue_id: "172"
tags: [code-review, performance, whatsapp-agent]
dependencies: []
---

# Skip list-picker DB query when no search candidates

## Problem Statement

`runConversationTurn()` always calls `searchProductNames()` for `intent === "product_query"`, even when there are no usable search candidates. This can add extra Supabase reads on turns like “ok”, “da”, or other followups where product terms are absent and list-picker won’t be used anyway.

## Findings

- List-picker pre-check runs unconditionally for `product_query`: `searchProductNames(args.sb, { candidates: searchCandidatesUsed, ... })`. Location: `lib/whatsapp/llm.ts:223`.
- When `searchCandidatesUsed` is empty, `searchProductNames()` falls back to `order('name').limit(30)` and returns up to 10 names (and then list-picker is skipped because we only accept up to 9). That’s a wasted query on common messages.

## Proposed Solutions

### Option 1: Only attempt list-picker when candidates exist (recommended)

**Approach:** In `runConversationTurn()`, wrap the list-picker query with:
`if (searchCandidatesUsed.length > 0) { ... }`

**Pros:**
- Eliminates fallback query on empty-candidate turns
- Minimal change, easy to reason about

**Cons:**
- Slightly reduces “helpfulness” if a user sends an empty query but expects a product list (arguably `browse_inventory` intent should cover that)

**Effort:** 10–20 min

**Risk:** Low

---

### Option 2: Teach `searchProductNames()` to return [] when candidates are empty for WhatsApp list-picker usage

**Approach:** Add an option/flag to disable fallback when `candidates.length === 0`.

**Pros:**
- Keeps function reusable for other contexts

**Cons:**
- Slightly more API surface area

**Effort:** 30–60 min

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `lib/whatsapp/llm.ts:223`
- `lib/whatsapp/inventory.ts:370` (fallback query behavior)

## Acceptance Criteria

- [x] When `searchCandidatesUsed.length === 0`, `runConversationTurn()` does not call `searchProductNames()`
- [x] Existing list-picker behavior unchanged for candidate-driven queries (2–9 matches)
- [ ] Unit test added to cover the “no candidates” turn (assert no query / no list picker)

## Work Log

### 2026-03-20 - Created from ce:review findings

**By:** Codex

**Actions:**
- Flagged avoidable DB reads on empty-candidate turns

### 2026-03-20 - Fixed

**By:** Codex

**Actions:**
- Added guard so list-picker search runs only when `searchCandidatesUsed.length > 0` (`lib/whatsapp/llm.ts`).
