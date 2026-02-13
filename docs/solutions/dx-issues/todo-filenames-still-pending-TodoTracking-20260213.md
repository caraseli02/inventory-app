---
module: TodoTracking
date: 2026-02-13
problem_type: developer_experience
component: utility
symptoms:
  - "Todos show status: complete but filenames still include 'pending'"
  - "Docs/reports can link to old todo filenames after renames"
root_cause: config_error
resolution_type: code_fix
severity: low
tags: [todos, repo-hygiene, references, rename]
related_github_issue: null
commit: 5c63c1f776ce8e72022479b996110fa9a752f298
---

# Problem Description

The repo uses file-based todos under `todos/`. Status is tracked in YAML frontmatter (`status: pending|ready|complete`), but filenames also embed the original status (for example `007-pending-...md`). After completing work, this can cause confusion because the file content says complete while the filename still says pending.

Separately, once todo files are renamed, any documents that linked the old filename need to be updated (for example `docs/reports/...`).

# Symptoms

- A todo renders or reads as complete (`status: complete`) but still looks pending due to the filename prefix.
- References in markdown docs can break after renaming todo files.

# Root Cause Analysis

The system used the filename as a stable identifier, but humans also interpret the filename status as truth. Since the workflow only updated the frontmatter status (and not the filename), status appeared contradictory.

# Solution

1. Rename completed todo files from `*-pending-*` to `*-complete-*` using `git mv`.
2. Search and update references to old filenames across the repo.

Example workflow:

```bash
git mv todos/007-pending-...md todos/007-complete-...md
rg -n "007-pending-|todos/007-pending" -S .
# update any hits
```

# Files Changed

- `todos/007-...` (renamed)
- `todos/008-...` (renamed)
- `todos/009-...` (renamed)
- `todos/010-...` (renamed)
- `todos/021-...` (renamed)
- `docs/reports/2026-02-12-test-browser-checkout-price-parity.md` (reference updated)

# Prevention

- Decide on one source of truth for status:
  - Option A: filename reflects status (rename on status change).
  - Option B: filename is stable id only (remove status words from filenames).
- If keeping status in filenames, add a simple helper script or checklist step:
  - rename file when changing `status:` to `complete`
  - run `rg` to update references before commit

