---
module: eslint.config.js
date: 2026-02-25
problem_type: developer_experience
component: build_config
symptoms:
  - "Components grew to 1,433 lines with no automated enforcement signal"
  - "No architecture boundary prevented components importing supabase-api directly"
  - "ESLintIgnoreWarning emitted at runtime (ESLint 9 does not read .eslintignore)"
root_cause: config_error
resolution_type: config_change
severity: medium
tags: [eslint, flat-config, sonarjs, pre-commit, quality-enforcement, max-lines, cognitive-complexity]
commit: f6882fc
---

# No ESLint Quality Rules — Components Grew Unchecked

## Problem Description

A React + TypeScript + Vite project had no automated code quality enforcement at the linting level. Components grew unchecked with no file size limits, no cognitive complexity rules, and no architecture boundary enforcement. The most severe case: `InvoiceUploadDialog.tsx` reached 1,433 lines with OCR parsing, price calculations, and UI rendering all in one file.

Additionally, `--max-warnings=0` was already active in the lint script, which created a constraint: the standard "warn first, enforce later" strategy (setting new rules to `'warn'` and promoting to `'error'` after cleanup) was unavailable — **any warning fails CI immediately**.

A `.eslintignore` file also existed at the root, which ESLint 9 flat config does not read. It emits an `ESLintIgnoreWarning` at runtime, which under `--max-warnings=0` is a latent CI failure trigger.

## Symptoms

- Files like `InvoiceUploadDialog.tsx` (1,433L), `CheckoutPage.tsx` (1,146L), `InventoryListPage.tsx` (767L) grew with no automated signal
- Direct imports from `lib/supabase-api.ts` in `components/` were possible (bypassing `lib/api-provider` facade)
- `pnpm lint` emitted `ESLintIgnoreWarning` about the `.eslintignore` file

## Root Cause Analysis

`eslint.config.js` contained only TypeScript and React-Hooks rules. No quality metrics, no import boundary rules, no file/function size enforcement.

```js
// ❌ BEFORE — eslint.config.js had no quality rules
export default defineConfig([
  globalIgnores(['dist', '.nuxt', '.output', 'docs/**', 'coverage/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    // No max-lines, no complexity, no import boundaries
  },
])
```

A `.eslintignore` file contained `*.test.ts` — a pattern that ESLint 9 ignores entirely, emitting a warning.

The `--max-warnings=0` constraint inverts the standard rollout strategy:
- Standard approach: set new rules to `'warn'`, observe, promote to `'error'`
- Correct approach when `--max-warnings=0` is active: set rules to `'error'` globally, use `'off'` overrides **per file** for known legacy violations

## Solution

### Step 1 — Install eslint-plugin-sonarjs v1 (pin to v1, not v2)

SonarJS v2 has known ESLint 9 flat config regressions as of early 2025:

```bash
pnpm add -D eslint-plugin-sonarjs@^1.0.4
```

### Step 2 — Calibrate thresholds before writing rules

Run lint with candidate strict thresholds first, then adjust to the natural breakpoint:

- `max-lines: 300` — revealed many legitimate 300–400L files. Raised to **400**.
- `sonarjs/cognitive-complexity: 15` — normal React components (multi-branch handlers, form validation) scored 15–19. Raised to **20**.
- `max-lines-per-function: 80` for `.tsx` — hook declarations (`useCallback`, `useEffect` stacks) legitimately exceed 80L. **Excluded `.tsx` entirely**; applied only to `.ts`.

### Step 3 — Delete .eslintignore and migrate to globalIgnores()

```bash
rm .eslintignore
```

```js
// ✅ AFTER — patterns live in eslint.config.js
globalIgnores([
  'dist', '.nuxt', '.output', 'docs/**', 'coverage/**',
  '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx',
  'src/lib/database.types.ts',  // generated Supabase type file — never lint
]),
```

### Step 4 — Add quality rule blocks to eslint.config.js

```js
// ✅ AFTER — eslint.config.js
import sonarjs from 'eslint-plugin-sonarjs'

// Quality rules: all src/ files
{
  files: ['src/**/*.{ts,tsx}'],
  plugins: { sonarjs },
  rules: {
    'max-lines': ['error', { max: 400, skipComments: true, skipBlankLines: true }],
    'sonarjs/cognitive-complexity': ['error', 20],
  },
},

// Architecture boundary: components/ only
// lib/ may import supabase-api directly by design — scope this rule narrowly
{
  files: ['src/components/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/lib/supabase*', '**/lib/airtable*'],
        message: 'Use lib/api-provider instead.',
      }],
    }],
  },
},

// Function size: .ts only (.tsx excluded — hooks legitimately exceed 80L)
{
  files: ['src/**/*.ts'],
  rules: {
    'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }],
  },
},

// Legacy allowlist — 18 files; remove entries as files are refactored
{
  files: [
    'src/components/invoice/InvoiceUploadDialog.tsx', // 1,433L
    'src/components/product/EditProductDialog.tsx',   // 843L
    // ... 16 more with TECHNICAL-DEBT comments
  ],
  rules: {
    'max-lines': 'off',
    'max-lines-per-function': 'off',
    'sonarjs/cognitive-complexity': 'off',
  },
},
```

### Step 5 — Verify

```bash
pnpm lint       # must exit 0 with zero warnings
pnpm typecheck  # confirm no TypeScript regressions
```

## Files Changed

- `eslint.config.js` — added 4 new config blocks; migrated ignore patterns to `globalIgnores()`
- `.eslintignore` — deleted; patterns moved to `globalIgnores()`
- `package.json` + `pnpm-lock.yaml` — added `eslint-plugin-sonarjs@^1.0.4` devDependency

## Prevention

- [x] No ESLint quality rules existed — now enforced via pre-commit hook
- [x] Architecture boundary rule added — components cannot import backends directly
- [ ] Phase 2: refactor 18 legacy files off the allowlist (tracked in `todos/`)

**Warning signs a file is becoming a candidate for the legacy allowlist:**
- File exceeds 250 lines and is still growing
- A single event handler (`handleSubmit`, `handleImport`) is longer than 40 lines
- The file has both data-fetching logic and rendering logic in the same component body
- You're importing from `lib/supabase-api.ts` inside a component instead of `lib/api-provider`

**Legacy allowlist protocol:**
- Add only pre-existing violations; never add violations introduced in the current sprint
- Disable only the specific rule violated, not all rules
- Add a `// TECHNICAL-DEBT:` comment with line count and refactor intent
- Create a corresponding `todos/NNN-pending-pN-description.md` in the same commit

## Key Insights

**`--max-warnings=0` inverts the standard rollout strategy.** When warnings fail CI, the `'error'` + `'off'`-per-legacy-file pattern is the correct approach. The allowlist is the backlog; files are removed from it as they are refactored.

**Calibrate thresholds against the real codebase before committing.** Running lint at textbook values (300 lines, complexity 15) and discovering 40 violations is worse than calibrating first. Find the natural breakpoint between "legitimately large" and "problematic".

**Scope `no-restricted-imports` to the violation site, not globally.** `lib/` files import `supabase-api.ts` by design. Scoping to `src/components/**` enforces the boundary at exactly the layer that must not cross it — no false positives inside `lib/`.

**`max-lines-per-function` is incompatible with `.tsx` files.** React hook declarations (`useCallback`, `useEffect`, `useMemo` stacks) inflate line counts without adding logical complexity. Apply only to `.ts` files; use `sonarjs/cognitive-complexity` for `.tsx` complexity enforcement.

**`eslint-plugin-boundaries` is not worth the config cost here.** The architecture boundary requirement is fully expressed in 4 lines of `no-restricted-imports`. Prefer the simpler primitive when it covers the requirement.

**`eslint-plugin-sonarjs` v2 is not safe for ESLint 9 as of early 2025.** Pin to `^1.0.4`. The v2 branch had known flat config regressions.

**`.eslintignore` is a latent CI failure in ESLint 9.** It must be deleted and its patterns migrated to `globalIgnores()` before adding any new rules — otherwise the warning it produces will fail CI under `--max-warnings=0`.

## Related

- Prior `developer_experience` + `build_config` solution: `docs/solutions/dx-issues/push-diff-and-risk-policy-ciconfig-20260217.md`
- Brainstorm: `docs/brainstorms/2026-02-25-strict-pre-commit-quality-checks-brainstorm.md`
- Implementation plan: `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`
- PR: [#134](https://github.com/caraseli02/inventory-app/pull/134)
