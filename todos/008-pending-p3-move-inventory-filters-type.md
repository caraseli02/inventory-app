---
status: pending
priority: p3
issue_id: "008"
tags: [code-review, architecture, types]
dependencies: ["001"]
---

# Move `InventoryFilters` type from hooks to src/types/ before boundary rules go live

## Problem Statement

`src/lib/filters.ts` imports `InventoryFilters` type from `src/hooks/useInventoryList`. This creates a lib → hooks upward dependency, inverting the intended layer hierarchy (`hooks` should depend on `lib`, not vice versa). While this won't immediately cause issues (the no-restricted-imports rule targets components, not lib), it contradicts the stated architecture model and should be resolved before any boundary enforcement is added.

## Findings

- Architecture reviewer (P1 for model accuracy, P3 for urgency): "`src/lib/filters.ts` imports from `../hooks/useInventoryList` — a lib-to-hooks upward dependency"
- This is a type-only import for `InventoryFilters`
- `src/types/` already exists and is the correct home for cross-layer types

## Proposed Solutions

### Solution A: Move `InventoryFilters` to `src/types/inventory.ts` (Recommended)

1. Move `InventoryFilters` interface from `src/hooks/useInventoryList.ts` to `src/types/inventory.ts`
2. Update `src/lib/filters.ts` to import from `../../types/inventory`
3. Update `src/hooks/useInventoryList.ts` to import from `../types/inventory`

**Pros**: Resolves architectural inversion, clean types layer
**Effort**: Small
**Risk**: Low

## Recommended Action

Solution A — do this as a prerequisite before boundary rules ship.

## Acceptance Criteria

- [ ] `InventoryFilters` lives in `src/types/inventory.ts`
- [ ] `src/lib/filters.ts` imports from `src/types/`, not `src/hooks/`
- [ ] `pnpm typecheck` passes after the move

## Work Log

- 2026-02-25: Created during review of `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`

## Resources

- Architecture reviewer finding: lib→hooks import inversion
