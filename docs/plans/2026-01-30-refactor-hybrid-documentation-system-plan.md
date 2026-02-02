---
title: Implement Hybrid Documentation System with docs/solutions/
type: refactor
date: 2026-01-30
---

# Implement Hybrid Documentation System with docs/solutions/

## Overview

Transform the inventory-app repository's fragmented issue tracking into a unified, searchable knowledge base while preserving GitHub Issues for active collaboration. The system will create a new `docs/solutions/` directory with YAML frontmatter-based solution documents, migrate 7 P0 production issues from TROUBLESHOOTING.md, implement git hooks for validation, and integrate with the learnings-researcher agent for programmatic search.

This consolidation addresses the current problem of 5 parallel tracking systems (GitHub Issues, TROUBLESHOOTING.md, feature_list.json, UI/UX audits, git history) that create information silos and prevent institutional knowledge from being easily discovered and reused.

## Problem Statement

### Current State

The inventory-app repository suffers from **documentation fragmentation** across 5 independent tracking systems:

1. **GitHub Issues** (17 open issues) - Active collaboration but poor searchability
2. **TROUBLESHOOTING.md** (7 production issues) - Production solutions but unstructured markdown
3. **feature_list.json** (1 known bug) - Structured tracking but isolated from workflow
4. **UI/UX Audit Reports** (13 findings) - Detailed analysis but separate from issue tracking
5. **Git Commit History** - Historical fixes but no structured documentation

**Symptoms of Fragmentation:**
- Developers spend hours re-solving the same problems (e.g., scanner infinite loops recurred 3 times)
- Production incident response is delayed (no quick reference to CSP blocking solutions)
- New team members struggle to understand production history
- Claude Code agents cannot access institutional knowledge during problem-solving
- Critical solutions exist but are buried in markdown files without search capability

**Technical Gaps:**
- No YAML frontmatter for filtering (category, severity, tags)
- No cross-references between systems (GitHub Issues don't link to TROUBLESHOOTING.md)
- No validation for documentation quality (incomplete entries, missing commit hashes)
- No search capability beyond grep/text search (unreliable for complex queries)
- No mechanism to prevent stale or duplicate documentation

### Root Cause Analysis

**Architectural Issue:** Documentation grew organically without a unified knowledge management strategy. Each tool serves a valid purpose (GitHub for collaboration, TROUBLESHOOTING for quick reference, feature_list for tracking), but they operate in isolation with no integration layer.

**Workflow Gap:** The "solve → document" workflow is manual and unenforced. Developers fix bugs but forget (or don't know how) to update documentation. Without validation and tooling, knowledge capture becomes sporadic and inconsistent.

**Searchability Gap:** Plain markdown files don't support structured queries. Finding "HIGH severity scanner issues from 2025" requires manually reading multiple files, which doesn't scale as the knowledge base grows.

**Data Integrity Gap:** Without validation, TROUBLESHOOTING.md and feature_list.json have outdated entries (e.g., "Image update not working" workaround that no longer applies).

### Business Impact

**Productivity Loss:** Estimated 2-4 hours per week per developer wasted on re-solving known problems. With 3 developers = 6-12 hours/week = 312-624 hours/year = ~$31k-62k/year (assuming $100/hr) in lost productivity.

**Onboarding Friction:** New developers require 2-3 weeks to become productive because they must manually excavate production history from disparate sources. With 2 new hires/year = 4-6 weeks of delayed productivity.

**Incident Response Risk:** Production incidents (e.g., CSP blocking scanner API) could be resolved 50% faster if solutions were immediately searchable, reducing downtime and customer impact.

**AI Agent Ineffectiveness:** The learnings-researcher agent (a key tool for preventing repeated mistakes) cannot function without structured docs/solutions/ data. This defeats the purpose of institutional knowledge capture.

### Motivation

**Primary Goal:** Consolidate issue tracking into a searchable knowledge base while preserving GitHub's collaborative workflow.

**Success Definition:** 90% of production issues have documented solutions within 7 days of resolution, and developers can find relevant solutions in <30 seconds via learnings-researcher.

**Long-term Vision:** Build a learning organization where every bug fix becomes institutional knowledge, preventing recurrence and accelerating problem-solving.

## Proposed Solution

Implement a **hybrid documentation system** with two complementary components:

### Component 1: docs/solutions/ Knowledge Base

Create a new directory (`docs/solutions/`) with domain-based subdirectories. Each solution document contains:

**YAML Frontmatter** (structured metadata):
```yaml
---
title: Clear, concise issue title
category: frontend | backend | infrastructure | security | ux
severity: HIGH | MEDIUM | LOW
date: YYYY-MM-DD
tags: [array, of, relevant, tags]
module: component-or-module-name
related_github_issue: number (if applicable)
status: resolved | deprecated
symptoms: [observable, symptom, list]
commit: git-hash (if fixed)
---
```

**Content Body** (markdown):
- Problem description
- Symptoms (observable behaviors)
- Root cause analysis
- Step-by-step solution
- Files changed (with line numbers)
- Prevention strategies

**Directory Structure:**
```
docs/solutions/
├── backend/              # Supabase, Airtable, API issues
├── frontend/             # React, UI components, scanner issues
├── infrastructure/       # PWA, Vercel, deployment issues
├── security/            # CSP, validation, auth issues
├── ux/                 # Accessibility, mobile, interaction issues
├── _template.md         # Template for new solutions
└── README.md            # Index and search guide
```

### Component 2: Git Hooks for Validation

Implement **pre-commit hooks** that validate docs/solutions/ files before allowing commits:

**Validations Performed:**
1. YAML syntax validity (parse frontmatter without errors)
2. Required fields presence (title, category, severity, date, status)
3. Enum value validation (category: [frontend, backend, ...], severity: [HIGH, MEDIUM, LOW])
4. GitHub Issue existence (if `related_github_issue` provided)
5. File path vs. category consistency (e.g., `docs/solutions/frontend/` must have `category: frontend`)
6. Date format validation (must be YYYY-MM-DD)

**Error Recovery:**
- Clear error messages with line numbers for YAML syntax errors
- Example values for invalid enum choices (e.g., "Allowed categories: frontend, backend, infrastructure, security, ux")
- GitHub CLI command suggestions for missing issues (e.g., "Run `gh issue create --title '...'` to create issue")
- Graceful degradation for offline mode (skip GitHub validation if `GITHUB_TOKEN` not set)

### Component 3: Migration & Archive

**Phase 1 Migration (P0 Issues):**
- Parse TROUBLESHOOTING.md and extract 7 production issues
- Infer category from symptoms and affected modules
- Map severity from impact descriptions (production-critical = HIGH)
- Validate commit hashes against git history
- Search GitHub for related issues (link if found, create placeholder if not)
- Create docs/solutions/{category}/{slug}.md files with YAML frontmatter
- Archive TROUBLESHOOTING.md to `docs/archive/troubleshooting.md`

**Archive Strategy:**
- Keep TROUBLESHOOTING.md in archive indefinitely (historical reference)
- Add redirect notice at top: "This content has moved to docs/solutions/"
- Create README in archive explaining migration date and rationale
- Update CLAUDE.md to reference docs/solutions/ instead of TROUBLESHOOTING.md

### Component 4: Learnings-Researcher Integration

The existing `learnings-researcher` skill (when created) will:

1. **Search** docs/solutions/ by parsing YAML frontmatter and body content
2. **Filter** results by category, severity, tags, module, symptoms
3. **Rank** results by relevance (exact tag match > partial match > recent date)
4. **Return** top 3 matches with summaries and file paths
5. **Handle** no results by suggesting: "No solutions found. Consider creating docs/solutions/ entry for this issue."

**Search Algorithm:**
- Parse all docs/solutions/*.md files
- Calculate relevance score:
  - Tag exact match: +10 points per tag
  - Category match: +5 points
  - Severity match: +3 points
  - Keyword in title: +8 points
  - Keyword in body: +3 points per occurrence
  - Recent date (last 6 months): +2 points
- Sort by score descending, return top 3
- If no matches with score > 0, return "No solutions found"

### Component 5: Cross-Reference Strategy

**GitHub Issues → docs/solutions/:**
- Add link to docs/solutions/ in GitHub Issue description
- Example: "Solution documented in docs/solutions/frontend/scanner-loop.md"

**docs/solutions/ → GitHub Issues:**
- Include `related_github_issue: 42` in YAML frontmatter
- Reference commit hashes if applicable

**feature_list.json Integration:**
- Deprecate "Known Issues" section after migration
- Add metadata field: `solutions_directory: "docs/solutions/"`
- Cross-reference from feature_list.json to docs/solutions/ README

**TROUBLESHOOTING.md Archive:**
- Add links to docs/solutions/ entries in archived file
- Maintain backward compatibility for external references

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer Workflow                        │
└──────────────────────┬────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐            ┌─────────────────┐
│ GitHub Issues  │            │  Code Fix       │
│ (Active)      │            │  (Direct work)  │
└───────┬───────┘            └────────┬────────┘
        │                             │
        └──────────────┬──────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Issue Resolved  │
              └───────┬──────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌──────────────────────┐   ┌─────────────────────────┐
│ Create docs/         │   │  Git Pre-Commit Hook    │
│ solutions/{cat}/     │   │  (Validation)           │
│ {slug}.md           │   └───────────┬─────────────┘
└────────┬────────────┘               │
         │                           │
         ▼                           ▼
┌──────────────────────┐   ┌─────────────────────────┐
│ Update GitHub Issue  │   │  Validation Errors?       │
│ with reference      │   │  (Reject commit)         │
└────────┬────────────┘   └───────────┬─────────────┘
         │                           │
         └───────────────┬───────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Close GitHub   │
              │  Issue          │
              └───────┬────────┘
                      │
                      ▼
              ┌──────────────────┐
              │  Commit Merged  │
              └──────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Learnings-Researcher Agent  │
        │ (Search & Discovery)        │
        └──────────────────────────────┘
```

**Data Flow:**

1. **Issue Creation:** GitHub Issue created (collaboration, discussion, assignees)
2. **Investigation & Fix:** Developer works on code, references existing docs/solutions/
3. **Solution Documentation:** Developer creates docs/solutions/ entry with YAML frontmatter
4. **Validation:** Git pre-commit hook validates YAML, fields, GitHub Issue link
5. **Cross-Reference:** GitHub Issue updated with docs/solutions/ link
6. **Archive:** Issue closed, solution searchable in knowledge base
7. **Discovery:** Future developers use learnings-researcher to find solutions

**Technology Stack:**

- **YAML Parsing:** `js-yaml` (Node.js library) or `yq` (bash tool) - TBD in ADR
- **Git Hooks:** Custom pre-commit bash script or pre-commit framework - TBD in ADR
- **GitHub API:** `gh` CLI tool (already installed in repo) for issue validation
- **Search:** File glob + regex (fast for <500 files) or ripgrep (faster for large scale)

### Implementation Phases

#### Phase 0: Planning & Architecture Decisions (2-3 days)

**Tasks:**

1. **Create ADR-0004: Git Hook Strategy**
   - Evaluate options: pre-commit vs. pre-push vs. GitHub Actions
   - Evaluate implementations: bash script vs. Node.js vs. pre-commit framework
   - Document decision with rationale (performance, maintenance, team adoption)
   - **Deliverable:** `docs/adrs/adr-0004-git-hook-strategy.md`

2. **Define GitHub API Token Management**
   - Decide: personal access tokens (PAT) per developer vs. shared bot account vs. GitHub App
   - Create `.env.example` with `GITHUB_TOKEN=your_pat_here`
   - Document setup instructions for team members
   - Define token permissions needed (read-only issues? write?)
   - **Deliverable:** `docs/plans/github-token-management.md`

3. **Design Duplicate Prevention Strategy**
   - Define unique identifier: `related_github_issue` + filename slug
   - Implement pre-commit check: search for existing solutions with same issue
   - Define conflict resolution: if duplicate found, reject commit with message
   - **Deliverable:** Design doc in plan appendix

4. **Create YAML Frontmatter Schema Documentation**
   - Document all fields, types, allowed values, examples
   - Define controlled vocabulary for categories (frontend, backend, etc.)
   - Define severity levels with guidelines (HIGH = production-critical, etc.)
   - Define tag taxonomy (controlled or free-form? recommend: free-form with examples)
   - **Deliverable:** `docs/solutions/_template.md`

5. **Design Error Messages and User Recovery**
   - Create error message templates for each validation failure type
   - Mockup CLI output examples (good UX, clear instructions)
   - Define recovery commands for each error (e.g., `gh issue create` for missing issue)
   - **Deliverable:** Error message specification in plan appendix

**Success Criteria:**
- ✅ ADR-0004 created and reviewed
- ✅ GitHub token strategy documented and tested
- ✅ YAML schema template created with examples for each category
- ✅ Error messages mockups reviewed by 1 developer for UX clarity

**Estimated Effort:** 2-3 days

---

#### Phase 1: Migration (P0 Issues Only) (3-4 days)

**Tasks:**

1. **Create Migration Script**
   - Language: JavaScript/Node.js (good for parsing and writing)
   - Input: `TROUBLESHOOTING.md`
   - Output: 7 docs/solutions/{category}/{slug}.md files
   - **Script Logic:**
     - Parse TROUBLESHOOTING.md (use marked or similar markdown parser)
     - Extract issue sections by `## Issue:` headers
     - For each issue:
       - Infer category from symptoms and file paths
       - Map severity from impact description (production-critical → HIGH)
       - Extract commit hash (validate against `git log`)
       - Extract symptoms, root cause, solution, prevention sections
       - Search GitHub for related issue: `gh issue list --search "{title}"`
       - Generate filename: slugify title → `scanner-infinite-loop.md`
       - Write YAML frontmatter + markdown body
     - Generate migration report: total migrated, skipped (incomplete data), warnings
   - **Error Handling:**
     - If commit hash not found in git: skip hash, add warning to report
     - If category inference confidence < 80%: skip migration, add to report for manual review
     - If severity unclear: default to MEDIUM, add warning
   - **Deliverable:** `scripts/migrate-solutions.js`

2. **Dry-Run Migration and Review**
   - Run migration script with `--dry-run` flag (don't write files)
   - Output YAML frontmatter for all 7 issues to console
   - Manual review of category/severity inferences
   - Adjust script based on review findings
   - **Deliverable:** Migration report document (`docs/plans/migration-report.md`)

3. **Execute Migration**
   - Run migration script with `--execute` flag
   - Verify 7 files created in correct directories
   - Validate YAML syntax: `js-yaml docs/solutions/**/*.md`
   - Validate all required fields present
   - **Deliverable:** 7 docs/solutions/ files with YAML frontmatter

4. **Archive TROUBLESHOOTING.md**
   - Move `TROUBLESHOOTING.md` → `docs/archive/troubleshooting.md`
   - Add redirect notice at top:
     ```markdown
     > ⚠️ **Archived Content** - This file has been moved to `docs/solutions/`.
     > See [docs/solutions/README.md](../../solutions/README.md) for the knowledge base.
     > Archived on: 2026-01-30
     ```
   - Create `docs/archive/README.md` explaining archive structure
   - **Deliverable:** Archived TROUBLESHOOTING.md with redirect notice

5. **Update CLAUDE.md**
   - Remove references to TROUBLESHOOTING.md
   - Add section: "Documentation - docs/solutions/ Knowledge Base"
   - Document new workflow: create GitHub Issue → resolve → create docs/solutions/ entry
   - Add link to docs/solutions/_template.md
   - **Deliverable:** Updated CLAUDE.md

6. **Update feature_list.json**
   - Deprecate "Known Issues" section (comment out or remove)
   - Add metadata field: `"solutions_directory": "docs/solutions/"`
   - Add note in claude-progress.md about deprecation
   - **Deliverable:** Updated feature_list.json

**Success Criteria:**
- ✅ 7 P0 issues migrated to docs/solutions/ with valid YAML
- ✅ TROUBLESHOOTING.md archived with redirect notice
- ✅ CLAUDE.md updated with docs/solutions/ workflow
- ✅ feature_list.json known bugs section deprecated
- ✅ Migration report shows 0 errors, <2 warnings

**Estimated Effort:** 3-4 days

---

#### Phase 2: Git Hooks Implementation (5-7 days)

**Tasks:**

1. **Implement Git Hook Infrastructure**
   - Create `.git/hooks/pre-commit` script (bash or Node.js - based on ADR decision)
   - Install hook: `git config core.hooksPath .githooks`
   - Make script executable: `chmod +x .githooks/pre-commit`
   - Add `.githooks/` to git (team can share hooks)
   - **Deliverable:** Working pre-commit hook infrastructure

2. **Implement YAML Validation**
   - Parse YAML frontmatter from changed docs/solutions/ files
   - Check syntax: `js-yaml.parse()` should not throw
   - Check required fields: title, category, severity, date, status
   - Validate enum values: category ∈ [frontend, backend, infrastructure, security, ux], severity ∈ [HIGH, MEDIUM, LOW], status ∈ [resolved, deprecated]
   - Validate date format: regex `^\d{4}-\d{2}-\d{2}$`
   - **Error Messages:**
     - Invalid YAML: `Error: Invalid YAML at line 5: expected mapping key, found scalar`
     - Missing field: `Error: Missing required field 'category'. Allowed values: frontend, backend, infrastructure, security, ux`
     - Invalid enum: `Error: Invalid severity 'CRITICAL'. Allowed values: HIGH, MEDIUM, LOW`
   - **Deliverable:** YAML validation logic in pre-commit hook

3. **Implement GitHub Issue Validation**
   - Check if `related_github_issue` field present
   - If yes, run: `gh issue view {issue_number} --json title,state` (timeout 5s)
   - Validate issue exists (HTTP 200, not 404)
   - Validate issue state is open (can link to open or closed issues, but must exist)
   - **Graceful Degradation:**
     - If GitHub API times out (>5s): skip validation, add warning "GitHub API unreachable - skipping issue validation"
     - If `GITHUB_TOKEN` not set: skip validation, add warning "No GitHub token - skipping issue validation"
   - **Error Message:** `Error: GitHub Issue #999999 not found. Run 'gh issue create --title "..."' to create issue`
   - **Deliverable:** GitHub Issue validation logic

4. **Implement File Path Validation**
   - Check file path: `docs/solutions/{category}/{filename}.md`
   - Extract directory name (e.g., `frontend`)
   - Validate: directory name matches `category` field in YAML
   - **Error Message:** `Error: File path 'docs/solutions/backend/scanner-loop.md' has category 'frontend'. Move file to docs/solutions/frontend/ or update YAML category to 'backend'`
   - **Deliverable:** File path validation logic

5. **Implement Performance Optimization**
   - Only validate changed docs/solutions/ files: `git diff --cached --name-only --diff-filter=ACMR | grep '^docs/solutions/'`
   - Cache GitHub Issue state in `.git/gh-issues-cache.json` (gitignored)
   - Parallelize YAML parsing if >5 files (use async/await)
   - Target: <3s validation for typical commits (1-2 files changed)
   - **Deliverable:** Optimized validation logic

6. **Add Git Hook Tests**
   - Create test directory: `tests/git-hooks/`
   - **Unit Tests:**
     - Test YAML parsing with valid/invalid/malformed YAML
     - Test required field validation (missing, extra fields)
     - Test enum validation (valid, invalid values)
     - Test date format validation (valid, invalid formats)
   - **Integration Tests:**
     - Test GitHub Issue validation (mock `gh` command responses)
     - Test file path validation (match, mismatch)
     - Test offline mode (no GITHUB_TOKEN, API timeout)
   - **End-to-End Tests:**
     - Create docs/solutions/ file with valid YAML → commit succeeds
     - Create docs/solutions/ file with missing field → commit rejected
     - Create docs/solutions/ file with invalid category → commit rejected
   - **Deliverable:** Test suite with >80% coverage

7. **Document Git Hook Setup**
   - Create `docs/git-hooks-setup.md`:
     - How to install hooks: `git config core.hooksPath .githooks`
     - How to set up GitHub token: export GITHUB_TOKEN
     - How to bypass hooks: `git commit --no-verify` (discouraged)
     - How to debug hooks: run `.githooks/pre-commit` manually
   - **Deliverable:** Setup documentation

**Success Criteria:**
- ✅ Pre-commit hook validates all 5 validation types
- ✅ Invalid commits are rejected with clear error messages
- ✅ Valid commits pass validation in <3s
- ✅ Offline mode works (graceful degradation)
- ✅ Test coverage >80%
- ✅ Setup documentation reviewed by 1 developer

**Estimated Effort:** 5-7 days

---

#### Phase 3: Learnings-Researcher Integration (3-4 days)

**Tasks:**

1. **Create Learnings-Researcher Skill**
   - File: `.config/opencode/skills/learnings-researcher.md`
   - **Search Logic:**
     - Parse all `docs/solutions/**/*.md` files
     - Extract YAML frontmatter (title, category, severity, tags, symptoms)
     - Extract body content (problem, solution, prevention)
     - Calculate relevance score based on query:
       - Exact tag match: +10 per tag
       - Category match: +5
       - Severity match: +3
       - Keyword in title: +8
       - Keyword in body: +3 per occurrence
       - Recent date (<6 months): +2
     - Sort by score descending
     - Return top 3 matches with:
       - File path
       - Title
       - Category/Severity
       - Summary (first 2 lines of problem section)
   - **No Results Handling:**
     - If score = 0 for all matches, return: "No solutions found in docs/solutions/. Consider creating a new entry for this issue."
     - Suggest template location: `docs/solutions/_template.md`
   - **Deliverable:** learnings-researcher skill file

2. **Test Learnings-Researcher with Migrated Solutions**
   - **Test Queries with Expected Results:**
     - Query: "scanner loop" → Returns `scanner-infinite-loop.md` (P0 issue)
     - Query: "CSP blocking" → Returns `csp-blocking-api.md` (P0 issue)
     - Query: "black screen" → Returns both CSP issue AND service worker issue (2 matches)
     - Query: "chunk load" → Returns `chunk-load-failure.md` (P0 issue)
     - Query: "random symptoms xyz" → Returns "No solutions found" (no matches)
   - **Edge Cases:**
     - Empty query: Return all solutions sorted by date desc
     - Category-only query: Return all solutions in category
     - Severity-only query: Return all HIGH severity solutions
   - **Relevance Testing:**
     - Manual review: Are top 3 results actually relevant?
     - Adjust scoring algorithm if poor results
   - **Deliverable:** Test results document (`docs/test-reports/learnings-researcher-test.md`)

3. **Performance Testing**
   - Test search speed with 7 files (current), 100 files (simulated future), 500 files (future scale)
   - Target: <1s for 7 files, <3s for 100 files, <5s for 500 files
   - Optimize: if slow, switch from file glob + regex to ripgrep or search-index
   - **Deliverable:** Performance test results

**Success Criteria:**
- ✅ Learnings-researcher returns relevant top 3 matches for test queries
- ✅ No results handling provides helpful guidance
- ✅ Search <1s for 7 files, <3s for 100 files
- ✅ Test queries: 90% relevance (manual review)

**Estimated Effort:** 3-4 days

---

#### Phase 4: Workflow & Integration (4-5 days)

**Tasks:**

1. **Create Onboarding Documentation**
   - **Template:** `docs/solutions/_template.md` with:
     - Full YAML schema (all fields, types, examples)
     - Example for each category (frontend, backend, etc.)
     - Markdown content template (Problem, Symptoms, Root Cause, Solution, Files Changed, Prevention)
   - **Guide:** `docs/solutions/README.md` with:
     - Overview of docs/solutions/ system
     - When to create docs/solutions/ entries (every resolved issue? only critical issues?)
     - How to choose category (mapping: scanner → frontend, Supabase → backend, etc.)
     - How to choose severity (HIGH = production-critical, MEDIUM = affects user experience, LOW = dev productivity)
     - How to create docs/solutions/ entry (step-by-step with examples)
     - How to use learnings-researcher agent
     - FAQ (e.g., "What if no GitHub Issue?", "Can I skip docs for trivial fixes?")
   - **Deliverable:** Template + README documentation

2. **Create docs/solutions/ README Index**
   - File: `docs/solutions/README.md`
   - **Sections:**
     - Overview (what is docs/solutions/?)
     - Quick Start (how to create your first solution doc)
     - Search Guide (how to find solutions manually)
     - Template Reference (link to _template.md)
     - FAQ
     - Index by Category (table of all solutions by category)
   - **Index Table:**
     ```
     | Category | Solution | Severity | Date |
     |----------|-----------|----------|------|
     | Frontend | Scanner Infinite Loop | HIGH | 2025-12-11 |
     | Security | CSP Blocking API Calls | HIGH | 2025-12-10 |
     ```
   - **Deliverable:** Comprehensive README with index

3. **Update CLAUDE.md Integration**
   - Add section: "Documentation - docs/solutions/ Knowledge Base"
   - Document workflow:
     1. Issue reported → Create GitHub Issue
     2. Issue investigated → Add tags, assignee, milestone
     3. Issue resolved → Create docs/solutions/ entry (with YAML validation)
     4. Update GitHub Issue with docs/solutions/ link
     5. Close GitHub Issue
     6. Future: learnings-researcher agent can find this solution
   - Add links: docs/solutions/_template.md, docs/solutions/README.md, docs/git-hooks-setup.md
   - Update bug fix workflow section to include docs/solutions/ step
   - **Deliverable:** Updated CLAUDE.md

4. **Update feature_list.json Integration**
   - Deprecate "Known Issues" section (comment out: "// Deprecated: see docs/solutions/")
   - Add metadata: `"solutions_directory": "docs/solutions/"`
   - Update feature_list.json README to reference docs/solutions/
   - **Deliverable:** Updated feature_list.json

5. **Define Metrics and Success Criteria**
   - **Metrics to Track:**
     - Docs created per week: `git log --since="1 week ago" --name-only --pretty=format: docs/solutions/ | sort | uniq -c`
     - Search success rate: track learnings-researcher usage (add logging to agent)
     - Bug recurrence: compare GitHub issues before/after system launch (track "same issue reopened")
     - Git hook rejection rate: count rejected commits (add counter in pre-commit hook)
   - **Success Criteria:**
     - 90% of production issues have documented solutions within 7 days of resolution
     - Developers can find relevant solutions in <30 seconds via learnings-researcher
     - <10% of commits rejected by git hooks (indicates high compliance)
     - Bug recurrence reduced by 50% after 6 months
   - **Deliverable:** Metrics dashboard (simple markdown report or JSON file updated weekly)

6. **Create Backup Strategy**
   - **Export Script:** `scripts/export-solutions.js`
     - Input: docs/solutions/**/*.md
     - Output: docs/solutions/export/solutions-YYYY-MM-DD.json
     - Run weekly via cron or GitHub Actions
   - **GitHub Mirror (Optional):** Consider one-way sync from docs/solutions/ to GitHub Issues (create "Solution #1", "Solution #2" issues as backup)
   - **Git Remote Backup:** Ensure remote backup (GitHub) is always pushed (add to workflow checklist)
   - **Deliverable:** Export script + GitHub Actions workflow (if using mirror)

7. **Create Rollback Procedure**
   - If migration script crashes mid-migration:
     - Manually delete partially created docs/solutions/ files
     - Re-run migration script
     - Review migration report for errors
   - If git hook bug blocks all commits:
     - Bypass hook: `git commit --no-verify`
     - Fix hook logic
     - Test with dummy commit
     - Re-enable hook
   - If docs/solutions/ corrupted:
     - Restore from export JSON: `scripts/import-solutions.js`
     - Restore from git history: `git checkout HEAD~1 -- docs/solutions/`
   - **Deliverable:** Rollback procedure document

**Success Criteria:**
- ✅ Onboarding documentation reviewed by 1 new developer (clarity check)
- ✅ CLAUDE.md updated with workflow
- ✅ Metrics dashboard created with baseline data
- ✅ Export script tested and creates valid JSON
- ✅ Rollback procedures documented

**Estimated Effort:** 4-5 days

---

### Alternative Approaches Considered

#### Approach A: Unified Compound-Docs (Complete GitHub Replacement)

**Description:** Remove GitHub Issues entirely, use only docs/solutions/ for all issue tracking. Comments would be inline in markdown files.

**Pros:**
- Single source of truth, no duplication
- Simpler architecture (no cross-references needed)
- Full YAML frontmatter searchability for all issues

**Cons:**
- Loses GitHub's native collaboration (comments, assignees, milestones, PR references)
- No native issue tracking (open/closed, labels, projects)
- No third-party integrations (Slack notifications, CI/CD links)
- Team adoption friction (everyone uses GitHub Issues)

**Rejected Because:**
- GitHub Issues provide critical collaboration features that can't be easily replicated
- Team already has established GitHub workflow
- Loss of assignees, labels, and project boards would hurt productivity
- Hybrid approach (Approach B) provides best of both worlds

---

#### Approach B: Template-First (Minimal Migration)

**Description:** Create docs/solutions/ directory structure and template, but don't migrate existing issues. Start documenting new issues in compound-docs format, slowly consolidate historical issues on-demand.

**Pros:**
- Fastest to implement (no migration script needed)
- Zero risk of losing existing documentation during migration
- Incremental approach allows learning and refinement of format

**Cons:**
- Doesn't achieve "complete consolidation" goal from brainstorm
- Historical issues remain scattered across 5 systems
- Search value is limited until significant migration occurs
- Team may continue using old habits (TROUBLESHOOTING.md, etc.)

**Rejected Because:**
- User explicitly requested "complete documentation audit + consolidation"
- 7 P0 issues in TROUBLESHOOTING.md are high-value and deserve migration
- Without migration, learnings-researcher agent has minimal data to search

---

#### Approach C: Web UI for Search (Browser-Based)

**Description:** Add a web interface (e.g., Docusaurus, VuePress, or custom React app) to browse and search docs/solutions/ by category, tags, severity.

**Pros:**
- Visual search interface (filters, sort, preview)
- Better UX than CLI-based search
- Can host as static site on Vercel

**Cons:**
- Adds complexity (build step, deployment, maintenance)
- Additional dependency (framework, build tooling)
- User explicitly chose "agent-only (no UI)" in brainstorm

**Rejected Because:**
- User decided to rely on learnings-researcher agent for search
- Web UI is nice-to-have, not critical for MVP
- learnings-researcher provides programmatic access (better for agents)
- Can add web UI in future if manual browsing is needed

---

#### Approach D: Pre-Push Hooks Instead of Pre-Commit

**Description:** Use pre-push hooks (run before `git push`) instead of pre-commit hooks (run before `git commit`).

**Pros:**
- Faster commits (validation runs once per push, not per commit)
- Less intrusive to developer workflow
- Can validate all changes at once (more comprehensive checks)

**Cons:**
- Validation happens too late (after commits made locally)
- Cannot reject bad commits locally (only blocks remote push)
- Fails on network failures (pre-push runs when pushing to remote)
- Team may forget to fix issues until push time (bad UX)

**Rejected Because:**
- Pre-commit provides immediate feedback (better developer experience)
- Catches errors before commits are made (fewer bad commits in history)
- Pre-push fails on network issues (blocks remote push when offline)

## Acceptance Criteria

### Functional Requirements

#### Phase 0: Planning & Architecture

- [ ] **ADR-0004 created** with git hook strategy decision documented
- [ ] **GitHub token management** documented with setup instructions
- [ ] **Duplicate prevention strategy** designed with conflict resolution
- [ ] **YAML frontmatter schema** documented with examples for each category
- [ ] **Error message templates** created for each validation failure type

#### Phase 1: Migration (P0 Issues)

- [ ] **Migration script** created and tested (dry-run + execute)
- [ ] **7 P0 issues migrated** to docs/solutions/ with valid YAML
- [ ] **Migration report** generated with 0 errors, <2 warnings
- [ ] **TROUBLESHOOTING.md archived** to docs/archive/ with redirect notice
- [ ] **CLAUDE.md updated** to reference docs/solutions/ instead of TROUBLESHOOTING.md
- [ ] **feature_list.json known bugs section** deprecated with reference to docs/solutions/

**Migration Validation:**
- [ ] All 7 files have valid YAML syntax (no parse errors)
- [ ] All 7 files have required fields (title, category, severity, date, status)
- [ ] All categories are valid enum values (frontend, backend, infrastructure, security, ux)
- [ ] All severities are valid enum values (HIGH, MEDIUM, LOW)
- [ ] All dates are in YYYY-MM-DD format
- [ ] All commit hashes are valid (exist in git log or omitted)
- [ ] All `related_github_issue` values are valid (issue exists or omitted)

#### Phase 2: Git Hooks

- [ ] **Pre-commit hook** installed and executable
- [ ] **YAML validation** implemented for syntax, required fields, enum values, date format
- [ ] **GitHub Issue validation** implemented with graceful degradation (offline mode)
- [ ] **File path validation** implemented (path matches category field)
- [ ] **Performance target** met: <3s validation for 1-2 files changed
- [ ] **Error messages** are clear and actionable with recovery commands
- [ ] **Test suite** created with >80% coverage
- [ ] **Setup documentation** created and reviewed

**Git Hook Validation Scenarios:**
- [ ] Valid YAML with all fields → commit succeeds
- [ ] Missing required field → commit rejected with "Missing field 'X'" message
- [ ] Invalid enum value → commit rejected with "Allowed values: X, Y, Z" message
- [ ] Malformed YAML → commit rejected with line number and syntax error
- [ ] Invalid date format → commit rejected with regex error
- [ ] Non-existent GitHub Issue → commit rejected with "gh issue create" suggestion
- [ ] File path mismatch → commit rejected with "Move file to docs/solutions/{category}/" message
- [ ] Offline mode (no GITHUB_TOKEN) → commit succeeds with warning
- [ ] GitHub API timeout → commit succeeds with warning
- [ ] Commit with `--no-verify` → bypasses all validations (documented)

#### Phase 3: Learnings-Researcher

- [ ] **Learnings-researcher skill** created with search logic
- [ ] **Relevance scoring** implemented (tag match, category, severity, keywords, date)
- [ ] **Top 3 matches** returned with file path, title, summary
- [ ] **No results handling** provides helpful guidance
- [ ] **Test queries** return relevant results (90% relevance, manual review)
- [ ] **Performance targets** met: <1s for 7 files, <3s for 100 files

**Learnings-Researcher Test Queries:**
- [ ] Query "scanner loop" → Returns scanner-infinite-loop.md
- [ ] Query "CSP blocking" → Returns csp-blocking-api.md
- [ ] Query "black screen" → Returns CSP issue AND service worker issue (2 matches)
- [ ] Query "chunk load" → Returns chunk-load-failure.md
- [ ] Query "random symptoms xyz" → Returns "No solutions found" with guidance

#### Phase 4: Workflow & Integration

- [ ] **Onboarding documentation** created (template + README + FAQ)
- [ ] **docs/solutions/README** created with index table by category
- [ ] **CLAUDE.md updated** with docs/solutions/ workflow
- [ ] **feature_list.json updated** with deprecated known bugs and metadata
- [ ] **Metrics dashboard** created with baseline data
- [ ] **Export script** created and tested (generates valid JSON)
- [ ] **Rollback procedures** documented

**Onboarding Validation:**
- [ ] 1 new developer reviews onboarding documentation and confirms clarity
- [ ] Template has examples for all 5 categories
- [ ] FAQ addresses "What if no GitHub Issue?" and "Can I skip docs for trivial fixes?"

---

### Non-Functional Requirements

#### Performance

- [ ] **Git hook validation** <3s for typical commits (1-2 files changed)
- [ ] **Learnings-researcher search** <1s for 7 files, <3s for 100 files
- [ ] **Migration script** completes in <30s for 7 issues
- [ ] **Export script** completes in <10s for 100 files

#### Usability

- [ ] **Error messages** are clear, actionable, and provide recovery commands
- [ ] **Onboarding documentation** is beginner-friendly (no jargon without explanation)
- [ ] **learnings-researcher** returns relevant results (90% manual approval)
- [ ] **docs/solutions/ README** is searchable and scannable

#### Reliability

- [ ] **Git hooks** never block valid commits (false rejection rate <1%)
- [ ] **Graceful degradation** works when GitHub API is offline
- [ ] **Migration script** handles incomplete TROUBLESHOOTING.md entries (no crashes)
- [ ] **Backup and rollback** procedures tested and documented

#### Maintainability

- [ ] **Code is documented** with inline comments explaining logic
- [ ] **Test coverage** >80% for git hooks and learnings-researcher
- [ ] **ADR-0004** documents git hook architecture decision
- [ ] **Error message templates** are centralized (not hardcoded in multiple places)

#### Security

- [ ] **GitHub tokens** stored in .env (gitignored), not hardcoded
- [ ] **GitHub API calls** use read-only permissions (no write access needed for validation)
- [ ] **Pre-commit hooks** validated for security (no code injection risks)
- [ ] **Export script** sanitizes YAML before JSON export (no code execution)

---

### Quality Gates

#### Before Phase 1 (Migration)

- [ ] ADR-0004 reviewed and approved
- [ ] YAML schema documented with examples
- [ ] Migration script tested in dry-run mode
- [ ] TROUBLESHOOTING.md backup created (copy before migration)

#### Before Phase 2 (Git Hooks)

- [ ] Migration completed successfully (all 7 files valid)
- [ ] Test suite created with >80% coverage
- [ ] Error messages mockups reviewed by 1 developer
- [ ] GitHub token strategy documented

#### Before Phase 3 (Learnings-Researcher)

- [ ] Git hooks validated and tested
- [ ] All 7 migrated solutions validated
- [ ] Test query results reviewed (90% relevance)
- [ ] Performance targets met (<3s for 100 files)

#### Before Phase 4 (Integration)

- [ ] Learnings-researcher tested with migrated solutions
- [ ] Onboarding documentation drafted
- [ ] Metrics dashboard created with baseline
- [ ] Export script tested

#### Before Launch

- [ ] All phases completed (0 critical issues remaining)
- [ ] 1 new developer onboards using docs/solutions/ workflow
- [ ] Rollback procedures tested (simulate failure, rollback, verify)
- [ ] CLAUDE.md updated and reviewed
- [ ] Git commit message: `feat: implement hybrid documentation system with docs/solutions/`

---

## Success Metrics

### Primary Metrics (Business Impact)

**1. Documentation Coverage**
- **Metric:** % of production issues with documented solutions in docs/solutions/
- **Target:** 90% within 7 days of issue resolution
- **Measurement:** `(docs created in last 30 days / issues closed in last 30 days) * 100`
- **Data Source:** Git log (docs/solutions/ files created) + GitHub API (issues closed)
- **Success:** ≥90% after 3 months

**2. Search Effectiveness**
- **Metric:** % of queries where learnings-researcher returns relevant solutions
- **Target:** 90% relevance (manual review of top 3 results)
- **Measurement:** Weekly manual review of 10 sample queries
- **Data Source:** learnings-researcher logs + manual review
- **Success:** ≥90% after 1 month

**3. Bug Recurrence Reduction**
- **Metric:** % of issues that are "re-opened" or "duplicates" of previous issues
- **Target:** 50% reduction compared to 6 months before system launch
- **Measurement:** (duplicate issues in last 6 months / total issues in last 6 months) * 100
- **Data Source:** GitHub API (issue labels: "duplicate", issue re-open events)
- **Success:** <50% of pre-launch rate after 6 months

**4. Developer Productivity**
- **Metric:** Average time to find and apply documented solutions
- **Target:** <30 seconds per search
- **Measurement:** Manual time tracking (5 developers, 10 searches each over 1 month)
- **Data Source:** Survey or observation
- **Success:** <30s average after 2 months

---

### Secondary Metrics (Adoption & Quality)

**5. Git Hook Compliance**
- **Metric:** % of commits rejected by pre-commit hooks
- **Target:** <10% rejection rate (indicates high compliance)
- **Measurement:** (rejected commits / total commits) * 100
- **Data Source:** Pre-commit hook counter (add logging)
- **Success:** <10% after 1 month

**6. Documentation Velocity**
- **Metric:** Number of docs/solutions/ entries created per week
- **Target:** 3-5 entries per week (steady growth)
- **Measurement:** `git log --since="1 week ago" --name-only --pretty=format: docs/solutions/ | sort | uniq -c`
- **Data Source:** Git log
- **Success:** 3-5 entries/week after 1 month

**7. Team Adoption**
- **Metric:** % of developers who have created at least 1 docs/solutions/ entry
- **Target:** 100% adoption (all developers participate)
- **Measurement:** `(unique authors of docs/solutions/ files / total developers) * 100`
- **Data Source:** Git blame on docs/solutions/ files
- **Success:** 100% after 3 months

**8. Knowledge Base Quality**
- **Metric:** % of docs/solutions/ files with complete sections (Problem, Symptoms, Root Cause, Solution, Prevention)
- **Target:** 95% complete
- **Measurement:** Automated check (parse markdown, check for section headers)
- **Data Source:** docs/solutions/ files
- **Success:** ≥95% after 2 months

---

### Technical Metrics (Performance & Reliability)

**9. Git Hook Performance**
- **Metric:** Average validation time per commit
- **Target:** <3 seconds for typical commits (1-2 files changed)
- **Measurement:** Pre-commit hook timing log (add `time` command)
- **Data Source:** Hook execution logs
- **Success:** <3s average after 1 week

**10. Learnings-Researcher Performance**
- **Metric:** Search time for query across 100 files
- **Target:** <3 seconds
- **Measurement:** Performance test suite (simulated 100 files)
- **Data Source:** Performance test logs
- **Success:** <3s for 100 files

**11. Validation Accuracy**
- **Metric:** False positive rate (valid commits rejected)
- **Target:** <1% false rejection rate
- **Measurement:** (valid commits rejected / total rejected commits) * 100
- **Data Source:** Pre-commit hook logs + manual review
- **Success:** <1% after 1 month

**12. Offline Reliability**
- **Metric:** % of commits that succeed when GitHub API is offline
- **Target:** 100% (graceful degradation)
- **Measurement:** Test commits with no GITHUB_TOKEN set
- **Data Source:** Manual testing
- **Success:** 100% after Phase 2 completion

---

### Metric Dashboard

Create `docs/plans/metrics-dashboard.md` updated weekly:

```markdown
# Hybrid Documentation System - Metrics Dashboard

**Last Updated:** 2026-02-06

## Primary Metrics

| Metric | Target | Current | Status | Trend |
|--------|--------|---------|--------|
| Documentation Coverage | 90% | 85% | ⚠️ | 📈 |
| Search Effectiveness | 90% | 88% | ⚠️ | 📈 |
| Bug Recurrence Reduction | -50% | -20% | ❌ | ➡️ |
| Developer Productivity | <30s | 25s | ✅ | 📈 |

## Secondary Metrics

| Metric | Target | Current | Status | Trend |
|--------|--------|---------|--------|
| Git Hook Compliance | <10% | 8% | ✅ | 📈 |
| Documentation Velocity | 3-5/wk | 4/wk | ✅ | ➡️ |
| Team Adoption | 100% | 75% | ⚠️ | 📈 |
| Knowledge Base Quality | 95% | 92% | ⚠️ | 📈 |

## Technical Metrics

| Metric | Target | Current | Status | Trend |
|--------|--------|---------|--------|
| Git Hook Performance | <3s | 2.1s | ✅ | 📈 |
| Learnings-Researcher Performance | <3s (100 files) | 1.8s | ✅ | 📈 |
| Validation Accuracy | <1% | 0.5% | ✅ | 📈 |
| Offline Reliability | 100% | 100% | ✅ | ➡️ |

Legend: ✅ On Target | ⚠️ Near Target | ❌ Below Target | 📈 Improving | 📉 Declining | ➡️ Stable
```

---

## Dependencies & Prerequisites

### External Dependencies

**1. Node.js & npm**
- **Required:** Node.js v18+, npm v9+
- **Why:** Migration script, export script use JavaScript/Node.js
- **Install:** Already in use (project uses Vite, npm)

**2. js-yaml Library**
- **Required:** js-yaml npm package
- **Why:** YAML parsing for git hooks and migration script
- **Install:** `npm install js-yaml --save-dev`
- **Alternative:** Use bash `yq` tool (lighter, but Node.js preferred for consistency)

**3. GitHub CLI (gh)**
- **Required:** gh CLI v2.40+
- **Why:** GitHub API validation in git hooks
- **Install:** Already in use (project uses gh for GitHub operations)
- **Config:** Requires GitHub personal access token (PAT) with `repo` scope

**4. Pre-commit Framework (Optional)**
- **Required:** pre-commit framework (Python-based) OR custom bash scripts
- **Why:** Manages git hooks, validates files
- **Install:** `brew install pre-commit` (macOS) or `pip install pre-commit` (Python)
- **Alternative:** Custom bash scripts in `.githooks/` directory (simpler, less features)

**5. Shell/Bash**
- **Required:** Bash 5.0+
- **Why:** Git hooks written in bash (or Node.js per ADR decision)
- **Install:** Already available on all developer machines

---

### Internal Dependencies

**1. TROUBLESHOOTING.md (Pre-Migration)**
- **Required:** Current TROUBLESHOOTING.md file
- **Why:** Source data for migration (7 P0 issues)
- **Action:** Backup before migration (copy to docs/archive/troubleshooting-pre-migration.md)

**2. GitHub Issues**
- **Required:** Existing GitHub Issues for cross-referencing
- **Why:** Migration script searches for related issues
- **Action:** Ensure repo has GitHub integration configured

**3. Learnings-Researcher Skill**
- **Required:** `.config/opencode/skills/learnings-researcher.md`
- **Why:** Agent search functionality
- **Action:** Create skill file in Phase 3

**4. CLAUDE.md**
- **Required:** Current CLAUDE.md
- **Why:** Update workflow documentation
- **Action:** Modify to reference docs/solutions/

**5. feature_list.json**
- **Required:** Current feature_list.json
- **Why:** Deprecate "Known Issues" section
- **Action:** Modify JSON structure

---

### Team Dependencies

**1. Developer Onboarding**
- **Required:** 1-2 developers to review onboarding documentation
- **Why:** Validate clarity and completeness
- **Timeline:** During Phase 4 (4-5 days)

**2. GitHub Token Setup**
- **Required:** All developers to set GITHUB_TOKEN environment variable
- **Why:** GitHub API validation in git hooks
- **Timeline:** Before Phase 2 launch (document setup in Phase 0)

**3. Git Hooks Installation**
- **Required:** All developers to run `git config core.hooksPath .githooks`
- **Why:** Enable pre-commit validation
- **Timeline:** After Phase 2 completion (document in setup guide)

**4. Testing Participation**
- **Required:** 1-2 developers to test git hooks and learnings-researcher
- **Why:** Validate functionality and UX
- **Timeline:** During Phase 2 and Phase 3

---

### Technology Constraints

**1. No Database**
- **Constraint:** Cannot use external database (PostgreSQL, MongoDB, etc.)
- **Reasoning:** Keep system simple, use markdown files only
- **Workaround:** Use file glob + regex for search, upgrade to SQLite if slow

**2. No Web Server**
- **Constraint:** Cannot deploy web server for search UI
- **Reasoning:** User chose agent-only search, no UI needed
- **Workaround:** learnings-researcher agent provides programmatic access

**3. Git Hooks Only**
- **Constraint:** Cannot use CI/CD pipelines (GitHub Actions) for validation
- **Reasoning:** Pre-commit hooks provide immediate feedback
- **Workaround:** Add optional GitHub Actions workflow for remote validation

**4. Offline Support**
- **Constraint:** System must work offline (no GitHub API)
- **Reasoning:** Developers work on planes, trains, without internet
- **Workaround:** Graceful degradation (skip GitHub validation with warning)

---

### Blockers & Risks

**Blocker 1: GitHub API Token Management**
- **Risk:** Security if tokens hardcoded or stored improperly
- **Mitigation:** Use .env file, document setup, never commit tokens
- **Timeline:** Address in Phase 0 (create ADR)

**Blocker 2: Git Hook Performance**
- **Risk:** Slow validation blocks development (<3s target)
- **Mitigation:** Optimize with git diff, caching, parallelization
- **Timeline:** Validate in Phase 2 (performance testing)

**Blocker 3: Migration Quality**
- **Risk:** Bad inferences in category/severity corrupt knowledge base
- **Mitigation:** Dry-run migration, manual review, migration report
- **Timeline:** Validate in Phase 1 (dry-run testing)

**Blocker 4: Duplicate Prevention**
- **Risk:** Multiple docs/solutions/ for same GitHub Issue
- **Mitigation:** Pre-commit check for existing solutions with same issue
- **Timeline:** Address in Phase 0 (design strategy)

**Blocker 5: Team Adoption**
- **Risk:** Low adoption if onboarding unclear
- **Mitigation:** Template with examples, FAQ, review by new developer
- **Timeline:** Validate in Phase 4 (onboarding review)

---

## Risk Analysis & Mitigation

### Critical Risks (High Impact, High Probability)

#### Risk 1: GitHub API Token Security

**Description:** GitHub personal access tokens (PATs) could be compromised if stored improperly, leading to unauthorized repo access.

**Impact:** HIGH - Unauthorized access, code injection, data breach

**Probability:** HIGH - Common mistake in token management

**Mitigation Strategies:**

1. **Document Token Setup**
   - Create `docs/git-hooks-setup.md` with clear instructions
   - Never hardcode tokens in scripts or documentation
   - Use `.env` file: `GITHUB_TOKEN=your_pat_here` (gitignored)

2. **Token Permissions**
   - Request minimum permissions: `public_repo` scope only (read-only)
   - No write access needed for validation (only check if issue exists)
   - Document why write access is not required

3. **Token Rotation**
   - Recommend 90-day token expiration (GitHub default)
   - Document rotation process: create new token, update .env, delete old token
   - Add reminder in CLAUDE.md: "Rotate GitHub tokens every 90 days"

4. **Audit Token Usage**
   - Add note to document: "Check GitHub Settings → Developer Settings → Personal access tokens to review active tokens"
   - Revoke unused tokens regularly

**Contingency Plan:**
- If token is compromised, immediately revoke in GitHub Settings
- Force all developers to update tokens (communicate via Slack/email)
- Review git logs for suspicious commits during compromised period

---

#### Risk 2: Git Hook Performance Blocks Development

**Description:** Pre-commit validation takes >5 seconds, developers disable hooks or become frustrated, leading to low adoption.

**Impact:** HIGH - System becomes ineffective if hooks disabled

**Probability:** MEDIUM - Depends on implementation quality

**Mitigation Strategies:**

1. **Optimize Validation**
   - Only validate changed docs/solutions/ files: `git diff --cached --name-only`
   - Cache GitHub Issue state in `.git/gh-issues-cache.json`
   - Parallelize YAML parsing (async/await for Node.js)
   - Target <3s for typical commits (1-2 files changed)

2. **Profile Performance**
   - Add timing logs to pre-commit hook: `time pre-commit-validation`
   - Measure: YAML parsing, GitHub API calls, file path checks
   - Identify bottlenecks (likely GitHub API or YAML parsing)

3. **Fallback for Large Commits**
   - If >10 files changed, warn user: "Validation may take >10s. Continue? [y/N]"
   - Allow skipping validation with `--no-verify` (document as discouraged)
   - Cache validation results for unchanged files

4. **Early Performance Testing**
   - Test with 7 files (current), 100 files (simulated), 500 files (future scale)
   - Benchmark: `time .githooks/pre-commit` with various commit sizes
   - If >3s for 100 files, redesign (switch to ripgrep or search-index)

**Contingency Plan:**
- If performance cannot meet <3s target, switch to pre-push hooks (less frequent validation)
- Document trade-off: "Pre-push validates once per push vs. pre-commit validates every commit"
- Consider GitHub Actions workflow for remote validation (slow but reliable)

---

#### Risk 3: Duplicate Solutions Corrupt Knowledge Base

**Description:** Multiple developers create docs/solutions/ entries for the same GitHub Issue, leading to confusion in search results.

**Impact:** HIGH - Data integrity problem, learnings-researcher returns conflicting solutions

**Probability:** MEDIUM - Likely during early adoption (lack of process discipline)

**Mitigation Strategies:**

1. **Pre-Commit Duplicate Check**
   - Add validation in pre-commit hook:
     - Extract `related_github_issue` from new file
     - Search docs/solutions/ for existing files with same issue number
     - If found: reject commit with message "Duplicate solution: docs/solutions/frontend/scanner-loop.md already references GitHub Issue #42"
   - Provide recovery command: "Merge into existing file or create new issue"

2. **Unique Identifier Strategy**
   - Use `related_github_issue` + filename slug as unique key
   - If multiple files have same issue, merge into single document
   - Document: "One solution per GitHub Issue (unless multiple distinct fixes)"

3. **Manual Review**
   - Weekly review of docs/solutions/ files in stand-up
   - Check for duplicates, merge if found
   - Update metrics dashboard: "Duplicate solutions detected this week"

4. **Learnings-Researcher Deduplication**
   - If search returns multiple solutions for same issue, rank by date (most recent first)
   - Add note to results: "Multiple solutions found for this issue. Review all."

**Contingency Plan:**
- If duplicates detected, manual merge process:
  1. Identify which solution is most complete (more sections, better details)
  2. Merge sections from other solution into primary document
  3. Delete duplicate file
  4. Update GitHub Issue reference (if changed)

---

### Important Risks (Medium Impact, Medium Probability)

#### Risk 4: Migration Quality Issues

**Description:** Migration script infers wrong category or severity for TROUBLESHOOTING.md issues, leading to incorrect YAML frontmatter.

**Impact:** MEDIUM - Search results are misleading, low relevance

**Probability:** MEDIUM - Inference is never 100% accurate

**Mitigation Strategies:**

1. **Dry-Run Migration**
   - Run migration script with `--dry-run` flag (don't write files)
   - Output YAML frontmatter for all 7 issues to console
   - Manual review by 1 developer: check category, severity, tags
   - Adjust script logic based on review findings

2. **Confidence Scoring**
   - Assign confidence score to each inference (e.g., "category: frontend, confidence: 90%")
   - If confidence < 80%, skip migration, add to manual review list
   - Generate migration report: "3 issues migrated, 2 skipped (low confidence)"

3. **Manual Override**
   - Document how to manually create docs/solutions/ entries
   - Provide template with all fields
   - Allow manual migration for skipped issues

4. **Validation Post-Migration**
   - After migration, manually review all 7 files
   - Check: Is category accurate? Is severity appropriate? Are tags relevant?
   - Fix any errors, update migration report

**Contingency Plan:**
- If migration produces 3+ errors, rollback: delete docs/solutions/ files, fix script, re-run
- If specific issue has wrong category, manually move file to correct directory

---

#### Risk 5: Low Team Adoption

**Description:** Developers ignore docs/solutions/ workflow, continue using TROUBLESHOOTING.md or not documenting at all.

**Impact:** MEDIUM - System becomes shelf-ware, knowledge base doesn't grow

**Probability:** MEDIUM - Requires culture change, habits are hard to break

**Mitigation Strategies:**

1. **Onboarding Excellence**
   - Create beginner-friendly template with examples
   - Add FAQ: "Do I need to document every fix?" (Answer: "Yes, for production issues. Optional for minor refactors.")
   - Review with 1 new developer (clarity check)

2. **Git Hook Enforcement**
   - Pre-commit hook validates YAML, ensuring quality
   - But doesn't enforce creating docs/solutions/ for every issue (too strict)
   - Instead, use social pressure: track docs created per week in metrics dashboard

3. **Leader Modeling**
   - Senior developers create docs/solutions/ entries first (lead by example)
   - Reference docs/solutions/ in code reviews: "Did you document this in docs/solutions/?"
   - Celebrate early adopters in stand-up: "Alice created 3 solution docs this week!"

4. **Friction Reduction**
   - Make docs/solutions/ easy to create:
     - Script: `npm run create-solution --issue "scanner loop" --category frontend`
     - Prompts for YAML fields, generates template file
     - Developer just fills in content

5. **Value Demonstration**
   - Demonstrate learnings-researcher in stand-up: "Search for 'scanner loop' and see solution in <1s"
   - Show time savings: "This would have taken 2 hours to debug, now takes 2 minutes"

**Contingency Plan:**
- If adoption <50% after 3 months, make docs/solutions/ mandatory for HIGH severity issues
- Add to PR checklist: "If you closed a HIGH severity issue, did you create docs/solutions/ entry?"

---

#### Risk 6: Stale Solutions Mislead Developers

**Description:** Solutions in docs/solutions/ become outdated (code changes, approach deprecated), but developers rely on them and fail.

**Impact:** MEDIUM - Wasted time, frustration, mistrust of system

**Probability:** MEDIUM - Knowledge bases naturally become stale over time

**Mitigation Strategies:**

1. **Version Tracking (Future Enhancement)**
   - Add `applicable_version` field to YAML (e.g., "1.0.0-2.0.0")
   - Learnings-researcher filters by current app version
   - Document: "If solution no longer applies, add status: deprecated"

2. **Expiration Policy**
   - Review all docs/solutions/ files quarterly (every 3 months)
   - Mark outdated solutions with `status: deprecated`
   - Update YAML: `status: deprecated`, add note: "Superseded by docs/solutions/backend/new-fix.md"

3. **Self-Reporting**
   - Encourage developers to report stale solutions:
     - "This solution didn't work. What next?"
     - Update docs with new approach, mark old as deprecated
   - Add to template: "If this solution becomes outdated, mark as deprecated and create new entry"

4. **Search Result Warnings**
   - If solution is >6 months old, add warning in learnings-researcher results:
     - "⚠️ This solution is from 2025-09-15 (6 months ago). Verify it still applies."

**Contingency Plan:**
- If stale solution causes failure, developer creates new entry with updated fix
- Learnings-researcher returns both solutions (sorted by date desc)

---

### Low-Risk Items (Low Impact, Low Probability)

#### Risk 7: Git Hook Bypass

**Description:** Developers use `git commit --no-verify` to skip validation, committing invalid YAML or missing fields.

**Impact:** LOW - Invalid docs may exist, but doesn't break system (search still works)

**Probability:** LOW - Only needed in emergencies (e.g., hook bug blocks all commits)

**Mitigation Strategies:**

1. **Document Risks**
   - In setup guide: "Only use --no-verify if hook is broken. Fix hook immediately."
   - Add warning: "Skipping validation may introduce bad data to knowledge base."

2. **Post-Commit Validation**
   - Optional: GitHub Actions workflow validates PRs (catches bad commits during review)
   - Reject PR if docs/solutions/ files have invalid YAML
   - Less friction than pre-commit, but catches errors

3. **Audit**
   - Weekly check: Search commits for `--no-verify` usage
   - If frequent, investigate: Why are developers bypassing hooks? Fix root cause.

---

#### Risk 8: Search Performance Degrades

**Description:** As docs/solutions/ grows to 100+ files, learnings-researcher search becomes slow (>3s).

**Impact:** LOW - Performance issue, but functionality intact

**Probability:** MEDIUM - File glob + regex is O(n), scales linearly

**Mitigation Strategies:**

1. **Performance Testing**
   - Test with 7 files (current), 100 files (simulated), 500 files (future scale)
   - Benchmark: Measure search time, identify bottlenecks

2. **Upgrade Search Engine**
   - If >3s for 100 files, switch to ripgrep (faster than grep/regex)
   - If >3s for 500 files, switch to search-index library (lunr.js, fuse.js)

3. **Caching**
   - Cache parsed YAML in `.git/solutions-cache.json` (gitignored)
   - Only parse files that changed since last search
   - Invalidate cache on commit

**Contingency Plan:**
- If search >5s, document limitation: "Search may be slow for large knowledge base"
- Consider implementing web UI with server-side search (future enhancement)

---

## Resource Requirements

### Team Requirements

**Total Effort:** 17-23 days (3-4.5 weeks) for 1 developer

**Phases Breakdown:**
- **Phase 0 (Planning):** 2-3 days
- **Phase 1 (Migration):** 3-4 days
- **Phase 2 (Git Hooks):** 5-7 days
- **Phase 3 (Learnings-Researcher):** 3-4 days
- **Phase 4 (Integration):** 4-5 days

**Skills Required:**

1. **Primary Developer (100% effort, 3-4.5 weeks)**
   - JavaScript/Node.js (migration script, export script)
   - Bash/Shell (git hooks)
   - Git (hooks, branching, commit messages)
   - YAML (frontmatter parsing)
   - GitHub API (gh CLI)
   - Documentation writing (templates, READMEs, setup guides)
   - Testing (unit tests, integration tests)

2. **Reviewer (10% effort, 1-2 days total)**
   - Review ADR-0004 (Phase 0)
   - Review migration report (Phase 1)
   - Review onboarding documentation (Phase 4)
   - Test git hooks and learnings-researcher (Phase 2, 3)

3. **New Developer (5% effort, 1 day)**
   - Review onboarding documentation for clarity (Phase 4)
   - Provide feedback on UX

---

### Infrastructure Requirements

**Development Environment:**

1. **Hardware:**
   - Standard developer laptop (no special requirements)
   - No server needed (git hooks run locally)
   - No database needed (markdown files only)

2. **Software (Already Installed):**
   - Node.js v18+, npm v9+
   - Git 2.40+
   - Bash 5.0+
   - GitHub CLI (gh) v2.40+
   - Text editor (VS Code, etc.)

3. **New Dependencies (to install):**
   - `js-yaml` npm package: `npm install js-yaml --save-dev`
   - Optional: `pre-commit` framework: `pip install pre-commit` or `brew install pre-commit`
   - Optional: Testing framework (Jest, Mocha): `npm install --save-dev jest`

---

### Cost Estimates

**Development Costs:**

- **1 Developer × 20 days × $100/hr = $16,000** (estimated)
- **1 Reviewer × 2 days × $100/hr = $2,000** (estimated)
- **1 New Developer × 1 day × $100/hr = $1,000** (estimated)
- **Total Development Cost:** ~$19,000

**Ongoing Costs:**

- **GitHub API:** Free (within rate limits for validation)
- **No database or hosting needed:** $0
- **No web server needed:** $0

**Total Project Cost:** ~$19,000 (one-time development cost, $0 ongoing)

---

### Time Estimates (Buffered)

**Best Case:** 17 days (no blockers, smooth workflow)

**Expected Case:** 20 days (minor issues, typical rework)

**Worst Case:** 23 days (migration issues, git hook performance problems)

**Contingency:** +20% buffer for unexpected issues (4 days)

**Total Timeline:** 17-23 days (3-4.5 weeks)

---

## Future Considerations

### Phase 2+ Enhancements (Deferred to Post-Launch)

#### Enhancement 1: P1 and P2 Issue Migration

**Description:** Migrate 1 P1 known bug (from feature_list.json) and 13 P2 UI/UX audit findings (from docs/reports/ui-ux-audit.md) into docs/solutions/.

**Timeline:** After Phase 4 launch (when P0 migration validated)

**Approach:**
- Extend migration script to parse feature_list.json and UI/UX audit reports
- Dry-run migration for manual review
- Execute migration with validation
- Update metrics dashboard

**Estimated Effort:** 2-3 days

---

#### Enhancement 2: Web UI for Search

**Description:** Add a web-based search interface to browse and search docs/solutions/ by category, severity, tags, date.

**Timeline:** 3-6 months post-launch (if manual browsing is requested)

**Approach:**
- Build simple search page (could use Docusaurus, VuePress, or custom React app)
- Host as static site on Vercel (already used for app deployment)
- Implement filters: category dropdown, severity dropdown, tag multi-select
- Add preview: show first few lines of solution in search results
- Update docs/solutions/README.md with link to web UI

**Estimated Effort:** 5-7 days

**Technology Options:**
- **Docusaurus:** Static site generator with built-in search, good documentation
- **VuePress:** Vue.js-based static site, simple setup
- **Custom React + Vite:** Full control, but more development effort
- **Recommendation:** Start with Docusaurus (mature, docs-focused)

---

#### Enhancement 3: Version Tracking

**Description:** Add `applicable_version` field to YAML frontmatter to track which app versions each solution applies to.

**Timeline:** 6-12 months post-launch (when docs/solutions/ grows and version drift becomes an issue)

**Approach:**
- Update YAML schema: add `applicable_version` field (e.g., "1.0.0-2.0.0")
- Update migration script: populate `applicable_version` for migrated solutions
- Update learnings-researcher: filter by current app version
- Update docs/solutions/_template.md with version field
- Document version policy in onboarding guide

**Estimated Effort:** 2-3 days

**Example:**
```yaml
---
title: Scanner infinite loop on repeated scans
category: frontend
severity: HIGH
date: 2025-12-11
applicable_version: 1.5.0-2.0.0  # Applies to app v1.5.0 through v2.0.0
tags: [scanner, useEffect, dependency-array]
module: scanner
related_github_issue: 42
status: resolved
---
```

---

#### Enhancement 4: Automated Solution Creation

**Description:** Add CLI command to auto-generate docs/solutions/ template based on GitHub Issue number.

**Timeline:** 3-6 months post-launch (if team requests lower friction)

**Approach:**
- Create CLI script: `npm run create-solution --issue 42`
- Script fetches GitHub Issue data via `gh issue view 42 --json title,body,labels`
- Auto-fills YAML fields:
  - `title`: from issue title
  - `category`: inferred from issue labels (e.g., label:frontend → category:frontend)
  - `severity`: inferred from priority label (e.g., label:critical → severity:HIGH)
  - `related_github_issue`: from argument
- Generates file: `docs/solutions/frontend/scanner-infinite-loop.md` with template content
- Developer fills in problem, solution, prevention sections

**Estimated Effort:** 3-4 days

**Example Usage:**
```bash
$ npm run create-solution --issue 42
Fetching GitHub Issue #42...
Generating template: docs/solutions/frontend/scanner-infinite-loop.md
✅ Solution document created. Edit file and add details.
```

---

#### Enhancement 5: GitHub Actions Validation

**Description:** Add GitHub Actions workflow to validate PRs (catch bad docs/solutions/ files during review, not just locally).

**Timeline:** 3-6 months post-launch (if PR validation is requested)

**Approach:**
- Create `.github/workflows/validate-solutions.yml`
- On pull_request: run validation for changed docs/solutions/ files
- Validation: YAML syntax, required fields, enum values (same as pre-commit)
- Fail PR if validation fails (require fix before merge)
- Benefits: Catches issues from developers who bypassed pre-commit with `--no-verify`

**Estimated Effort:** 2-3 days

**Example Workflow:**
```yaml
name: Validate docs/solutions/

on:
  pull_request:
    paths:
      - 'docs/solutions/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install js-yaml
      - run: node scripts/validate-solutions.js
```

---

#### Enhancement 6: Analytics and Usage Tracking

**Description:** Add logging to learnings-researcher to track search queries, success rate, and common searches.

**Timeline:** 6-12 months post-launch (if metrics show need for deeper analysis)

**Approach:**
- Add logging to learnings-researcher skill:
  - Log query terms (anonymized)
  - Log number of results returned
  - Log whether results were relevant (prompt user for feedback)
- Store logs in `.git/learnings-researcher-logs/` (gitignored)
- Weekly summary report: "Top 10 searches this week: [list]"
- Use insights to improve taxonomy (e.g., "Users search 'useEffect bug' but tags use 'useEffect' - add 'bug' as common tag")

**Estimated Effort:** 2-3 days

**Example Report:**
```markdown
# Learnings-Researcher Usage Report (Week of 2026-02-06)

## Top 10 Searches

| Rank | Query | Results | Success Rate |
|------|--------|----------|--------------|
| 1 | scanner loop | 3 | 100% |
| 2 | CSP blocking | 2 | 100% |
| 3 | useEffect bug | 1 | 50% (user reported not relevant) |

## Insights

- "useEffect bug" returns low relevance. Consider adding "bug" as common tag.
- 100% success rate for "scanner loop" - solution is accurate.

## Recommendations

1. Add "bug" as suggested tag to scanner-related solutions.
2. Monitor "chunk load" search (low volume but critical).
```

---

#### Enhancement 7: Multi-Language Support

**Description:** Support multiple languages in docs/solutions/ (e.g., English, Romanian) for international teams.

**Timeline:** 6-12 months post-launch (if team grows internationally)

**Approach:**
- Add `language` field to YAML frontmatter (e.g., "en", "ro")
- Create subdirectories: `docs/solutions/en/`, `docs/solutions/ro/`
- Update learnings-researcher to filter by language (based on system locale or user preference)
- Update migration script to infer language from content (simple heuristic: check for Romanian words)
- Document in onboarding guide: "Create solution docs in English. Romanian translations optional."

**Estimated Effort:** 3-4 days

**Example Structure:**
```
docs/solutions/
├── en/              # English (default)
│   └── frontend/
│       └── scanner-loop.md
└── ro/              # Romanian (optional)
    └── frontend/
        └── scanner-loop.md
```

---

#### Enhancement 8: Solution Comments and Feedback

**Description:** Add ability for developers to add comments or feedback to docs/solutions/ entries (similar to GitHub Issue comments).

**Timeline:** 6-12 months post-launch (if team requests collaboration features)

**Approach:**
- Add `comments` section to markdown template:
  ```markdown
  ## Comments

  <!-- Add your feedback here: -->

  - [2026-02-01, @alice]: This solution worked great, took 5 minutes.
  - [2026-02-05, @bob]: Had to adjust debounce timing to 3s.
  ```
- Learnings-researcher includes comments in search results
- Encourage developers to document variations and edge cases
- Optional: Link to GitHub Issue for full discussion (keep comments short)

**Estimated Effort:** 2-3 days

**Alternative:** Keep all discussion in GitHub Issues, link to docs/solutions/ from issue comments (simpler)

---

#### Enhancement 9: Solution Rating System

**Description:** Add rating field to docs/solutions/ to track solution quality (e.g., "5/5 stars", "worked perfectly").

**Timeline:** 6-12 months post-launch (if quality tracking is requested)

**Approach:**
- Add `rating` field to YAML frontmatter (e.g., "5" on scale of 1-5)
- Developers update rating after using solution:
  - 5/5: Worked perfectly, no issues
  - 4/5: Worked, needed minor adjustment
  - 3/5: Partially worked, needed significant changes
  - 2/5: Barely worked
  - 1/5: Didn't work, had to find alternative
- Learnings-researcher ranks results by rating (higher-rated solutions first)
- Add to template: "After using this solution, rate it: [1-5]"

**Estimated Effort:** 2-3 days

**Example:**
```yaml
---
title: Scanner infinite loop on repeated scans
category: frontend
severity: HIGH
date: 2025-12-11
rating: 5  # 5/5 stars (perfect solution)
tags: [scanner, useEffect, dependency-array]
module: scanner
related_github_issue: 42
status: resolved
---
```

---

#### Enhancement 10: Automated Testing of Solutions

**Description:** Add automated tests to verify solutions still work (e.g., fix doesn't break after code changes).

**Timeline:** 12+ months post-launch (significant engineering effort)

**Approach:**
- Create test suite: `tests/solutions/`
- For each solution, write test case:
  - Reproduce issue (e.g., scan barcode repeatedly to trigger loop)
  - Apply solution (e.g., check useEffect dependency array)
  - Verify fix (e.g., scanner doesn't add duplicate items)
- Run tests weekly via GitHub Actions
- If test fails, update docs/solutions/ with new fix or mark as deprecated
- **Very Effort:** 10-20 days (depends on number of solutions and complexity)

**Example Test:**
```javascript
// tests/solutions/scanner-loop.test.js
test('Scanner infinite loop solution', async () => {
  // Reproduce issue
  const scanner = mount(<Scanner />);
  await scanBarcode('1234567890');
  await scanBarcode('1234567890');

  // Verify fix: Should have 1 item, not 2
  expect(scanner.find('.cart-item').length).toBe(1);
});
```

**Rationale:** Automated tests ensure solutions remain valid as code evolves, but effort is significant. Defer until docs/solutions/ has 50+ solutions.

---

### Long-Term Vision (1-2 Years)

**Goal:** Build a learning organization where institutional knowledge is captured, searchable, and continuously validated.

**Key Metrics for Success:**
- 90% of production issues have documented solutions within 7 days
- Developers find relevant solutions in <30 seconds
- Bug recurrence reduced by 50%
- 100% team adoption (all developers create docs/solutions/ entries)

**Future Enhancements Roadmap:**
- **Q1 2026:** Phase 1-4 implementation (17-23 days)
- **Q2 2026:** P1/P2 migration, web UI search (if requested)
- **Q3 2026:** Version tracking, automated solution creation
- **Q4 2026:** Analytics, multi-language support
- **2027:** Solution ratings, automated testing

**Integration with Other Systems:**
- **Spec-driven development:** Specs reference docs/solutions/ for common pitfalls
- **Code reviews:** PR checklist includes "Did you document this fix in docs/solutions/?"
- **Onboarding:** New developers read docs/solutions/ to understand production history
- **Incident response:** Runbook references docs/solutions/ for quick fixes

---

## Documentation Plan

### Documents to Create

#### Phase 0: Planning (2-3 days)

**1. ADR-0004: Git Hook Strategy**
- File: `docs/adrs/adr-0004-git-hook-strategy.md`
- Content:
  - Context: Need for git hooks to validate docs/solutions/
  - Decision: Pre-commit hooks (vs. pre-push vs. GitHub Actions)
  - Implementation: Custom bash scripts vs. pre-commit framework
  - Consequences: Performance impact, team adoption
  - Alternatives: Pre-push hooks, GitHub Actions validation
- Status: Draft → Reviewed → Accepted

**2. GitHub Token Management**
- File: `docs/plans/github-token-management.md`
- Content:
  - Why token is needed (GitHub Issue validation)
  - Token permissions (read-only, repo scope)
  - Setup instructions (create PAT, add to .env)
  - Rotation policy (90-day expiration)
  - Security best practices (never commit, revoke unused)
- Status: Draft → Final

**3. Duplicate Prevention Strategy**
- File: `docs/plans/duplicate-prevention.md` (appendix to main plan)
- Content:
  - Unique identifier (related_github_issue + filename slug)
  - Pre-commit check logic
  - Conflict resolution process
  - Example scenarios

**4. YAML Frontmatter Schema**
- File: `docs/solutions/_template.md`
- Content:
  - Full YAML schema with all fields
  - Types and allowed values
  - Example for each category (frontend, backend, etc.)
  - Markdown content template (Problem, Symptoms, Root Cause, Solution, Files Changed, Prevention)
- Status: Draft → Final

**5. Error Message Templates**
- File: `docs/plans/error-messages.md` (appendix to main plan)
- Content:
  - Error message for each validation failure type
  - Recovery commands (e.g., `gh issue create`)
  - Mockup CLI output examples

---

#### Phase 1: Migration (3-4 days)

**6. Migration Script**
- File: `scripts/migrate-solutions.js`
- Content:
  - Parse TROUBLESHOOTING.md
  - Extract 7 production issues
  - Infer category, severity, tags
  - Generate YAML frontmatter + markdown
  - Dry-run mode
  - Migration report generation
- Status: Draft → Tested → Final

**7. Migration Report**
- File: `docs/plans/migration-report.md`
- Content:
  - Total issues migrated
  - Skipped issues (incomplete data)
  - Warnings (low-confidence inferences)
  - Validation results (YAML syntax, required fields)
  - Manual review recommendations
- Status: Generated after migration

**8. Archive README**
- File: `docs/archive/README.md`
- Content:
  - Explanation of archive structure
  - Migration date (2026-01-30)
  - Rationale for migration
  - Links to docs/solutions/

---

#### Phase 2: Git Hooks (5-7 days)

**9. Pre-Commit Hook**
- File: `.githooks/pre-commit`
- Content:
  - Check if docs/solutions/ files changed
  - Validate YAML syntax
  - Check required fields
  - Validate enum values
  - Check GitHub Issue existence
  - Validate file path vs. category
  - Performance optimization (only changed files)
  - Error messages with recovery commands
- Status: Draft → Tested → Installed

**10. Git Hooks Setup Guide**
- File: `docs/git-hooks-setup.md`
- Content:
  - How to install hooks: `git config core.hooksPath .githooks`
  - How to set up GitHub token: export GITHUB_TOKEN
  - How to bypass hooks: `git commit --no-verify` (discouraged)
  - How to debug hooks: run `.githooks/pre-commit` manually
  - Troubleshooting (common errors)
- Status: Draft → Reviewed → Final

**11. Test Suite Documentation**
- File: `tests/git-hooks/README.md`
- Content:
  - Test structure (unit, integration, end-to-end)
  - How to run tests: `npm test`
  - Coverage requirements (>80%)
  - Test scenarios list

---

#### Phase 3: Learnings-Researcher (3-4 days)

**12. Learnings-Researcher Skill**
- File: `.config/opencode/skills/learnings-researcher.md`
- Content:
  - Skill description (search docs/solutions/)
  - Parse YAML frontmatter
  - Search logic (relevance scoring)
  - Return format (top 3 matches)
  - No results handling
- Status: Draft → Tested → Final

**13. Test Results Document**
- File: `docs/test-reports/learnings-researcher-test.md`
- Content:
  - Test queries and expected results
  - Relevance testing (manual review)
  - Performance test results
  - Edge cases handled
- Status: Generated after testing

---

#### Phase 4: Integration (4-5 days)

**14. Onboarding Documentation**
- File: `docs/solutions/README.md`
- Content:
  - Overview of docs/solutions/ system
  - Quick start guide (how to create first solution)
  - When to create entries (every issue? only critical issues?)
  - How to choose category/severity
  - How to use learnings-researcher
  - FAQ
  - Index by category (table of all solutions)
- Status: Draft → Reviewed → Final

**15. Template File**
- File: `docs/solutions/_template.md` (already created in Phase 0)
- Status: Updated with examples for each category

**16. Updated CLAUDE.md**
- File: `CLAUDE.md` (modify existing)
- Changes:
  - Remove references to TROUBLESHOOTING.md
  - Add section: "Documentation - docs/solutions/ Knowledge Base"
  - Document workflow (create GitHub Issue → resolve → create docs/solutions/ entry)
  - Add links: docs/solutions/_template.md, docs/solutions/README.md, docs/git-hooks-setup.md
  - Update bug fix workflow
- Status: Modified

**17. Updated feature_list.json**
- File: `feature_list.json` (modify existing)
- Changes:
  - Deprecate "Known Issues" section
  - Add metadata: `"solutions_directory": "docs/solutions/"`
  - Update README
- Status: Modified

**18. Metrics Dashboard**
- File: `docs/plans/metrics-dashboard.md`
- Content:
  - Primary metrics (coverage, search effectiveness, bug recurrence, productivity)
  - Secondary metrics (compliance, velocity, adoption, quality)
  - Technical metrics (performance, accuracy, offline reliability)
  - Weekly updates (last updated date, status, trend)
- Status: Created (updated weekly)

**19. Export Script**
- File: `scripts/export-solutions.js`
- Content:
  - Parse all docs/solutions/**/*.md files
  - Convert to JSON
  - Validate output
  - Save to docs/solutions/export/solutions-YYYY-MM-DD.json
- Status: Draft → Tested → Final

**20. Rollback Procedures**
- File: `docs/plans/rollback-procedures.md`
- Content:
  - Migration script crashes mid-migration: delete partial files, re-run
  - Git hook bug blocks commits: bypass with --no-verify, fix hook, re-enable
  - docs/solutions/ corrupted: restore from export JSON or git history
  - Performance issues: switch to pre-push hooks or GitHub Actions
- Status: Draft → Final

---

### Documents to Update

**1. CLAUDE.md**
- Remove TROUBLESHOOTING.md references
- Add docs/solutions/ workflow
- Update bug fix workflow

**2. feature_list.json**
- Deprecate "Known Issues" section
- Add solutions_directory metadata

**3. docs/README.md**
- Update documentation index to reference docs/solutions/
- Remove TROUBLESHOOTING.md from index
- Add docs/solutions/ to index

**4. claude-progress.md**
- Note TROUBLESHOOTING.md migration
- Update "Known Issues" section to reference docs/solutions/

---

### Documents to Archive

**1. TROUBLESHOOTING.md**
- Move to `docs/archive/troubleshooting.md`
- Add redirect notice at top
- Create README in docs/archive/

**2. feature_list.json Known Issues**
- Deprecate (comment out or remove section)
- Add reference to docs/solutions/

---

## References & Research

### Internal References

**Architecture Decisions:**
- **ADR-0001:** Airtable access via backend proxy (docs/adrs/adr-0001-airtable-backend-proxy.md)
- **ADR-0002:** Product nullability (docs/adrs/adr-0002-product-nullability.md)
- **ADR-0003:** Code splitting strategy (docs/adrs/adr-0003-code-splitting-strategy.md)
- **ADR-0004:** Git hook strategy (to be created in Phase 0)

**Documentation Patterns:**
- **TROUBLESHOOTING.md structure:** Issue → Symptoms → Root Cause → Solution → Files Changed → Commit → Prevention
- **Specs format:** Inline frontmatter, BDD scenarios, changelog
- **ADRs format:** Header with status/date/deciders, Context → Decision → Consequences
- **Test reports format:** Test Objective → Results → Findings → Recommendations

**Existing Issues:**
- **GitHub Issues (17 open):** https://github.com/[org]/[repo]/issues
- **TROUBLESHOOTING.md (7 production issues):** TROUBLESHOOTING.md
- **feature_list.json (1 known bug):** feature_list.json → known_bugs section
- **UI/UX Audit (13 findings):** docs/reports/ui-ux-audit.md

**Configuration:**
- **Environment variables:** .env.example (GITHUB_TOKEN)
- **Git config:** `.gitconfig` (core.hooksPath)
- **npm scripts:** package.json (add create-solution, export-solutions scripts)

---

### External References

**GitHub CLI Documentation:**
- GitHub CLI (gh): https://cli.github.com/manual/
- gh issue view: https://cli.github.com/manual/gh_issue_view
- gh issue list: https://cli.github.com/manual/gh_issue_list
- Personal access tokens: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token

**YAML Frontmatter:**
- js-yaml library: https://github.com/nodeca/js-yaml
- Frontmatter spec: https://jekyllrb.com/docs/front-matter/
- Markdown frontmatter parsing: https://www.npmjs.com/package/gray-matter

**Git Hooks:**
- Pre-commit hooks: https://git-scm.com/docs/githooks#_pre_commit
- Custom hooks directory: https://git-scm.com/docs/git-config#Documentation/git-config.txt-corehooksPath
- Pre-commit framework: https://pre-commit.com/

**Search Algorithms:**
- Relevance scoring: TF-IDF (Term Frequency-Inverse Document Frequency)
- Ripgrep (fast grep alternative): https://github.com/BurntSushi/ripgrep
- Search libraries: lunr.js (https://lunrjs.com/), fuse.js (https://fusejs.io/)

**Static Site Generators (for future web UI):**
- Docusaurus: https://docusaurus.io/
- VuePress: https://vuepress.vuejs.org/
- Hugo: https://gohugo.io/

---

### Related Work

**Previous PRs:**
- PR #1: Initial TROUBLESHOOTING.md creation (add commit hash)
- PR #2: feature_list.json known bugs section
- PR #3: UI/UX audit report

**Related Issues:**
- GitHub Issue #25: Add production error tracking (Sentry) - relates to docs/solutions/ for error patterns
- GitHub Issue #42: Improve scanner error message specificity - could be documented in docs/solutions/
- GitHub Issue #49: Add checkout retry mechanism for failed items - candidate for docs/solutions/ entry

**Design Documents:**
- Brainstorm: docs/brainstorms/2026-01-30-documentation-consolidation-brainstorm.md
- This plan: docs/plans/2026-01-30-refactor-hybrid-documentation-system-plan.md
- SpecFlow Analysis: Integrated into this plan (25 gaps identified, critical questions answered)

---

### AI Era Considerations

**AI-Assisted Development:**

1. **Claude Code Agent Integration**
   - Claude Code automatically invokes learnings-researcher when solving bugs
   - Agent reads docs/solutions/ before suggesting solutions
   - Agent validates proposed solutions against existing docs (prevent duplicates)

2. **AI-Generated Code Review**
   - Use AI to validate YAML frontmatter in PR reviews
   - AI checks for completeness (all sections present, prevention strategies included)
   - AI suggests improvements (e.g., "Add 'Files Changed' section with line numbers")

3. **AI-Assisted Migration**
   - Use Claude Code to generate YAML frontmatter for new docs/solutions/ entries
   - AI infers category/severity from issue description
   - AI generates summary for learnings-researcher search results

**Prompt Templates:**

**Generate docs/solutions/ entry:**
```
Create a docs/solutions/ entry for this issue:
Title: Scanner infinite loop on repeated scans
Category: frontend
Severity: HIGH
Symptoms: Scanning barcode adds item multiple times
Root Cause: useEffect missing dependency array
Solution: Add [barcode] to dependency array, use ref-based callback pattern

Generate YAML frontmatter and markdown template.
```

**Validate YAML frontmatter:**
```
Validate this YAML frontmatter:
---
title: Scanner infinite loop
category: frontend
severity: HIGH
date: 2026-01-30
tags: [scanner, useEffect]
module: scanner
related_github_issue: 42
status: resolved
---

Check for required fields, valid enum values, correct date format.
```

**Search docs/solutions/:**
```
Search docs/solutions/ for solutions related to "scanner loop" and "useEffect".
Return top 3 matches with file paths, titles, and summaries.
```

**AI-Accelerated Testing:**

- Use AI to generate test cases for git hooks (malformed YAML, missing fields, etc.)
- Use AI to generate test queries for learnings-researcher (edge cases, synonyms)
- Use AI to review migration report (identify low-confidence inferences)

**Quality Assurance:**

- AI review all docs/solutions/ entries before commit (completeness, accuracy)
- AI cross-reference with GitHub Issues (validate all HIGH severity issues have docs)
- AI flag stale solutions (>6 months old, no updates)

---

## Appendix

### Appendix A: YAML Frontmatter Schema

```yaml
---
title: Clear, concise issue title (required)
category: frontend | backend | infrastructure | security | ux (required)
severity: HIGH | MEDIUM | LOW (required)
date: YYYY-MM-DD (required)
tags: [array, of, relevant, tags] (optional)
module: component-or-module-name (optional)
related_github_issue: number (optional)
related_spec: path/to/spec.md (optional)
status: resolved | deprecated (required)
symptoms: [observable, symptom, list] (optional)
commit: git-hash (optional, if fixed)
applicable_version: X.Y.Z-A.B.C (optional, future enhancement)
rating: 1 | 2 | 3 | 4 | 5 (optional, future enhancement)
language: en | ro | ... (optional, future enhancement)
---
```

**Field Descriptions:**

- **title:** Short, descriptive issue title (e.g., "Scanner infinite loop on repeated scans")
- **category:** Domain classification (frontend, backend, infrastructure, security, ux)
- **severity:** Impact level (HIGH = production-critical, MEDIUM = affects user experience, LOW = dev productivity)
- **date:** Date solution documented (YYYY-MM-DD format)
- **tags:** Array of relevant tags for search (e.g., [scanner, useEffect, dependency-array])
- **module:** Affected component or module (e.g., scanner, api, auth)
- **related_github_issue:** GitHub Issue number (if issue was tracked in GitHub)
- **related_spec:** Path to spec file if issue relates to spec violation or feature
- **status:** Solution status (resolved = current fix, deprecated = outdated)
- **symptoms:** Observable behaviors (e.g., [adds item twice, spinner doesn't stop])
- **commit:** Git commit hash where fix was applied (optional)
- **applicable_version:** App version range (e.g., "1.5.0-2.0.0") - future enhancement
- **rating:** Solution quality rating (1-5 stars) - future enhancement
- **language:** Document language (en, ro, etc.) - future enhancement

---

### Appendix B: Error Message Templates

**YAML Syntax Error:**
```
Error: Invalid YAML at line 5: expected mapping key, found scalar

In file: docs/solutions/frontend/scanner-loop.md
Line 5: severity: CRITICAL  # Invalid value

Allowed severity values: HIGH, MEDIUM, LOW
Fix severity field and retry commit.
```

**Missing Required Field:**
```
Error: Missing required field 'category'

In file: docs/solutions/frontend/scanner-loop.md
Required fields: title, category, severity, date, status

Allowed category values: frontend, backend, infrastructure, security, ux
Add category field and retry commit.
```

**Invalid Enum Value:**
```
Error: Invalid severity 'CRITICAL'

In file: docs/solutions/frontend/scanner-loop.md
Allowed severity values: HIGH, MEDIUM, LOW

Fix severity field and retry commit.
```

**Invalid Date Format:**
```
Error: Invalid date format

In file: docs/solutions/frontend/scanner-loop.md
Date: January 30, 2026

Required format: YYYY-MM-DD (e.g., 2026-01-30)
Fix date field and retry commit.
```

**GitHub Issue Not Found:**
```
Error: GitHub Issue #999999 not found

In file: docs/solutions/frontend/scanner-loop.md
related_github_issue: 999999

Create GitHub Issue: gh issue create --title "Scanner Infinite Loop"
Or remove related_github_issue field if issue doesn't exist.
```

**File Path Mismatch:**
```
Error: File path doesn't match category field

File: docs/solutions/backend/scanner-loop.md
Category in YAML: frontend

Move file to docs/solutions/frontend/scanner-loop.md
OR update YAML category to 'backend'
```

**GitHub API Unreachable (Graceful Degradation):**
```
Warning: GitHub API unreachable (timeout after 5s)

Skipping GitHub Issue validation.
Proceeding with commit (docs/solutions/ file may have invalid issue reference).

To fix: Check internet connection or set GITHUB_TOKEN environment variable.
```

**No GitHub Token (Graceful Degradation):**
```
Warning: No GITHUB_TOKEN environment variable set

Skipping GitHub Issue validation.
Proceeding with commit (docs/solutions/ file may have invalid issue reference).

To enable GitHub validation: export GITHUB_TOKEN=your_pat_here
```

---

### Appendix C: Migration Report Template

```markdown
# Migration Report: TROUBLESHOOTING.md → docs/solutions/

**Date:** 2026-01-30
**Migrated By:** [Developer Name]

## Summary

- **Total Issues:** 7
- **Migrated:** 7
- **Skipped:** 0
- **Warnings:** 1

## Migration Details

| Issue Title | Category | Severity | Status | Warnings |
|-------------|----------|----------|--------|----------|
| Scanner infinite loop | frontend | HIGH | ✅ Migrated | None |
| CSP blocking API calls | security | HIGH | ⚠️ Low confidence (90%) | Commit hash not validated |
| Chunk load failures | infrastructure | HIGH | ✅ Migrated | None |
| Black screen after PWA update | infrastructure | HIGH | ✅ Migrated | None |
| Transparent dialog backgrounds | ux | MEDIUM | ✅ Migrated | None |
| Scanner active during modal | ux | MEDIUM | ✅ Migrated | None |
| Checkout infinite loop | frontend | HIGH | ✅ Migrated | None |

## Skipped Issues (Incomplete Data)

None

## Manual Review Required

**Issue:** CSP blocking API calls
**Reason:** Low confidence in category inference (90%)
**Action Required:** Verify category is correct (security vs. infrastructure)
**Recommendation:** Review file: docs/solutions/security/csp-blocking-api.md

## Validation Results

- **YAML Syntax:** ✅ All 7 files valid
- **Required Fields:** ✅ All fields present
- **Enum Values:** ✅ All categories/severities valid
- **Date Format:** ✅ All dates in YYYY-MM-DD format
- **Commit Hashes:** ⚠️ 1 hash not found in git log (CSP blocking issue)

## Next Steps

1. Review manual review items (1 issue)
2. Validate skipped issues (0 issues)
3. Archive TROUBLESHOOTING.md
4. Update CLAUDE.md and feature_list.json
5. Commit migration
```

---

### Appendix D: Metrics Dashboard Template

```markdown
# Hybrid Documentation System - Metrics Dashboard

**Last Updated:** 2026-02-06

## Primary Metrics

| Metric | Target | Current | Status | Trend |
|--------|--------|---------|--------|
| Documentation Coverage | 90% | 85% | ⚠️ | 📈 |
| Search Effectiveness | 90% | 88% | ⚠️ | 📈 |
| Bug Recurrence Reduction | -50% | -20% | ❌ | ➡️ |
| Developer Productivity | <30s | 25s | ✅ | 📈 |

**Documentation Coverage:** 17 of 20 closed issues (85%) have docs/solutions/ entries
**Search Effectiveness:** 8 of 10 sample queries returned relevant results (80%)
**Bug Recurrence:** 2 duplicate issues in last 6 months (vs. 4 in previous 6 months = 50% reduction? Needs more data)
**Developer Productivity:** Average 25 seconds to find and apply solution (target: <30s)

## Secondary Metrics

| Metric | Target | Current | Status | Trend |
|--------|--------|---------|--------|
| Git Hook Compliance | <10% | 8% | ✅ | 📈 |
| Documentation Velocity | 3-5/wk | 4/wk | ✅ | ➡️ |
| Team Adoption | 100% | 75% | ⚠️ | 📈 |
| Knowledge Base Quality | 95% | 92% | ⚠️ | 📈 |

**Git Hook Compliance:** 8 of 100 commits rejected by pre-commit hooks (8% rejection rate)
**Documentation Velocity:** 4 new docs created this week (target: 3-5/week)
**Team Adoption:** 3 of 4 developers have created docs/solutions/ entries (75% adoption)
**Knowledge Base Quality:** 18 of 19 files have complete sections (95% complete)

## Technical Metrics

| Metric | Target | Current | Status | Trend |
|--------|--------|---------|--------|
| Git Hook Performance | <3s | 2.1s | ✅ | 📈 |
| Learnings-Researcher Performance | <3s (100 files) | 1.8s | ✅ | 📈 |
| Validation Accuracy | <1% | 0.5% | ✅ | 📈 |
| Offline Reliability | 100% | 100% | ✅ | ➡️ |

**Git Hook Performance:** Average 2.1s validation time for 1-2 files changed
**Learnings-Researcher Performance:** 1.8s search time for 100 files (simulated)
**Validation Accuracy:** 0.5% false rejection rate (1 valid commit rejected out of 200)
**Offline Reliability:** 100% of commits succeed without GitHub API (graceful degradation)

Legend: ✅ On Target | ⚠️ Near Target | ❌ Below Target | 📈 Improving | 📉 Declining | ➡️ Stable
```

---

### Appendix E: Duplicate Prevention Logic

**Pre-Commit Hook Check:**

```bash
# Extract related_github_issue from new/modified docs/solutions/ files
new_issue=$(grep -E "^related_github_issue:" "$file" | awk '{print $2}')

# Search for existing solutions with same issue
existing=$(grep -r "related_github_issue: $new_issue" docs/solutions/ | grep -v "$file")

# If duplicate found, reject commit
if [ -n "$existing" ]; then
    echo "Error: Duplicate solution found"
    echo "Existing solution: $existing"
    echo "New file: $file"
    echo "Only one solution per GitHub Issue. Merge into existing file or create new issue."
    exit 1
fi
```

**Conflict Resolution:**

If duplicate detected:
1. Review both solutions
2. Identify which is more complete (more sections, better details)
3. Merge sections from incomplete solution into complete solution
4. Delete incomplete file
5. Update GitHub Issue reference (if changed)

**Example:**

Existing: `docs/solutions/frontend/scanner-loop.md` (related_github_issue: 42)
New: `docs/solutions/frontend/infinite-scans.md` (related_github_issue: 42)

**Resolution:**
- Merge content of infinite-scans.md into scanner-loop.md
- Delete infinite-scans.md
- Keep filename: scanner-loop.md (more descriptive)

---

## Changelog

### 2026-01-30

- Initial plan creation
- SpecFlow analysis integrated (25 gaps identified)
- Critical questions answered (git hook strategy, duplicate prevention, etc.)
- 4-phase implementation plan defined (17-23 days total)
- Success metrics defined (12 primary, secondary, technical metrics)
- Risk analysis with mitigation strategies (8 risks identified)
- Future considerations outlined (10 enhancements + long-term vision)
- Documentation plan created (20 documents to create/update/archive)
- Appendices added (YAML schema, error messages, migration report, metrics dashboard, duplicate prevention)
