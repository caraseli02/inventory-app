---
status: pending
priority: p2
issue_id: "104"
tags: [code-review, typescript, type-safety]
dependencies: []
---

## Problem Statement

`isSelectionExpired` and `resolveSelectionByIndex` in `lib/whatsapp/selection-resolver.ts` accept a loose `Record<string, unknown> | null` type and internally cast `selection.items as string[]` without runtime validation. If the stored shape ever diverges from expectations, the cast silently succeeds and produces a runtime error deeper in the call stack — far from the source.

## Findings

Current signatures accept the weakest possible typed input:

```ts
function isSelectionExpired(selection: Record<string, unknown> | null): boolean
function resolveSelectionByIndex(selection: Record<string, unknown> | null, index: number): ...
```

Inside both functions, fields are accessed via casts such as `selection.items as string[]` and `selection.expiresAt as string` with no structural check. There are at least three conceptually distinct pending-selection shapes in the system:

- `PendingCategoryList` — user is choosing a category
- `PendingProductList` — user is choosing among matched products
- `PendingAwaitingQty` — product chosen, awaiting quantity input

A discriminated union on a `kind` or `type` field would allow TypeScript to narrow automatically, eliminate all unsafe casts, and make `switch` statements exhaustive (enforced by the compiler).

## Proposed Solutions

### Option 1: Introduce a discriminated union type
Define:

```ts
type PendingSelection =
  | { kind: 'category-list'; items: string[]; expiresAt: string }
  | { kind: 'product-list'; items: ProductRef[]; expiresAt: string }
  | { kind: 'awaiting-qty'; productId: string; expiresAt: string };
```

Update function signatures to accept `PendingSelection | null`, remove all `as` casts, and add an exhaustive `switch` where the variant matters.

**Pros:** Full compile-time safety; exhaustive coverage enforced by TypeScript; no runtime casts.
**Cons:** Requires updating the Supabase storage layer to persist and read the `kind` discriminant; existing stored rows need a migration or a read-time default.
**Effort:** Medium
**Risk:** Medium (touches storage format)

### Option 2: Add a runtime validator/guard function
Keep the loose input type but add a `isPendingSelection(x: unknown): x is PendingSelection` type guard that validates the shape before use. Throw or return `null` if validation fails.

**Pros:** Safer than raw casts without requiring a schema migration; can be introduced incrementally.
**Cons:** Discriminated union still not enforced at the call site; validation code is extra surface area.
**Effort:** Small
**Risk:** Low

### Option 3: Use a schema validation library (e.g., Zod)
Define a Zod schema for each selection variant and parse at the database boundary.

**Pros:** Reusable; auto-generates TypeScript types; parse errors are structured.
**Cons:** Adds a dependency (Zod) if not already present; slightly more setup than Option 2.
**Effort:** Medium
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files: `lib/whatsapp/selection-resolver.ts`
- Functions: `isSelectionExpired`, `resolveSelectionByIndex`
- Unsafe patterns: `selection.items as string[]`, `selection.expiresAt as string`

## Acceptance Criteria
- [ ] No unchecked `as` casts on `selection` fields in `selection-resolver.ts`
- [ ] At least two distinct selection shapes are modelled as separate TypeScript types
- [ ] A switch or if-chain over the discriminant is exhaustive (or covered by a type guard)
- [ ] Existing unit tests in `tests/unit/lib/whatsapp-selection-resolver.test.ts` continue to pass
- [ ] New test cases cover an invalid/missing `kind` value

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
