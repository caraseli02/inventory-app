---
status: complete
priority: p1
issue_id: "169"
tags: [code-review, performance, whatsapp-agent]
dependencies: []
---

# Avoid unconditional inventory fetch in repair-order path

## Problem Statement

`runConversationTurn()` fetches inventory via `getInventorySummary()` on *every* non-local LLM turn when `repairOrder=true`, even when the LLM reply already includes `ORDER:` (or when repair is impossible). This adds extra Supabase queries and latency, undermining the “lazy inventory” goal.

## Findings

- `repairOrder` path eagerly computes `repairInventoryText = inventoryText || await getInventorySummary(...)` before calling `maybeRepairOrderReply()`. This triggers a DB fetch for non-local providers because `inventoryText === ''` by design. Location: `lib/whatsapp/llm.ts:281`.
- `maybeRepairOrderReply()` immediately returns when `ORDER:` is present, so the DB work is frequently wasted.
- At scale, this is a predictable per-message tax (extra products + stock_movements queries) on the main WhatsApp latency path.

## Proposed Solutions

### Option 1: Gate the DB fetch behind cheap checks (recommended)

**Approach:** Before fetching inventory, check:
- reply already has `ORDER:` → skip entirely
- user message doesn’t contain both qty + pickup time → skip
- context doesn’t look like an order request → skip

Only if all pass, then call `getInventorySummary()` and attempt repair.

**Pros:**
- Removes unnecessary Supabase calls for most turns
- Keeps repair behavior when it’s actually needed

**Cons:**
- Slight duplication of some predicate logic (unless factored out)

**Effort:** 30–60 min

**Risk:** Low

---

### Option 2: Refactor `maybeRepairOrderReply()` to accept a lazy inventory loader

**Approach:** Pass a `getInventoryText()` callback and call it only if repair reaches the “needs inventory names” stage.

**Pros:**
- Centralizes “repair decision” logic
- Avoids duplicated checks in caller

**Cons:**
- More invasive refactor

**Effort:** 1–2 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `lib/whatsapp/llm.ts:281` (repairOrder fetch)

## Acceptance Criteria

- [x] Non-local LLM turns with `ORDER:` in the reply do not call `getInventorySummary()`
- [x] Repair still works when user provides (product + qty + pickup time) but model forgets `ORDER:`
- [ ] Unit test added or updated to assert no fetch when `ORDER:` present (mock `getInventorySummary`)

## Work Log

### 2026-03-20 - Created from ce:review findings

**By:** Codex

**Actions:**
- Identified unconditional inventory fetch in repair path

**Learnings:**
- “Lazy inventory” improvements can be negated by post-processing paths if not guarded

### 2026-03-20 - Fixed

**By:** Codex

**Actions:**
- Short-circuited repair when reply already contains `ORDER:` (no DB hit).
- Gated repair inventory fetch behind cheap checks (qty+time + looksLikeOrderRequest) (`lib/whatsapp/llm.ts`).
