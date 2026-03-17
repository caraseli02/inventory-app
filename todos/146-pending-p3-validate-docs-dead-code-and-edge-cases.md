---
status: pending
priority: p3
issue_id: "146"
tags: [code-review, documentation, tooling, dx]
dependencies: ["132"]
---

# validate-docs.js dead code and minor edge case gaps

## Problem Statement
Three minor issues in `validate-docs.js`: (1) `getStagedFiles()` is defined but never called — `main()` reimplements the same logic inline, (2) `related_github_issue` falsy check would pass `0` or `""` as "not present", (3) `module` field has no empty-string validation.

## Findings
- Lines 38-46: `getStagedFiles()` function defined, never called — `main()` at line 155 duplicates it inline
- Line 135: `if (frontmatter.related_github_issue)` — falsy check passes `0` and `""` silently
- `module` required field only checked for `undefined`/`null`, not empty string

## Proposed Solutions
Fix all 3 in a single small PR:
1. Remove the dead `getStagedFiles()` function (or use it in `main()`)
2. Change to `if (frontmatter.related_github_issue != null)` for issue check
3. Add `|| frontmatter.module === ''` to module validation check

- Effort: Tiny
- Combine with #132 (file path argument support)

## Technical Details
- Affected file: `scripts/validate-docs.js` lines 38-46, 70, 135

## Acceptance Criteria
- [ ] No dead code in validate-docs.js
- [ ] `related_github_issue: 0` or `related_github_issue: ""` triggers a warning

## Work Log
- 2026-03-17: Identified by kieran-typescript-reviewer agent in ce-review
