---
date: 2026-01-30
topic: documentation-consolidation
---

# Documentation Consolidation: Hybrid System

## What We're Building

A hybrid documentation system that consolidates all issue tracking into a searchable knowledge base while preserving GitHub Issues for active collaboration. The system will:

1. **Create `docs/solutions/`** with YAML frontmatter for resolved issues and production problems
2. **Migrate critical issues** from TROUBLESHOOTING.md, feature_list.json, and UI/UX audits into the new format
3. **Establish cross-references** between GitHub Issues and docs/solutions/ documents
4. **Enable learnings-researcher agent** to search and retrieve relevant solutions by category, severity, tags, and symptoms
5. **Replace scattered documentation** (TROUBLESHOOTING.md, known bugs sections, UI/UX audit reports) with a unified, searchable system

The goal is complete consolidation: all 17 GitHub issues, 7 production issues from TROUBLESHOOTING.md, 1 known bug from feature_list.json, and 13 UI/UX audit findings will be migrated or cross-referenced.

## Why This Approach

We evaluated three approaches:

- **Unified Compound-Docs**: Complete replacement of GitHub Issues - cleanest long-term but loses collaboration features
- **Template-First**: Minimal migration - fast but doesn't achieve consolidation goals
- **Hybrid System**: Retains GitHub's collaboration while creating an authoritative knowledge base

The hybrid approach was chosen because it:
- Preserves GitHub's native workflow for active issue tracking
- Provides immediate searchable knowledge base via YAML frontmatter
- Allows gradual, prioritized migration of historical issues
- Empowers the learnings-researcher agent without disrupting team habits
- Balances consolidation effort with practical team workflow

## Key Decisions

**Decision 1: docs/solutions/ as primary knowledge base**
- Resolved issues, production problems, and code quality findings will live here
- YAML frontmatter enables filtering by severity, category, module, tags
- GitHub Issues remain for active collaboration and work-in-progress

**Decision 2: Directory structure by domain**
```
docs/solutions/
├── backend/          # Supabase, Airtable, API issues
├── frontend/         # React, UI components, scanner issues
├── infrastructure/   # PWA, Vercel, deployment issues
├── security/         # CSP, validation, auth issues
└── ux/             # Accessibility, mobile, interaction issues
```

**Decision 3: YAML frontmatter schema**
```yaml
---
title: Scanner infinite loop on repeated scans
category: frontend
severity: HIGH
date: 2025-12-11
tags: [scanner, useEffect, dependency-array]
module: scanner
related_github_issue: 42
status: resolved
---
```

**Decision 4: Migration priority**
1. **P0**: All 7 production issues from TROUBLESHOOTING.md
2. **P1**: 1 known bug from feature_list.json (image update issue)
3. **P2**: 13 UI/UX audit findings (P0 and P1 severity)
4. **P3**: Open GitHub Issues (migrate as resolved or on-demand)

**Decision 5: Cross-reference strategy**
- GitHub Issues link to docs/solutions/ in their description
- docs/solutions/ documents reference GitHub Issue numbers
- TROUBLESHOOTING.md redirects to docs/solutions/ with migration notice
- feature_list.json "Known Issues" section deprecated

**Decision 6: Workflow for new issues**
1. Issue reported → Create GitHub Issue
2. Issue investigated → Add tags, assignee, milestones
3. Issue resolved → Create docs/solutions/ entry
4. GitHub Issue closed → Reference docs/solutions/ ID
5. learnings-researcher can now find this solution

## Open Questions

- **Migration timeline**: Should all historical issues be migrated upfront, or on-demand as referenced?
- **Stale data prevention**: How to ensure docs/solutions/ stays in sync with GitHub Issues if code changes?
- **Team training**: What documentation and onboarding is needed for the hybrid workflow?
- **Search UI**: Should we add a web UI for searching docs/solutions/, or rely on learnings-researcher agent?
- **Archive strategy**: What happens to TROUBLESHOOTING.md after migration - delete or keep as reference?

## Next Steps

→ `/workflows:plan` to implement:
1. Create docs/solutions/ directory structure and template
2. Migrate P0 and P1 issues (8 total) with YAML frontmatter
3. Update CLAUDE.md to document the new workflow
4. Add cross-references between GitHub Issues and docs/solutions/
5. Test learnings-researcher agent with migrated solutions
