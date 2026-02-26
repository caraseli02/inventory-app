---
title: "feat: Enforce ESLint code quality boundaries and complexity rules"
type: feat
status: active
date: 2026-02-25
origin: docs/brainstorms/2026-02-25-strict-pre-commit-quality-checks-brainstorm.md
---

# feat: Enforce ESLint Code Quality Boundaries and Complexity Rules

## Overview

Extend `eslint.config.js` with two new ESLint plugins and built-in rules to enforce four quality dimensions:
1. **Architecture boundaries** — `components/` cannot import directly from Supabase/Airtable backends
2. **File size** — components over 300 lines fail linting
3. **Cognitive complexity** — functions with complexity > 15 fail linting
4. **Code smells** — duplicate strings, identical functions, redundant jumps

Rollout uses `'error'` rules on clean code + `'off'` overrides for known legacy files. Legacy files are tracked explicitly in `eslint.config.js` and removed as they're refactored.

**Trigger**: `InvoiceUploadDialog.tsx` reached 1,433 lines with mixed concerns. The CLAUDE.md architecture principle (components → hooks → lib → Supabase) needs machine enforcement.

---

## ⚠️ Critical: `--max-warnings=0` Already Active

`pnpm lint` runs `eslint . --max-warnings=0`. This means **any `'warn'`-level rule fails the pre-commit hook**. The "warn first, enforce later" strategy must work at the **file level**, not the rule level:

- New rules are set to `'error'` globally
- Legacy violating files get an explicit ESLint override block in `eslint.config.js` that sets those rules to `'off'`
- As files are refactored, they're removed from the override block
- No `/* eslint-disable */` inline comments — overrides stay in the config file, visible to code review

---

## Proposed Solution

### Libraries

```bash
pnpm add -D eslint-plugin-boundaries eslint-plugin-sonarjs@^1.0.4
```

- `eslint-plugin-boundaries` v5+ — ESLint 9 flat config compatible; enforces module layer model
- `eslint-plugin-sonarjs@^1.0.4` — pinned to v1; v2 has known ESLint 9 regressions (early 2025)
- No `eslint-plugin-unicorn` — too broad, too noisy for gradual adoption
- No `dependency-cruiser` — deferred (no IDE feedback loop; good for visualisation later)

### Architecture Boundary Model

```
pages/       → can import: components, hooks, lib, types
components/  → can import: components, hooks, types
             → BLOCKED from: lib/supabase-api, lib/airtable, lib/api (use api-provider instead)
             → ALLOWED: lib/utils, lib/errors, lib/api-provider (the approved facade)
hooks/       → can import: lib, types
lib/         → can import: anything (internal layer)
mcp/         → EXEMPT from all boundary + complexity rules
```

> Current state: all components already use `api-provider` correctly (preventative rule). One lib-to-lib violation exists (`src/lib/orders-api.ts` imports `./supabase-api` directly) — out of scope, lib-to-lib is allowed.

### Known Legacy Files (Initial `'off'` Override List)

| File | Violations |
|---|---|
| `src/components/invoice/InvoiceUploadDialog.tsx` | `max-lines` (1,433L), `max-lines-per-function`, `cognitive-complexity` |
| `src/components/product/EditProductDialog.tsx` | `max-lines` (843L), `max-lines-per-function`, `cognitive-complexity` |
| `src/components/product/CreateProductForm.tsx` | `max-lines` (536L), `max-lines-per-function` |

> Additional files may surface during the calibration step (Step 4 below).

---

## Technical Considerations

### `eslint.config.js` Changes

Three new config blocks appended to the existing array:

**Block 1 — Boundaries settings + rules (all `src/` files, `mcp/` excluded)**

```js
// eslint.config.js
import boundaries from 'eslint-plugin-boundaries'
import sonarjs from 'eslint-plugin-sonarjs'

// Inside defineConfig([...]):

// ── Block 1: Module boundary declarations ────────────────────────────────
{
  files: ['src/**/*.{ts,tsx}'],
  plugins: { boundaries },
  settings: {
    'boundaries/elements': [
      { type: 'pages',      pattern: 'src/pages/**' },
      { type: 'components', pattern: 'src/components/**' },
      { type: 'hooks',      pattern: 'src/hooks/**' },
      { type: 'lib',        pattern: 'src/lib/**' },
      { type: 'types',      pattern: 'src/types/**' },
      { type: 'assets',     pattern: 'src/assets/**' },
    ],
    'boundaries/ignore': ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
  },
  rules: {
    'boundaries/element-types': ['error', {
      default: 'allow',
      rules: [
        {
          from: ['components'],
          disallow: ['lib'],
          // Allow exceptions: utils, errors, api-provider are OK
          allow: [],
          // Combined with no-restricted-imports below for surgical ban
        },
        {
          from: ['hooks'],
          disallow: ['components', 'pages'],
        },
      ],
    }],
  },
},
```

> **Note**: `boundaries/element-types` alone cannot distinguish `lib/utils` from `lib/supabase-api`. Use `no-restricted-imports` (below) for surgical backend bans, and keep `boundaries` rule as a broader layer model.

**Block 2 — Surgical backend ban + complexity/size rules**

```js
// ── Block 2: Quality rules (src/ only, not mcp/) ──────────────────────────
{
  files: ['src/**/*.{ts,tsx}'],
  plugins: { sonarjs },
  rules: {
    // Architecture: ban direct backend access from components
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/lib/supabase*', '**/lib/airtable*'],
          message: 'Use lib/api-provider instead. Components must not access backends directly.',
        },
        {
          group: ['**/lib/api'],
          importNames: ['*'],
          message: 'Use lib/api-provider instead of the legacy Airtable api directly.',
        },
      ],
    }],

    // File size
    'max-lines': ['error', { max: 300, skipComments: true, skipBlankLines: true }],
    'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }],

    // Cognitive complexity
    'sonarjs/cognitive-complexity': ['error', 15],

    // Code smells
    'sonarjs/no-identical-functions': 'error',
    'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
    'sonarjs/no-all-duplicated-branches': 'error',
    'sonarjs/prefer-immediate-return': 'error',
    'sonarjs/no-redundant-jump': 'error',
  },
},
```

**Block 3 — Legacy allowlist (files with known violations)**

```js
// ── Block 3: Legacy allowlist — remove entries as files are refactored ───
{
  files: [
    // 1,433 lines — mixed OCR + pricing + UI concerns
    'src/components/invoice/InvoiceUploadDialog.tsx',
    // 843 lines — image upload + barcode scanner + stock in one file
    'src/components/product/EditProductDialog.tsx',
    // 536 lines — complex form with multi-step validation
    'src/components/product/CreateProductForm.tsx',
    // Add more here after calibration step
  ],
  rules: {
    'max-lines': 'off',
    'max-lines-per-function': 'off',
    'sonarjs/cognitive-complexity': 'off',
    'sonarjs/no-identical-functions': 'off',
    'sonarjs/no-duplicate-string': 'off',
  },
},
```

### `mcp/` Override (extend existing)

The existing `mcp/` override already disables `react-refresh`. Extend it to also disable the new rules:

```js
{
  files: ['mcp/**/*.{ts,tsx}'],
  rules: {
    'react-refresh/only-export-components': 'off',
    'boundaries/element-types': 'off',
    'no-restricted-imports': 'off',
    'max-lines': 'off',
    'max-lines-per-function': 'off',
    'sonarjs/cognitive-complexity': 'off',
    'sonarjs/no-identical-functions': 'off',
    'sonarjs/no-duplicate-string': 'off',
    'sonarjs/no-all-duplicated-branches': 'off',
    'sonarjs/prefer-immediate-return': 'off',
    'sonarjs/no-redundant-jump': 'off',
  },
},
```

---

## System-Wide Impact

- **IDE feedback**: ESLint rules run in VS Code/WebStorm via ESLint LSP — developers see errors inline while coding
- **Pre-commit hook**: No changes to `.git-hooks/pre-commit` — `pnpm lint` already runs there; new rules flow through automatically
- **CI pipeline**: `pnpm lint` runs in CI; new rules affect all PRs immediately
- **Existing `eslint-disable` comments**: 4 existing inline suppressions in `MobileCartBar.tsx`, `ProductHistory.tsx`, `badge.tsx`, `button.tsx` are unrelated to the new rules — unaffected
- **No script changes**: `package.json` scripts unchanged; only `eslint.config.js` is modified

---

## Acceptance Criteria

- [ ] `pnpm add -D eslint-plugin-boundaries eslint-plugin-sonarjs@^1.0.4` succeeds, packages appear in `devDependencies`
- [ ] `pnpm lint` passes (no errors, no warnings) on the current codebase after adding rules + legacy overrides
- [ ] Creating a new component file that directly imports from `lib/supabase-api` triggers an ESLint error in IDE and fails `pnpm lint`
- [ ] Creating a component file over 300 non-blank, non-comment lines triggers `max-lines` error
- [ ] Legacy files (`InvoiceUploadDialog.tsx`, `EditProductDialog.tsx`, `CreateProductForm.tsx`) do **not** fail lint (they are in the override block)
- [ ] `mcp/` files do not trigger any of the new rules
- [ ] Pre-commit hook (`pnpm check-root-files && pnpm validate-docs && pnpm typecheck && pnpm lint && CI=true pnpm test:e2e`) passes end-to-end
- [ ] Calibration step completed: additional violating files identified and added to legacy allowlist before finalising

---

## Implementation Steps

### Step 1 — Install plugins
```bash
pnpm add -D eslint-plugin-boundaries eslint-plugin-sonarjs@^1.0.4
```

### Step 2 — Update `eslint.config.js`
Add the three new blocks (boundaries, quality rules, legacy allowlist) and extend the `mcp/` override. Reference the config snippets in the Technical Considerations section above.

### Step 3 — Calibration audit
Run lint and count violations:
```bash
pnpm lint 2>&1 | grep -E "error|warning" | head -50
```
Add any newly discovered violating files to the legacy allowlist block. Adjust `cognitive-complexity` threshold or `max-lines-per-function` if violations are excessive (aim for < 10 legacy exceptions).

### Step 4 — Verify pre-commit passes
```bash
pnpm check-root-files && pnpm validate-docs && pnpm typecheck && pnpm lint
```
(Skip e2e for local verification.)

### Step 5 — Commit
```bash
git add eslint.config.js package.json pnpm-lock.yaml
git commit -m "feat: enforce ESLint quality boundaries and complexity rules"
```

---

## Phase 2: Refactor Legacy Files (Separate Task)

Once enforcement is in place, plan refactors to remove files from the legacy allowlist:

| Target | Refactor Plan |
|---|---|
| `InvoiceUploadDialog.tsx` | Extract `useInvoiceImport.ts` hook (business logic) + `InvoicePreviewTable.tsx` (table UI) + thin dialog shell |
| `EditProductDialog.tsx` | Extract `useProductEdit.ts` hook + `ProductImageSection.tsx` + `BarcodeSection.tsx` |
| `CreateProductForm.tsx` | Extract `useCreateProduct.ts` hook |

Each refactor reduces the legacy allowlist by one entry. When the list is empty, the `'off'` override block is removed entirely.

---

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| `eslint-plugin-boundaries` misconfigured element types cause false positives | Test with `pnpm lint` before committing; patterns mirror exact `src/` directory structure |
| `sonarjs` v1.0.4 has gaps vs v2 | Acceptable — v1 is stable; v2 regressions on ESLint 9 confirmed as of early 2025 |
| Calibration step reveals many more legacy violations than expected | Raise `max-lines` threshold or add more legacy overrides; document tech debt |
| `boundaries/element-types` can't distinguish `lib/utils` from `lib/supabase-api` | Use `no-restricted-imports` for the surgical backend ban; `boundaries` handles broader layer enforcement |

---

## Sources & References

### Origin
- **Brainstorm document**: [docs/brainstorms/2026-02-25-strict-pre-commit-quality-checks-brainstorm.md](../brainstorms/2026-02-25-strict-pre-commit-quality-checks-brainstorm.md)
  Key decisions carried forward: (1) library-based approach over custom scripts, (2) `'error'`+`'off'` overrides due to `--max-warnings=0`, (3) block only backend imports from components (not all of `lib/`)

### Internal References
- Current ESLint config: `eslint.config.js` (no imports to extend, clean starting point)
- Pre-commit hook: `.git-hooks/pre-commit`
- Architecture layer boundary: `src/lib/api-provider.ts` (the approved facade for components)
- Large files to allowlist: `src/components/invoice/InvoiceUploadDialog.tsx:1`, `src/components/product/EditProductDialog.tsx:1`, `src/components/product/CreateProductForm.tsx:1`

### External References
- [eslint-plugin-boundaries docs](https://github.com/javierbrea/eslint-plugin-boundaries)
- [eslint-plugin-sonarjs v1 stable](https://github.com/SonarSource/eslint-plugin-sonarjs)
- [ESLint max-lines rule](https://eslint.org/docs/latest/rules/max-lines)
- [ESLint no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports)
