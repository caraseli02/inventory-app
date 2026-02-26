---
date: 2026-02-25
topic: strict-pre-commit-quality-checks
---

# Stricter Pre-Commit Code Quality Checks

## What We're Building

Extend the existing pre-commit pipeline with ESLint-based quality enforcement covering four areas: file size limits, cognitive complexity, architecture boundary violations (components importing Supabase directly), and code smell detection. Rollout is gradual — existing violating files are allowlisted via ESLint flat config overrides and fixed over time.

The trigger was `InvoiceUploadDialog.tsx` reaching 1,433 lines with mixed concerns (OCR parsing, price calculations, UI rendering all in one file). Other large components: `EditProductDialog.tsx` (843 lines), `CreateProductForm.tsx` (536 lines).

## Why This Approach

**Chosen**: Library-based ESLint extension (no custom Node.js scripts).

Alternatives considered:
- **Custom scripts** (like existing `check-root-files.js`) — rejected: reinventing what ESLint plugins already do well, no IDE feedback
- **ESLint only** — chosen approach; runs in IDE (instant feedback), already part of the pipeline

Tools selected after research:
- `eslint-plugin-boundaries` — module boundary enforcement (right tool for architecture rules)
- `eslint-plugin-sonarjs@^1.0.4` — cognitive complexity + code smell detection (catches patterns `@typescript-eslint` misses; pinned to v1 due to v2 ESLint 9 regressions)
- Built-in ESLint `max-lines` + `max-lines-per-function` — no extra dependency
- `no-restricted-imports` patterns — surgical ban on direct backend imports from `components/`

Skipped:
- `dependency-cruiser` — good for visualisation later, but no IDE feedback loop
- `eslint-plugin-unicorn` — too broad, too noisy for gradual adoption
- `sonarjs` v2 — known ESLint 9 compatibility regressions as of early 2025

## Key Decisions

- **Warn first, enforce later**: All new rules start at `'warn'`. Flip to `'error'` after legacy files are refactored. This avoids blocking commits on pre-existing debt.
- **Allowlist via flat config overrides**: Known violating files are listed in explicit ESLint override blocks in `eslint.config.js`. Each exemption is tracked in source control and visible in code review — no hidden suppression files.
- **Boundary model**: `components/` → `hooks/` → `lib/` → Supabase. Components must not skip layers. Enforced by `boundaries/element-types` + `no-restricted-imports` patterns.
- **Thresholds (starting points, tunable)**:
  - `max-lines`: 300 lines (skip comments/blanks)
  - `max-lines-per-function`: 80 lines
  - `sonarjs/cognitive-complexity`: 15
  - `sonarjs/no-duplicate-string`: threshold 4

## Implementation Scope

### Phase 1: ESLint changes only (no pre-commit script changes)
1. Install `eslint-plugin-boundaries` + `eslint-plugin-sonarjs@^1.0.4`
2. Extend `eslint.config.js` with:
   - Element type definitions matching `src/` directories
   - `boundaries/element-types` rules for layer enforcement
   - `no-restricted-imports` patterns blocking `**/lib/supabase*`, `**/lib/airtable*` from `components/`
   - `sonarjs` cognitive complexity + code smell rules
   - Built-in `max-lines` / `max-lines-per-function`
3. Add legacy override block for known violating files:
   - `InvoiceUploadDialog.tsx` — all new rules at `warn`
   - `EditProductDialog.tsx` — `max-lines` at `warn`
   - `CreateProductForm.tsx` — `max-lines` at `warn`

### Phase 2: Refactor tracked files (separate task)
- Split `InvoiceUploadDialog.tsx` into: `useInvoiceImport.ts` hook, `InvoicePreviewTable.tsx`, `InvoiceUploadDialog.tsx` (thin shell)
- Remove from legacy allowlist as files are cleaned up

## Resolved Questions

- **Boundaries strictness**: Block only backend imports from `components/`. `lib/utils.ts` and `lib/errors.ts` remain accessible directly. `no-restricted-imports` patterns target `**/lib/supabase*` and `**/lib/airtable*` specifically.
- **Threshold values**: Run `pnpm lint` with new rules at `warn` first — audit violation counts before finalising `max-lines` and `cognitive-complexity` thresholds.
- **MCP directory**: `mcp/` is exempted from boundary and complexity rules (different architecture, Node.js server).

## Next Steps

→ Resolve open questions, then `/workflows:plan` for implementation
