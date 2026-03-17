---
status: pending
priority: p2
issue_id: "140"
tags: [code-review, documentation, dx]
dependencies: ["139"]
---

# docs/README.md is 100+ days stale — wrong spec statuses, missing specs and ADRs

## Problem Statement
`docs/README.md` was last validated 2025-12-05. It shows `whatsapp_agent.md` as `NOT_STARTED` (actual: `IN_PROGRESS`), lists only ADR-0001, and is missing 3 spec files added since December. As the project documentation entry point, a stale README breaks onboarding and misdirects developers and agents.

## Findings
- Line 3: `Last validated: 2025-12-05` — 100+ days ago
- Line 38: `whatsapp_agent.md` listed as `NOT_STARTED` — actual status `IN_PROGRESS` with substantial implementation
- ADR section: only ADR-0001 listed — ADR-0002 through -0005 missing
- Missing from spec table: `checkout_flow.md`, `invoice-import-api-contract.md`, `duplicate-prevention-strategy.md`
- `docs/specs/documentation_home.md` (which tracks README itself) also shows `Last Reviewed: 2025-12-05`
- Non-standard status values across 5+ specs: `READY TO LAUNCH`, `RESEARCH`, `MVP Scope`, `POST_MVP (DEFERRED)`, `COMPLETE (MVP)` — none conform to `NOT_STARTED | PARTIAL | IN_PROGRESS | COMPLETE`

## Proposed Solutions

### Option A: Full README refresh (Recommended)
1. Update "Last validated" date
2. Fix WhatsApp spec status to IN_PROGRESS
3. Add all ADRs to Architecture Decisions section
4. Add 3 missing specs to Specifications table
5. Standardize status values or document the extended enum officially in CLAUDE.md
- Effort: Small

### Option B: Add README validation to CI
Validate that the README index matches actual files in `docs/specs/` and `docs/adrs/`.
- Effort: Medium (requires a new validation script)
- Long-term prevention — should be done after Option A

## Technical Details
- Affected file: `docs/README.md`
- Canonical status enum in CLAUDE.md needs to be extended or specs need to be corrected

## Acceptance Criteria
- [ ] All existing specs appear in the README table with correct statuses
- [ ] All 5 ADRs appear in the Architecture Decisions section
- [ ] "Last validated" date updated
- [ ] Status values across all specs conform to the canonical enum (or enum extended)

## Work Log
- 2026-03-17: Identified by architecture-strategist and learnings-researcher agents in ce-review
