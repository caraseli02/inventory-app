---
module: useProductEdit
date: 2026-02-27
problem_type: state_issue
component: custom_hook
symptoms:
  - "Form reset logic performed state updates during render when product changed"
  - "Hook relied on tracked product id + render-phase setState pattern"
  - "Pattern increased risk under Strict/Concurrent rendering"
root_cause: logic_error
resolution_type: refactor
severity: medium
tags: [react, custom-hook, render-phase, state-reset, edit-product]
related_github_issue: null
commit: null
---

# Problem Description

`useProductEdit` used a render-phase reset block:
- compare `product.id` to tracked local id,
- then call `setState` in render to reinitialize form data.

The behavior worked in many cases but used a fragile React pattern that can cause extra renders and maintenance risk.

# Symptoms

- Hook contained direct `setTrackedProductId` + `setFormData` calls in render.
- Product-switch reset logic was coupled to render execution order.
- ESLint/React hook quality expectations were violated by pattern, not by runtime crash.

# Root Cause Analysis

Legacy reset logic was carried over during extraction without moving it into effect-driven state transitions.

```typescript
// ❌ BEFORE
if (product.id !== trackedProductId) {
  setTrackedProductId(product.id);
  setFormData(getInitialFormData(product));
}
```

Render-phase state writes are not the intended model for React state synchronization.

# Solution

Replaced render-phase reset with effect-driven synchronization:
- synchronize latest product reference in an effect,
- reset form data in a dedicated effect keyed by `product.id`.

```typescript
// ✅ AFTER
const productRef = useRef(product);

useEffect(() => {
  productRef.current = product;
}, [product]);

useEffect(() => {
  setFormData(getInitialFormData(productRef.current));
}, [product.id]);
```

This keeps behavior (form resets on product switch) while avoiding render-time state updates.

# Files Changed

- `src/hooks/useProductEdit.ts`

# Verification

- `pnpm lint`
- `pnpm typecheck`

Both passed after refactor.

# Prevention

- [x] Never call `setState` in render to synchronize prop changes.
- [x] Prefer effect-based reset patterns for prop-keyed local form state.
- [ ] Add unit test for "switch product in edit dialog resets form exactly once".
- [ ] Add lint review check for render-phase state writes in extracted hooks.

# Related

- `docs/solutions/ui-bugs/manual-submit-threshold-mismatch-ScanPage-20260227.md`
- `todos/063-complete-p2-avoid-setstate-during-render-in-useproductedit.md`
