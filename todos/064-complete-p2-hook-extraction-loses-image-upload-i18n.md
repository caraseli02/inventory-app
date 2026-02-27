---
status: complete
priority: p2
issue_id: "064"
tags: [code-review, i18n, react, refactor]
dependencies: []
---

# Restore I18n For CreateProduct Image Upload Failure

Refactor extracted upload error handling into `useCreateProduct.ts` and replaced localized message with hardcoded English text.

## Problem Statement

The extracted hook now throws a fixed English error string on image upload failure. This regresses localized UX and breaks consistency with existing i18n behavior in product creation errors.

## Findings

- `src/hooks/useCreateProduct.ts:75` throws a hardcoded string: `"Failed to upload product image. Please try again or proceed without an image."`.
- Before extraction, component code used translation key fallback via `t('errors.imageUploadFailed', ...)`, preserving locale-specific messaging.
- The error is surfaced to users through mutation `onError` toast in `src/hooks/useCreateProduct.ts:179-181`, so this string is user-visible.
- Regression scope: any locale other than English during image upload failure path.

## Proposed Solutions

### Option 1: Pass Translator Into `createProductWithStock`

**Approach:** Add `t` parameter to `createProductWithStock` and use `t('errors.imageUploadFailed')` for thrown message.

**Pros:**
- Restores previous localization behavior exactly.
- Minimal code change.
- Keeps current control flow intact.

**Cons:**
- Adds translation dependency to helper signature.

**Effort:** 20-40 min

**Risk:** Low

---

### Option 2: Throw Error Code, Map To Localized Copy In `onError`

**Approach:** Throw semantic error (`ImageUploadFailedError` or `code`) and map to i18n string in mutation `onError`.

**Pros:**
- Cleaner separation between domain errors and presentation text.
- Better long-term error handling consistency.

**Cons:**
- Slightly larger refactor.
- Needs careful compatibility with existing generic error flows.

**Effort:** 45-90 min

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/hooks/useCreateProduct.ts:75`
- `src/hooks/useCreateProduct.ts:179`
- (optional if missing) locale files for `errors.imageUploadFailed`

**Database changes:**
- None

## Resources

- PR: #141
- Branch: `refactor/allowlist-components`
- Related component: `src/components/product/CreateProductForm.tsx`

## Acceptance Criteria

- [ ] Image upload failure text is localized in all supported locales.
- [ ] No hardcoded user-facing English error remains in `useCreateProduct` upload failure path.
- [ ] Product creation error toast shows translated `errors.imageUploadFailed` copy.
- [ ] `pnpm lint` and `pnpm typecheck` pass.

## Work Log

### 2026-02-27 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed PR #141 refactor diff and compared pre/post error handling path.
- Located user-facing regression in extracted hook upload error branch.
- Validated toast error path still surfaces thrown message directly.
- Prepared remediation options with effort/risk tradeoffs.

**Learnings:**
- Refactors that move logic out of components can silently drop translation access unless explicitly threaded through.

### 2026-02-27 - Fix Implemented

**By:** Codex

**Actions:**
- Updated `createProductWithStock` to accept a localized `imageUploadFailedMessage`.
- Passed translated text from `useCreateProduct` mutation via `t('errors.imageUploadFailed', ...)`.
- Verified no hardcoded user-facing upload failure string remains in the hook path.
- Ran `pnpm lint` and `pnpm typecheck` successfully.

**Learnings:**
- Keeping user-facing copy at hook boundary (`t(...)`) preserves localization while retaining helper extraction.
