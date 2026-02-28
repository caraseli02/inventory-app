import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import sonarjs from 'eslint-plugin-sonarjs'

export default defineConfig([
  // Merged from .eslintignore (ESLint 9 flat config: use globalIgnores instead)
  globalIgnores([
    'dist',
    '.nuxt',
    '.output',
    'docs/**',
    'coverage/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    // Generated file — never lint
    'src/lib/database.types.ts',
  ]),

  // ── Base rules ────────────────────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // ── Quality rules: all src/ files ─────────────────────────────────────────
  // Phase 1: file size + cognitive complexity
  // Thresholds calibrated against current codebase (2026-02-25):
  //   max-lines 400 — files over this are mixed-concern candidates
  //   cognitive-complexity 20 — functions over this are hard to reason about
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { sonarjs },
    rules: {
      'max-lines': ['error', { max: 400, skipComments: true, skipBlankLines: true }],
      'sonarjs/cognitive-complexity': ['error', 20],
    },
  },

  // ── Architecture: ban direct backend access from components/ ──────────────
  // Scoped to components/ only — lib/ may import supabase-api directly (by design).
  // Use lib/api-provider as the approved facade from component code.
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/lib/supabase*', '**/lib/airtable*'],
            message: 'Use lib/api-provider instead. Components must not access backends directly.',
          },
        ],
      }],
    },
  },

  // ── max-lines-per-function: .ts files only ────────────────────────────────
  // .tsx components excluded: hook declarations legitimately exceed 80 lines.
  // sonarjs/cognitive-complexity handles .tsx complexity enforcement instead.
  {
    files: ['src/**/*.ts'],
    rules: {
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }],
    },
  },

  // ── Legacy allowlist ──────────────────────────────────────────────────────
  // Known violations as of 2026-02-25. Remove entries as files are refactored.
  // New files are NOT eligible for this list — fix violations before committing.
  {
    files: [
      // ── Components (mixed concerns or large) ──

      // ── Hooks (large functions) ──




      // ── Lib: backend + data layer ──
      // NEEDS-EVALUATION: complexity 23/26 — legacy Airtable code, deferred until
      // Airtable backend is fully removed or migrated to supabase-api
      'src/lib/api.ts',


// NEEDS-EVALUATION: 141L function, complexity 35 — column mapper extraction
      // strategy unclear; evaluate before refactoring (skip for now)
      'src/lib/xlsx/index.ts',

      // ── Pages (large or complex) ──
    ],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/cognitive-complexity': 'off',
    },
  },

  // ── mcp/: Node.js server — different architecture, exempt from quality rules ──
  {
    files: ['mcp/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'no-restricted-imports': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/cognitive-complexity': 'off',
    },
  },
])
