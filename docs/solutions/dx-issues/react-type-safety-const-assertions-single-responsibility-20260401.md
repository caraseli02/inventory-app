---
title: React Type Safety Patterns - const Assertions and Single Responsibility
date: 2026-04-01
category: dx-issues
module: frontend
problem_type: developer_experience
component: react_component
severity: medium
symptoms:
  - CategoryChips component accepted any string instead of valid categories
  - Toast action handler combined execution and dismiss responsibilities
  - Nullable stock checks were implicit rather than explicit
applies_when:
  - Creating category or enum-like types in TypeScript
  - Working with React component click handlers
  - Handling nullable values from external APIs
root_cause: type_error
resolution_type: refactor
tags:
  - typescript
  - react
  - type-safety
  - const-assertion
  - single-responsibility
  - null-safety
---

# React Type Safety Patterns - const Assertions and Single Responsibility

## Context

During code review of inventory app UI components, several type safety and design pattern issues were identified:
- Category selection accepted any string instead of only valid categories
- Toast action handler mixed two responsibilities (action execution + dismiss)
- Nullable stock value checks were implicit rather than explicit

## Guidance

### 1. Use `as const` for Type-Safe Enum-Like Arrays

When defining a fixed set of categories or options, use TypeScript's `as const` assertion and derive the type from the array values:

**Before:**
```typescript
const COMMON_CATEGORIES = ['General', 'Produce', 'Dairy', 'Meat', 'Pantry', 'Snacks', 'Beverages'];

interface CategoryChipsProps {
  selectedCategory: string | null; // ❌ Accepts ANY string
  onCategorySelect: (category: string | null) => void;
}
```

**After:**
```typescript
const COMMON_CATEGORIES = ['General', 'Produce', 'Dairy', 'Meat', 'Pantry', 'Snacks', 'Beverages'] as const;

export type Category = typeof COMMON_CATEGORIES[number];

interface CategoryChipsProps {
  selectedCategory: Category | null; // ✅ Only valid categories
  onCategorySelect: (category: Category | null) => void;
}
```

### 2. Separate Action Execution from Side Effects

Toast action handlers should execute the user's action without mixing in dismiss logic:

**Before:**
```typescript
<button
  onClick={() => {
    toast.action!.action();        // User action
    setIsLeaving(true);            // ❌ Dismiss logic mixed in
    setTimeout(() => onDismiss(toast.id), 300);
  }}
>
```

**After:**
```typescript
<button
  onClick={() => {
    toast.action!.action();        // ✅ Just execute the action
  }}
>
```

Let the toast's main timer handle dismissal. If immediate dismiss is needed, make it a separate, explicit step.

### 3. Make Null Checks Explicit for Clarity

When validating values from external APIs (Supabase, Airtable, etc.), write null checks explicitly even if `typeof` technically excludes them:

**Before:**
```typescript
const stockValue = product.fields['Current Stock Level'];
const currentStock =
  typeof stockValue === 'number' && Number.isFinite(stockValue) ? stockValue : 0;
```

**After:**
```typescript
const stockValue = product.fields['Current Stock Level'];
// Explicit null check for clarity - typeof null === 'object', but we guard against type mismatches
const currentStock =
  (stockValue !== null && typeof stockValue === 'number' && Number.isFinite(stockValue))
    ? stockValue
    : 0;
```

The comment acknowledges that `typeof null === 'object'` (not `'number'`), but the explicit check serves as documentation and guards against future type definition changes.

## Why This Matters

- **Type safety**: `as const` + derived types prevent invalid values at compile time
- **Single responsibility**: Separating concerns makes code easier to test and reason about
- **Maintainability**: Explicit checks document intent for future readers
- **Debugging**: When type mismatches occur, derived types point directly to the source array

## When to Apply

- Creating category filters, status enums, or fixed option sets in UI components
- Writing click handlers that should do one clear thing
- Validating data from external sources where the TypeScript type may not match runtime reality

## Examples

### Type-Safe Category Chips Component

```typescript
import { Badge } from '@/components/ui/badge';

const COMMON_CATEGORIES = ['General', 'Produce', 'Dairy', 'Meat', 'Pantry', 'Snacks', 'Beverages'] as const;
export type Category = typeof COMMON_CATEGORIES[number];

interface CategoryChipsProps {
  selectedCategory: Category | null;
  onCategorySelect: (category: Category | null) => void;
}

export function CategoryChips({ selectedCategory, onCategorySelect }: CategoryChipsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <Badge
        variant={selectedCategory === null ? 'default' : 'outline'}
        onClick={() => onCategorySelect(null)}
        className="cursor-pointer whitespace-nowrap px-3 py-1.5"
      >
        All
      </Badge>
      {COMMON_CATEGORIES.map((cat) => (
        <Badge
          key={cat}
          variant={selectedCategory === cat ? 'default' : 'outline'}
          onClick={() => onCategorySelect(cat)}
          className="cursor-pointer whitespace-nowrap px-3 py-1.5"
        >
          {cat}
        </Badge>
      ))}
    </div>
  );
}
```

## Related

- CLAUDE.md: shadcn/ui component usage guidelines
- TypeScript Handbook: [Const Assertions](https://www.typescriptlang.org/docs/handbook/2/const-assertions.html)
