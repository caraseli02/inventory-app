---
status: complete
priority: p3
issue_id: "018"
tags: [code-review, i18n, cleanup]
dependencies: []
---

# Unused markup locale keys remain after formula wording changes

## Problem Statement

Locale keys `markup.effective` and `markup.effectiveFormula` were added but are no longer referenced after formula rendering was switched away from effective-percentage wording.

## Findings

- Keys exist in all locale files.
- No component references these keys now.
- Evidence:
  - `src/locales/en.json:184`
  - `src/locales/ro.json:184`
  - `src/locales/es.json:184`
  - `src/locales/ru.json:184`
  - no usages found by `rg "effectiveFormula|markup.effective" src`

## Proposed Solutions

### Option 1: Remove unused keys

**Approach:** Delete `effective` and `effectiveFormula` from all locale files.

**Pros:** Cleaner i18n surface.

**Cons:** None if not needed.

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep keys for planned UX variant

**Approach:** Leave keys with a TODO reference to future usage.

**Pros:** Avoids re-translation later.

**Cons:** Dead config clutter.

**Effort:** Small

**Risk:** Low

## Recommended Action


## Technical Details

- `src/locales/en.json`
- `src/locales/ro.json`
- `src/locales/es.json`
- `src/locales/ru.json`

## Acceptance Criteria

- [x] No unused locale keys in `markup` namespace for this feature
- [x] Locale validation/tests remain green

## Work Log

### 2026-02-11 - Review finding

**By:** Codex

**Actions:**
- Searched locale and source usage for newly introduced keys.
- Logged dead-key cleanup for low-priority follow-up.

**Learnings:**
- Rapid copy iteration can leave i18n drift; quick key pruning prevents long-term bloat.


### 2026-02-16 - Implemented

**By:** Codex

**Actions:**
- Verified no runtime usage of `markup.effective` / `markup.effectiveFormula`.
- Confirmed keys were already absent from locale files and kept locale bundles clean.

**Outcome:**
- Marked cleanup complete with validation checks passing.
