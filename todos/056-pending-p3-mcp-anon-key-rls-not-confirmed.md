---
status: pending
priority: p3
issue_id: "056"
tags: [security, mcp, supabase, code-review]
dependencies: ["042"]
---

# MCP uses Supabase anon key — RLS enforcement on products/stock_movements not confirmed

## Problem Statement

The MCP server uses the Supabase anon key — safe only when Row Level Security (RLS) is enabled with correct policies. A review of `supabase/` SQL files found zero `ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` statements for `products` and `stock_movements`. If RLS is absent, the anon key grants read/write access to every row.

Combined with #042 and #043, the chain is: no MCP_SECRET → wildcard CORS → invoke tool → anon key → no RLS → full table dump from any web page.

## Findings

**Location:** `mcp/server.ts:20-28` + `supabase/` (missing RLS policies)

CLAUDE.md states: "Safe to expose client-side: The publishable key (also called 'anon' key) is designed for browser use" and "Row Level Security (RLS): Protect data with PostgreSQL policies in Supabase dashboard." However, no migration files assert RLS is enabled.

## Proposed Solutions

### Solution 1: Confirm and document RLS (Recommended)
1. Verify in Supabase dashboard that `products` and `stock_movements` have RLS enabled
2. Add migration files asserting RLS:
```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
-- Add appropriate policies for anon read access
CREATE POLICY "Public read access" ON products FOR SELECT TO anon USING (true);
```
3. Add a note in `docs/MCP_SETUP.md` that RLS must be configured

**Effort:** Small (if RLS is already enabled — just document it). Medium (if not enabled — add policies).

### Solution 2: Use service-role key scoped to read-only Postgres role
Give the MCP server a dedicated database role with SELECT-only permissions. **Effort:** High. Overkill for current use case.

## Recommended Action

Solution 1 — confirm RLS status in dashboard and add migration assertions. The anon key is intentionally public-safe only WITH RLS. Document this dependency explicitly.

## Acceptance Criteria

- [ ] Confirmed RLS is enabled on `products` and `stock_movements`
- [ ] Migration file asserts `ENABLE ROW LEVEL SECURITY` for both tables
- [ ] `docs/MCP_SETUP.md` mentions RLS as a security requirement

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Security Sentinel Agent + Learnings Researcher)
**Known Pattern:** `docs/solutions/integration-issues/invoice-proxy-security-hardening-*.md` — prior art for server-side credential protection.

## Technical Details

**Affected Files:**
- `supabase/` — missing RLS migration
- `docs/MCP_SETUP.md`
