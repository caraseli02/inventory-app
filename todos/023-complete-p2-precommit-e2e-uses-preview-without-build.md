---
status: complete
priority: p2
issue_id: "023"
tags: [code-review, tooling, playwright, developer-experience]
dependencies: []
---

# Fix Pre-Commit E2E Configuration That Uses Preview Without Building

## Problem Statement

The pre-commit hook runs `CI=true pnpm test:e2e`, and `playwright.config.ts` uses `pnpm preview` when `CI` is set. `vite preview` requires a prior `pnpm build` to generate `dist/`. On a clean clone or after deleting `dist/`, commits can fail even if code is correct.

## Findings

- `package.json` sets pre-commit to `pnpm validate-docs && CI=true pnpm test:e2e`.
- `playwright.config.ts` uses:
  - `pnpm preview ...` when `process.env.CI` is truthy
  - `pnpm dev ...` otherwise
- `pnpm preview` does not build assets; it serves existing build output.

## Proposed Solutions

### Option 1: Stop Forcing `CI=true` In Pre-Commit

**Approach:** Change pre-commit to `pnpm validate-docs && pnpm test:e2e` so Playwright uses `pnpm dev` locally.

**Pros:**
- Fastest to run locally
- Avoids reliance on `dist/`

**Cons:**
- Tests run against dev server behavior, not production build

**Effort:** 10 minutes

**Risk:** Low

---

### Option 2: Add `pnpm build` Before E2E In Pre-Commit

**Approach:** Change pre-commit to `pnpm validate-docs && pnpm build && CI=true pnpm test:e2e`.

**Pros:**
- Tests production output, closer to CI
- Deterministic assets

**Cons:**
- Slower pre-commit; may reduce iteration speed

**Effort:** 10-15 minutes

**Risk:** Low

---

### Option 3: Use A Dedicated Env Flag For Preview Mode

**Approach:** Update `playwright.config.ts` to use preview only when `PLAYWRIGHT_USE_PREVIEW=1` (or `GITHUB_ACTIONS`), keeping local `CI=true` harmless.

**Pros:**
- Keeps CI semantics explicit and avoids accidental coupling

**Cons:**
- Slightly more configuration complexity

**Effort:** 20-40 minutes

**Risk:** Medium

## Recommended Action

Keep pre-commit running `CI=true pnpm test:e2e`, but ensure Playwright’s web server command builds before previewing (`pnpm build && pnpm preview`).

## Technical Details

**Affected files:**
- `package.json` - pre-commit hook command
- `playwright.config.ts` - webServer command selection

## Resources

- **Branch:** `codex/refresh-safe-routing-cart-persistence`
- **Commit:** `6154e3e`

## Acceptance Criteria

- [ ] A fresh clone with no `dist/` can run the pre-commit hook successfully.
- [ ] Pre-commit e2e server mode is intentional (dev vs preview) and documented in code/comments.
- [ ] Playwright e2e still runs preview in real CI (if desired).

## Work Log

### 2026-02-12 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed `package.json` pre-commit hook and `playwright.config.ts` webServer command selection.
- Identified `vite preview` dependency on prior build output.

**Learnings:**
- Avoid binding local tooling to `CI=true` unless you also provide the build artifacts it implies.

---

### 2026-02-12 - Implemented Fix

**By:** Codex

**Actions:**
- Updated `/Users/vladislavcaraseli/.codex/worktrees/18ab/inventory-app/playwright.config.ts` so CI mode uses `pnpm build && pnpm preview`.
- Added `webServer.env.VITE_INVOICE_API_URL=''` to make local e2e deterministic even when developers have dev-only invoice env vars set.
- Verified: `pnpm test:e2e` passes with invoice smoke spec.

**Learnings:**
- Putting the build step inside the webServer command avoids duplicating it in hooks and prevents “missing dist/” failures on clean clones.
