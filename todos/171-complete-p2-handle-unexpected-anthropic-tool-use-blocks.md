---
status: complete
priority: p2
issue_id: "171"
tags: [code-review, security, whatsapp, reliability]
dependencies: []
---

# Handle unexpected Anthropic `tool_use` blocks safely

## Problem Statement

If Anthropic returns a `tool_use` block for an unknown tool (prompt injection / model drift), the current tool loop only responds to `search_products`. Missing `tool_result` responses can deadlock the conversation loop (DoS-by-prompt) or degrade reliability.

## Findings

- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:98` iterates `toolUses` but `continue`s for unknown tools, producing no `tool_result` for those IDs.
- Anthropic expects a `tool_result` per `tool_use_id`; missing responses often lead to repeated tool requests or empty responses.

## Proposed Solutions

### Option 1: Always return an error `tool_result` for unknown tools (recommended)

**Approach:** For any `tool_use` whose `name !== "search_products"`, push a `tool_result` with `is_error: true` explaining “unsupported tool”.

**Pros:** Prevents deadlocks; robust to future tool expansions.

**Cons:** Slightly more code in tool loop.

**Effort:** Small

**Risk:** Low

---

### Option 2: Hard-fail the turn

**Approach:** Throw an error if an unknown tool is requested.

**Pros:** Very explicit.

**Cons:** Turns transient model behavior into user-visible failures.

**Effort:** Small

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:58`

## Acceptance Criteria

- [x] Every `tool_use` receives a matching `tool_result`.
- [x] Tool loop cannot deadlock on unknown tools.

## Work Log

### 2026-03-20 - Created from security review

**By:** Codex

**Actions:**
- Reviewed Anthropic tool loop behavior and identified missing `tool_result` path.

### 2026-03-20 - Fixed

**By:** Codex

**Actions:**
- Added defensive `tool_result` responses for unknown tools with `is_error: true` (`lib/whatsapp/llm.ts`).
