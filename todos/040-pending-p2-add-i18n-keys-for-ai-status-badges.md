---
status: pending
priority: p2
issue_id: "040"
tags: [code-review, i18n, ux, react]
dependencies: []
---

# Add Locale Keys For AI Status Badges

CreateProductForm adds new AI status badges but ships English fallback text only.

## Problem Statement

New user-facing badge copy was added for AI auto-fill states, but locale keys were not added to translation files. Non-English users will see English copy in a localized UI.

## Findings

- `src/components/product/CreateProductForm.tsx:244` uses `t('product.aiStatusFound', 'AI details found')`.
- `src/components/product/CreateProductForm.tsx:249` uses `t('product.aiStatusNotFound', 'No AI match, fill manually')`.
- `src/components/product/CreateProductForm.tsx:254` uses `t('product.aiStatusError', 'AI unavailable, fill manually')`.
- Keys are missing from locale files (`src/locales/en.json`, `src/locales/ro.json`, `src/locales/ru.json`, `src/locales/es.json`).
- This is a UX consistency regression for localized deployments.

## Proposed Solutions

### Option 1: Add Keys To Existing Product Locale Namespace

**Approach:** Add `aiStatusFound`, `aiStatusNotFound`, and `aiStatusError` under `product` in all locale files.

**Pros:**
- Minimal change set.
- Preserves current component API.
- Keeps copy centralized in locale files.

**Cons:**
- Requires translation strings in 4 locale files.
- Slight coordination cost for wording review.

**Effort:** 30-60 min

**Risk:** Low

---

### Option 2: Reuse Existing Generic Keys

**Approach:** Replace new text with existing translated keys if semantically equivalent.

**Pros:**
- Avoids adding new translation keys.
- Smaller locale maintenance surface.

**Cons:**
- Existing keys may be semantically weaker.
- Can reduce clarity of AI-specific feedback.

**Effort:** 30 min

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/components/product/CreateProductForm.tsx:244`
- `src/components/product/CreateProductForm.tsx:249`
- `src/components/product/CreateProductForm.tsx:254`
- `src/locales/en.json`
- `src/locales/ro.json`
- `src/locales/ru.json`
- `src/locales/es.json`

**Database changes:**
- None

## Resources

- Review context: current branch uncommitted review for issues `#27`, `#40`, `#45`
- Component: `src/components/product/CreateProductForm.tsx`

## Acceptance Criteria

- [ ] New AI status keys exist in all supported locale files.
- [ ] CreateProductForm uses translated strings without fallback English text in production paths.
- [ ] Existing i18n tests/build checks pass.
- [ ] Non-English locale renders localized AI status badges.

## Work Log

### 2026-02-18 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed CreateProductForm diff and identified three new translation keys.
- Verified keys are referenced only in component and absent from locale JSON files.
- Assessed user impact on non-English locales.

**Learnings:**
- Feature behavior is correct, but localization completeness is incomplete.

## Notes

- Priority set to P2 due to user-facing localization regression.
