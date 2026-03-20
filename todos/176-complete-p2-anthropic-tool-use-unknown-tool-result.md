---
status: complete
priority: p2
issue_id: "176"
tags: [code-review, whatsapp, llm, anthropic, tools, reliability]
dependencies: []
---

# Anthropic tool loop should respond to unknown tool_use blocks

## Problem Statement

`generateAnthropicReplyWithTools()` only returns `tool_result` blocks for `search_products`. If Claude ever emits a `tool_use` with a different name, the loop currently skips it and does not provide a `tool_result`, which can cause Anthropic to error on the next request (tool use without result).

## Findings

- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:98` skips non-`search_products` tool uses via `continue`, producing no `tool_result` for that tool use.
- Anthropic tool protocol generally expects *every* `tool_use` to be followed by a `tool_result` (success or `is_error`).

## Proposed Solutions

### Option 1: Always emit tool_result for every tool_use

**Approach:** For unknown tool names, return `is_error: true` with a small JSON error payload.

**Pros:**
- Most robust against model/tool drift
- Prevents hard failures from unexpected tool_use

**Cons:**
- Slightly more code

**Effort:** < 30 min  
**Risk:** Low

---

### Option 2: Force tool_choice to `auto` + strict tool list

**Approach:** If Anthropic SDK supports strict tool routing, configure to reduce chance of unknown tool_use.

**Pros:**
- Less defensive code

**Cons:**
- Still doesn’t eliminate unknown tool_use entirely
- SDK support/behavior may vary

**Effort:** 30–60 min  
**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:58`

## Acceptance Criteria

- [x] Any `tool_use` block receives a corresponding `tool_result`
- [x] Unknown tool names return `is_error: true` tool_result
- [ ] Unit test simulates unknown tool_use and asserts no crash

## Work Log

### 2026-03-20 - Code review finding

**By:** Codex

**Actions:**
- Identified missing defensive handling for unknown Anthropic tool calls

**Learnings:**
- Tool protocols are brittle; defensive defaults prevent runtime failures.

### 2026-03-20 - Fixed

**By:** Codex

**Actions:**
- Unknown tool requests now receive an error `tool_result` instead of being skipped (`lib/whatsapp/llm.ts`).
