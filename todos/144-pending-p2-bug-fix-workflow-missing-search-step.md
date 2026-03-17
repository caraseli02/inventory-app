---
status: pending
priority: p2
issue_id: "144"
tags: [code-review, documentation, dx, claude-md]
dependencies: []
---

# Bug fix workflow in CLAUDE.md missing mandatory search-first step

## Problem Statement
The CLAUDE.md "Bug Fix Workflow" starts at step 1: "Create a GitHub Issue." The `search-solutions.js` command is only mentioned in the Quick Reference — not as a numbered step. Following the workflow literally, an agent will never search for prior art, risking duplicate solution docs and missed pattern reuse.

## Findings
- `CLAUDE.md` lines 302-323: Bug Fix Workflow has 4 steps — Report, Fix, Document, Close
- Search command (`node scripts/search-solutions.js`) is in Quick Reference only
- No mandatory step says "search before writing a new solution"
- Pattern 4 in `critical-patterns.md` mentions search but is not cross-referenced from the workflow
- The learnings-researcher agent found this gap: "agents following the workflow literally will never search for prior art"
- Example missed reuse: any new WhatsApp pending-order bug would benefit from searching "whatsapp pending order" first, surfacing 5+ directly relevant solutions

## Proposed Solutions

### Option A: Add Step 0 to Bug Fix Workflow (Recommended)
Insert before step 1:
```markdown
0. **Search**: `node scripts/search-solutions.js --query "[symptom keywords]"`.
   If a matching solution exists, link to it in the issue rather than creating a duplicate.
```
- Effort: Tiny (2-line change)
- Risk: None

### Option B: Add search step to solution template
Add a "Prior Art" section to `docs/solutions/_template.md` that must be filled before continuing.
- Effort: Tiny
- Complementary to Option A

**Recommended**: Both A and B.

## Technical Details
- Affected files: `CLAUDE.md` lines 302-323, `docs/solutions/_template.md`

## Acceptance Criteria
- [ ] Bug Fix Workflow has explicit search step as step 0
- [ ] `_template.md` has Prior Art / Related Solutions section
- [ ] Quick Reference search command remains (redundant but useful)

## Work Log
- 2026-03-17: Identified by agent-native-reviewer agent in ce-review
