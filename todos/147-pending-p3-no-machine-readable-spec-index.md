---
status: pending
priority: p3
issue_id: "147"
tags: [code-review, documentation, dx]
dependencies: ["140"]
---

# No machine-readable spec index — agents must open every spec file to navigate

## Problem Statement
All spec files use Markdown bold-formatted metadata (`**Status**: COMPLETE`) — not YAML frontmatter. There is no `docs/specs/index.json` or equivalent. An agent asked "which spec covers barcode scanning?" must read `docs/README.md`'s prose table (which is already stale) or open each spec file. Navigation is slow and brittle if heading formats change.

## Findings
- 19 spec files, each with `**Status**: ...` as a Markdown bold line (not YAML frontmatter)
- `docs/README.md` spec table is the closest index but is manually maintained and has drifted
- No `scripts/list-specs.js` or `docs/specs/index.json` exists
- An agent determining "which spec do I update after implementing barcode scanning?" needs multiple file reads

## Proposed Solutions

### Option A: Generate docs/specs/index.json in CI
Script that parses each spec's `**Status**:` line and `**Dependencies**:` line, outputs a JSON array:
```json
[{"file": "scanner.md", "name": "Barcode Scanning", "status": "COMPLETE", "dependencies": []}]
```
- Effort: Small (script) + CI integration
- Requires: standardizing spec metadata format first (see #140)

### Option B: Convert spec headers to YAML frontmatter
```yaml
---
name: Barcode Scanning
status: COMPLETE
dependencies: [validation_guardrails.md]
---
```
- Effort: Medium (19 files to update)
- Long-term better for tooling

**Recommended**: Option A as a quick win. Option B as a future improvement.

## Technical Details
- 19 spec files in `docs/specs/`

## Acceptance Criteria
- [ ] An agent can get a list of all specs + their statuses in a single script call
- [ ] Index is generated/validated in CI (not manually maintained)

## Work Log
- 2026-03-17: Identified by agent-native-reviewer agent in ce-review
