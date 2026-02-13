---
status: complete
priority: p2
issue_id: "026"
tags: [code-review, repo-hygiene, tooling]
dependencies: ["022"]
---

# Standardize git hook system (`.git-hooks/` vs `.githooks/`)

## Problem Statement

The repo currently has two git-hook systems present (`.git-hooks/` via `simple-git-hooks` and `.githooks/`). Installing deps (`pnpm install`) can rewrite `.git-hooks/pre-commit`, creating noise and confusion about which hook is authoritative.

## Findings

- `package.json` config uses `simple-git-hooks` for `pre-commit`.
- Repo also contains `.githooks/` directory.
- Running `pnpm install` updates `.git-hooks/pre-commit` to match `package.json`, which can show up as a modified tracked file.
- Existing todo `022` assumes `.git-hooks/` is untracked; current reality is closer to "tracked file rewritten".

## Proposed Solutions

### Option 1: Standardize on `simple-git-hooks` only (recommended if you want auto-managed hooks)

**Approach:**
- Treat `.git-hooks/` as the source of truth
- Remove/stop using `.githooks/`
- Document in README/CONTRIBUTING (or `docs/`)

**Pros:**
- Single system
- Hooks auto-managed from `package.json`

**Cons:**
- Requires repo decision + cleanup

**Effort:** 30-60 minutes

**Risk:** Medium (contributors may rely on current setup)

---

### Option 2: Standardize on `.githooks/` only

**Approach:**
- Remove `simple-git-hooks` config from `package.json`
- Ensure `core.hooksPath` points to `.githooks`
- Keep scripts stable (no `pnpm install` rewrites)

**Pros:**
- Deterministic tracked scripts
- Less "magic"

**Cons:**
- More manual setup / docs

**Effort:** 30-60 minutes

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/.codex/worktrees/0881/inventory-app/package.json`
- `/Users/vladislavcaraseli/.codex/worktrees/0881/inventory-app/.git-hooks/pre-commit`
- `/Users/vladislavcaraseli/.codex/worktrees/0881/inventory-app/.githooks/pre-commit`
- `/Users/vladislavcaraseli/.codex/worktrees/0881/inventory-app/todos/022-pending-p3-ignore-generated-git-hooks-directory.md`

## Resources

- Existing todo: `/Users/vladislavcaraseli/.codex/worktrees/0881/inventory-app/todos/022-pending-p3-ignore-generated-git-hooks-directory.md`

## Acceptance Criteria

- [ ] Only one hook system is used and documented
- [ ] `pnpm install` does not cause confusing hook diffs for contributors

## Work Log

### 2026-02-13 - Review Finding

**By:** Codex

**Actions:**
- Observed `.git-hooks/pre-commit` rewrite behavior during install
- Noted coexistence with `.githooks/`

### 2026-02-13 - Completed

**By:** Codex

**Actions:**
- Removed legacy `.githooks/pre-commit`
- Updated `setup-hooks.sh` to align with `simple-git-hooks` workflow
- Ensured `.git-hooks/pre-commit` content matches `package.json` hook command and added missing newline
- Ran `pnpm test:unit` and `pnpm lint`
