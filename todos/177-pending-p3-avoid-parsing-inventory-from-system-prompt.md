---
status: pending
priority: p3
issue_id: "177"
tags: [code-review, whatsapp, simulator, refactor, maintainability]
dependencies: []
---

# Avoid simulator parsing inventory text from system prompt string

## Problem Statement

Local simulator uses string parsing on the system prompt (`INVENTAR LIVE:` + `REGULI:` delimiters) to recover `inventoryText`. Prompt formatting changes can silently break local behavior/tests.

## Findings

- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts:43` extracts `inventoryText` via `rest.system.split('INVENTAR LIVE:\\n')[1]...split('\\n\\nREGULI:')...`.
- Prompt rules changed to emphasize tool calling; future prompt edits risk breaking this delimiter parsing.

## Proposed Solutions

### Option 1: Pass `inventoryText` explicitly to the local generator

**Approach:** In `runConversationTurn`, when `llmProvider === 'local'`, call the local generator directly with computed `inventoryText` (no prompt parsing).

**Pros:**
- Removes brittle string coupling
- Easier to refactor prompts safely

**Cons:**
- Small interface change in `GenerateLlmReply` for local case

**Effort:** 30–60 min  
**Risk:** Low

---

### Option 2: Introduce a structured delimiter contract

**Approach:** Keep parsing but add a `BEGIN/END` sentinel block with stable markers and unit test it.

**Pros:**
- Minimal API churn

**Cons:**
- Still brittle vs explicit param

**Effort:** 30–60 min  
**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts:28`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:136`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts:1`

## Acceptance Criteria

- [ ] Local simulator no longer depends on system-prompt string parsing for inventory
- [ ] Unit tests still pass after prompt wording changes

## Work Log

### 2026-03-20 - Code review finding

**By:** Codex

**Actions:**
- Flagged prompt-parsing coupling as a maintainability risk
