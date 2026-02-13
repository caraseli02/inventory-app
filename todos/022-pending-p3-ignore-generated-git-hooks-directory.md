---
status: complete
priority: p3
issue_id: "022"
tags: [code-review, repo-hygiene, tooling]
dependencies: []
---

# Ignore generated `.git-hooks/` directory (simple-git-hooks)

## Problem Statement

This finding is now superseded: the repo has been standardized on `simple-git-hooks` and `.git-hooks/pre-commit` is treated as the authoritative hook script (tracked in git). Ignoring `.git-hooks/` would be incorrect under the current strategy.

## Findings

- Previously observed:
  - `pnpm install` generated/updated `.git-hooks/pre-commit`.
  - The repo also had `.githooks/` (tracked) with its own `pre-commit` script.

Potential confusion:
- Two hook systems appear present (`.githooks/` and `simple-git-hooks`).

## Proposed Solutions

### Option 1: Add `.git-hooks/` to `.gitignore`

**Approach:** Ignore generated hooks directory so it never shows up as untracked.

**Pros:**
- Immediate quality-of-life improvement
- Prevents accidental commits

**Cons:**
- Doesn’t resolve dual-hook-system ambiguity
- Conflicts with treating `.git-hooks/` as the source of truth

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

- [x] Hook behavior is documented (which system is authoritative)
- [x] Only one hook system is used

## Work Log

### 2026-02-12 - Review Finding

**By:** Codex

**Actions:**
- Observed `.git-hooks/` created during local install and appearing as untracked
- Noted presence of `.githooks/` and potential duplication

### 2026-02-13 - Completed

**By:** Codex

**Actions:**
- Standardized on `simple-git-hooks` only
- Removed legacy `.githooks/pre-commit`
- Updated `setup-hooks.sh` to match the `simple-git-hooks` workflow
