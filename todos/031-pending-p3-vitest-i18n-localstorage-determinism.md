---
status: pending
priority: p3
issue_id: "031"
tags: [code-review, tests, i18n, reliability]
dependencies: []
---

# Make vitest language + localStorage deterministic

## Problem Statement

Unit tests import `src/i18n.ts` in global vitest setup. In the current jsdom test environment, `localStorage.getItem/setItem` is not a function (warnings), causing i18n to fall back to Spanish by default. Individual test files then mutate global i18n language to English, which can be flaky if tests execute in parallel.

## Findings

- i18n init reads `localStorage.getItem('preferredLanguage')` and falls back to `'es'`:
  - `src/i18n.ts:17`
  - `src/i18n.ts:45`
- Vitest setup imports i18n globally:
  - `src/test/setup.ts:9`
- Some tests force `i18n.changeLanguage('en')` inside the test file to keep expectations stable:
  - `tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx:29`
- Because i18n is a shared singleton across the test process, per-file language mutation can leak between tests when files run concurrently.
- Even within a single file, setting language in `beforeEach` adds repeated state churn; `beforeAll` is sufficient when tests assume a single language.

## Proposed Solutions

### Option 1: Provide a robust `localStorage` shim in `src/test/setup.ts`

**Approach:** Define `window.localStorage` with `getItem/setItem/removeItem/clear` before i18n initialization, and set `preferredLanguage` to `'en'` for tests.

**Pros:**
- Deterministic language across the whole suite
- Removes noisy warnings

**Cons:**
- Need to ensure shim runs *before* importing `../i18n` (may require import order change / dynamic import)

**Effort:** Small

**Risk:** Low

---

### Option 2: Make i18n default to English under test

**Approach:** In `src/i18n.ts`, detect test mode (e.g., `import.meta.env.MODE === 'test'`) and return `'en'` without touching localStorage.

**Pros:**
- Simple, no shim needed

**Cons:**
- Slightly couples runtime i18n to test environment detection

**Effort:** Small

**Risk:** Low

---

### Option 3: Freeze i18n per-test (avoid global mutation)

**Approach:** Avoid calling `i18n.changeLanguage` in test files; instead, render with a provider configured per-test (or mock `useTranslation`).

**Pros:**
- No global state mutation

**Cons:**
- More refactor across many tests

**Effort:** Medium

**Risk:** Low

---

### Option 4: Minimize mutation within a file

**Approach:** Replace per-test `beforeEach` language switching with `beforeAll` where possible.

**Pros:**
- Less state churn and fewer warnings
- Keeps current test expectations intact

**Cons:**
- Still depends on global i18n singleton

**Effort:** Small

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/test/setup.ts`
- `src/i18n.ts`
- Tests that currently call `i18n.changeLanguage(...)`

## Acceptance Criteria

- [ ] No `localStorage.getItem/setItem is not a function` warnings in unit tests
- [ ] Default test language is deterministic across the suite
- [ ] Tests do not rely on cross-file i18n global state

## Work Log

### 2026-03-20 - Review finding

**By:** Codex

**Actions:**
- Identified localStorage/i18n initialization as a source of warning noise + potential parallel-test flakiness.
