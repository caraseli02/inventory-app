---
status: pending
priority: p3
issue_id: "022"
tags: [code-review, repo-hygiene, tooling]
dependencies: []
---

# Ignore generated `.git-hooks/` directory (simple-git-hooks)

## Problem Statement

Running `pnpm install` triggers `simple-git-hooks` which may generate a `.git-hooks/` directory in the repo root. This is currently untracked and shows up in `git status`, creating noise and increasing the chance of accidentally committing generated hook scripts.

## Findings

- After `pnpm install`, `.git-hooks/pre-commit` was generated in the repo root.
- The repo already contains `.githooks/` (tracked) with its own pre-commit script.
- The `package.json` config for `simple-git-hooks` indicates it will manage hooks and point `core.hooksPath` to `.git-hooks` for some setups.

Potential confusion:
- Two hook systems appear present (`.githooks/` and `simple-git-hooks`).

## Proposed Solutions

### Option 1: Add `.git-hooks/` to `.gitignore` (recommended)

**Approach:** Ignore generated hooks directory so it never shows up as untracked.

**Pros:**
- Immediate quality-of-life improvement
- Prevents accidental commits

**Cons:**
- Doesn’t resolve dual-hook-system ambiguity

**Effort:** 5 minutes

**Risk:** Low

---

### Option 2: Standardize on one hook system

**Approach:** Choose either:
- `simple-git-hooks` only, remove `.githooks/` usage, document in README
- `.githooks/` only, remove `simple-git-hooks` config from `package.json`

**Pros:**
- Removes ambiguity for contributors
- More predictable hook behavior

**Cons:**
- Requires a deliberate project decision

**Effort:** 30-90 minutes

**Risk:** Medium (could break expected pre-commit behavior for some devs)

## Recommended Action

To be filled during triage.

## Technical Details

Relevant files:
- `package.json` (`simple-git-hooks` configuration)
- `.githooks/pre-commit`
- `.gitignore` (needs update if Option 1)

## Acceptance Criteria

- [ ] `.git-hooks/` does not show up in `git status` after a fresh install
- [ ] Hook behavior is documented (which system is authoritative)

## Work Log

### 2026-02-12 - Review Finding

**By:** Codex

**Actions:**
- Observed `.git-hooks/` created during local install and appearing as untracked
- Noted presence of `.githooks/` and potential duplication

