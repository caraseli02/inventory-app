---
status: pending
priority: p1
issue_id: "132"
tags: [code-review, documentation, dx, tooling]
dependencies: ["129"]
---

# validate-docs.js silently no-ops when called with a file path argument

## Problem Statement
`CLAUDE.md` Quick Reference instructs agents and developers to run:
```
node scripts/validate-docs.js docs/solutions/[category]/[name].md
```
But `validate-docs.js` ignores `process.argv` entirely. Its `main()` always calls `getStagedFiles()`. When nothing is staged, it exits cleanly: "No docs/solutions changes to validate." — exit code 0. The agent/developer receives a false pass; validation was never run.

## Findings
- `validate-docs.js` `main()` lines 150-199: no `process.argv` handling
- `getStagedFiles()` lines 38-46: defined but also never called (dead code — `main()` reimplements inline)
- Passing a file path: `node scripts/validate-docs.js docs/solutions/logic-errors/foo.md` → "No docs/solutions changes to validate" (success)
- Pre-commit hook works correctly because files are staged before the hook runs — but interactive use is broken
- Pattern 4 in `critical-patterns.md` references this exact command as the way to validate

## Proposed Solutions

### Option A: Add argv file-path mode (Recommended)
```javascript
const filePaths = process.argv.slice(2).filter(a => !a.startsWith('--'));
const files = filePaths.length > 0 ? filePaths : getStagedFiles();
```
Then validate each file in `files`. If argv files are passed, skip the "No staged changes" early exit.
- Effort: Small (5-10 lines)
- Risk: Low

### Option B: Add --all flag for CI mode
Add `--all` flag that reads all files under `docs/solutions/` (for CI use), while default mode remains staged-files-only.
- Effort: Small
- Combines with todo #129 (CI enforcement)

**Recommended**: Both Option A and B — file path arg for interactive use, `--all` for CI.

## Technical Details
- Affected files: `scripts/validate-docs.js`, `docs/solutions/patterns/critical-patterns.md` (update example)
- Also: `CLAUDE.md` Quick Reference command should note the staged-only limitation until fixed

## Acceptance Criteria
- [ ] `node scripts/validate-docs.js docs/solutions/logic-errors/foo.md` validates that specific file
- [ ] Invalid file returns non-zero exit code with specific error message
- [ ] Valid file returns zero exit code with "✓ Valid" message
- [ ] Staged-files mode still works for pre-commit hook

## Work Log
- 2026-03-17: Identified by agent-native-reviewer in ce-review
