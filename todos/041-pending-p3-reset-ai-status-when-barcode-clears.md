---
status: pending
priority: p3
issue_id: "041"
tags: [code-review, state-management, react, ux]
dependencies: []
---

# Reset AI Status When Barcode Becomes Empty

AI status state can retain stale value if barcode is cleared after a previous lookup.

## Problem Statement

CreateProductForm initializes `aiStatus` as `idle`, but when `barcode` is empty inside the effect it returns early without resetting state. If barcode transitions from a valid value to empty, the previous status badge can remain visible.

## Findings

- Effect guard in `src/components/product/CreateProductForm.tsx:48` returns on empty barcode.
- No `setAiStatus('idle')` path exists for empty barcode after prior non-empty states.
- Stale badge states are possible in edge flows where barcode is edited/cleared while form remains mounted.

## Proposed Solutions

### Option 1: Explicitly Reset To idle On Empty Barcode

**Approach:** Add a state reset when barcode is empty (while preserving lint constraints, e.g., derived render state or guarded state transition outside direct sync set-in-effect violation).

**Pros:**
- Fixes stale UI state deterministically.
- Small, localized change.

**Cons:**
- Must satisfy react-hooks lint rule (`set-state-in-effect`).
- Requires careful implementation pattern.

**Effort:** 30-60 min

**Risk:** Low

---

### Option 2: Derive Display Badge From Barcode + aiStatus

**Approach:** Keep internal status but hide any status badge when barcode is empty using derived render guard.

**Pros:**
- No effect-state update needed.
- Works well with current lint constraints.

**Cons:**
- Internal state still stale, only display is masked.
- Slightly less explicit semantics.

**Effort:** 20-40 min

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/components/product/CreateProductForm.tsx:47`

**Database changes:**
- None

## Resources

- Review context: current branch uncommitted review for issues `#27`, `#40`, `#45`
- Component: `src/components/product/CreateProductForm.tsx`

## Acceptance Criteria

- [ ] AI status badge is not shown when barcode is empty.
- [ ] Transition from non-empty barcode to empty barcode clears visible AI status.
- [ ] Existing lint rules remain satisfied.
- [ ] Unit/component test covers clear-barcode transition.

## Work Log

### 2026-02-18 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed barcode-driven effect and state transitions.
- Identified missing reset path for empty barcode branch.
- Evaluated low-risk remediation options.

**Learnings:**
- Current behavior is mostly fine for typical scan flow, but edge-case state consistency can be improved.

## Notes

- Priority set to P3 since impact is edge-case UI correctness, not data integrity.
