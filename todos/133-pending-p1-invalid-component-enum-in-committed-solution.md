---
status: pending
priority: p1
issue_id: "133"
tags: [code-review, documentation, schema]
dependencies: []
---

# component: tooling and root_cause: missing_dependency invalid enum values in committed docs

## Problem Statement
Two invalid enum values exist in committed documentation files:
1. `component: tooling` in `docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md:5` — `tooling` is not in the schema's `component` enum
2. `root_cause: missing_dependency` in `docs/solutions/patterns/critical-patterns.md:116` Pattern 4 "CORRECT" example — `missing_dependency` is not in the schema's `root_cause` enum

The first will hard-block any developer who stages that file. The second misleads agents following Pattern 4 as authoritative guidance, causing them to write invalid frontmatter and hit a pre-commit failure.

## Findings
- `schema.yaml` valid `component` values: `react_component`, `custom_hook`, `api_client`, `scanner`, `form_component`, `dialog_component`, `page_component`, `utility`, `type_definition`, `pwa_config`, `build_config`
- `schema.yaml` valid `root_cause` values: `dependency_array`, `missing_validation`, `state_race`, `missing_error_handler`, `wrong_api_usage`, `type_error`, `memory_leak`, `config_error`, `logic_error`, `missing_cleanup`, `stale_closure`, `csp_violation`
- Neither `tooling` nor `missing_dependency` appear in schema
- Pattern 4 comment says `← Valid enum (12 options)` next to `missing_dependency` — actively misleading

## Proposed Solutions

### Option A: Fix committed files + update Pattern 4 example (Recommended)
- Fix `invoice-import-duplicates` to use `utility` or `build_config`
- Fix Pattern 4 example to use `wrong_api_usage` or `missing_validation`
- Optionally add `tooling` to schema if it's a genuinely needed value (see todo #138)
- Effort: Small

## Technical Details
- `docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md` line 5
- `docs/solutions/patterns/critical-patterns.md` line 116

## Acceptance Criteria
- [ ] Both files pass `node scripts/validate-docs.js <path>` (once #132 is fixed)
- [ ] Pattern 4 CORRECT example uses an enum value that actually exists in schema.yaml
- [ ] `pnpm validate-docs` passes with zero errors on the full docs/solutions/ tree

## Work Log
- 2026-03-17: Identified by architecture-strategist and agent-native-reviewer agents in ce-review
