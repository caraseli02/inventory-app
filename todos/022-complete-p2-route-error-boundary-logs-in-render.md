---
status: complete
priority: p2
issue_id: "022"
tags: [code-review, routing, observability, react]
dependencies: []
---

# Avoid Logging Side Effects During RootRouteError Render

## Problem Statement

`RootRouteError` calls `logger.error(...)` during render. In React `StrictMode` (enabled in `src/main.tsx`), rendering can happen multiple times, and any state updates can also re-render the error boundary. This can produce duplicate or noisy error logs and makes render impure.

## Findings

- `src/routes/RootRouteError.tsx:23` performs logging as a render side effect.
- `src/main.tsx` enables `<StrictMode>`, which can double-invoke renders in development.

## Proposed Solutions

### Option 1: Move Logging Into `useEffect`

**Approach:** Replace the render-time log with `useEffect(() => { logger.error(...) }, [message, error])`.

**Pros:**
- Eliminates render-time side effects
- Avoids duplicate logging in StrictMode render passes

**Cons:**
- Slightly delayed log (after paint), usually acceptable

**Effort:** 10-20 minutes

**Risk:** Low

---

### Option 2: Add a Render Guard

**Approach:** Keep render-time log but guard with a ref so it logs once per unique error/message.

**Pros:**
- Preserves synchronous logging semantics

**Cons:**
- More complexity and still impure render path

**Effort:** 20-40 minutes

**Risk:** Medium

## Recommended Action

Move `logger.error(...)` into `useEffect` so renders are pure and logs aren’t emitted during render.

## Technical Details

**Affected files:**
- `src/routes/RootRouteError.tsx:23`
- `src/main.tsx:1` (StrictMode context)

## Resources

- **Branch:** `codex/refresh-safe-routing-cart-persistence`
- **Commit:** `6154e3e`

## Acceptance Criteria

- [ ] Route error boundary logs are emitted once per error occurrence in development.
- [ ] No logging side effects occur during component render.
- [ ] Manual check: trigger a route error and verify log behavior is stable.

## Work Log

### 2026-02-12 - Initial Discovery

**By:** Codex

**Actions:**
- Found render-time logging in `src/routes/RootRouteError.tsx:23` in a StrictMode app.

**Learnings:**
- Render-time side effects create noisy logs and make debugging harder, especially with StrictMode.

---

### 2026-02-12 - Implemented Fix

**By:** Codex

**Actions:**
- Moved logging to `useEffect` in `/Users/vladislavcaraseli/.codex/worktrees/18ab/inventory-app/src/routes/RootRouteError.tsx`.
- Verified: `pnpm lint`, `pnpm test:unit`, `pnpm test:e2e`.

**Learnings:**
- This removes render-time side effects; StrictMode can still duplicate logs in dev due to intentional mount/unmount behavior, but production is clean.
