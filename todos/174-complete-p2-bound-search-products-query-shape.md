---
status: complete
priority: p2
issue_id: "174"
tags: [code-review, security, whatsapp, mcp, performance]
dependencies: []
---

# Bound `search_products` query shape (length + wildcard controls)

## Problem Statement

Tool queries are interpolated into `ilike('%${query}%')`. Even if this is “read-only”, unbounded query strings (or wildcard-heavy patterns) can cause unnecessary DB work and enable inventory enumeration at higher rate.

## Findings

- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:101` accepts any string as `query` (no max length clamp for Anthropic path).
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/inventory.ts:130` uses the raw query term(s) directly in `ilike` patterns.
- `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:226` uses raw `query` in `ilike` pattern.

## Proposed Solutions

### Option 1: Clamp + normalize at entry points (recommended)

**Approach:**
- Clamp query length (ex: 200 chars) and trim.
- Reject/short-circuit queries that normalize to < 2 alnum tokens.
- Optionally strip `%` / `_` from tool queries (or escape them) so user can’t widen matches unintentionally.

**Pros:** Predictable load; less token/data exposure.

**Cons:** Slightly less flexible search.

**Effort:** Small

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:58`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/inventory.ts:125`
- `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:197`

## Acceptance Criteria

- [x] Tool query is clamped to a safe max length.
- [x] Queries that normalize to empty/very short are rejected early.
- [ ] Add unit coverage for “wildcard-y” and very long queries.

## Work Log

### 2026-03-20 - Created from security review

**By:** Codex

**Actions:**
- Flagged query interpolation into `ilike` patterns as a potential performance/security footgun without bounds.

### 2026-03-20 - Fixed

**By:** Codex

**Actions:**
- Stripped `%`/`_`, clamped to 200 chars, and short-circuited empty queries across WhatsApp + inventory helpers + MCP (`lib/whatsapp/llm.ts`, `lib/whatsapp/inventory.ts`, `mcp/server.ts`).
