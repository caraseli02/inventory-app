#!/usr/bin/env bash
# Creates 7 architectural issues identified during code review.
# Run: ./scripts/create-arch-issues.sh
# Requires: gh CLI authenticated (gh auth login)

set -euo pipefail

REPO="caraseli02/inventory-app"

echo "Creating 7 architectural issues for $REPO..."
echo ""

# Issue 1: CheckoutPage refactor
gh issue create --repo "$REPO" \
  --title "🔴 CRITICAL: Refactor CheckoutPage.tsx — 1,364 lines violates Single Responsibility" \
  --label "refactor" \
  --body "$(cat <<'EOF'
## Problem

`src/pages/CheckoutPage.tsx` is **1,364 lines** — the largest file in the codebase. It manages 6 separate concerns:

- Cart state (useReducer with 15+ action types)
- Barcode scanning logic
- Product search / lookup
- Checkout confirmation flow
- Multiple dialog states (summary, confirmation, error)
- UI layout & rendering

This violates the **Single Responsibility Principle**. Changing one feature (e.g., scanning) risks breaking another (e.g., cart logic).

## Proposed Solution

Break into smaller, focused modules:

```
CheckoutPage.tsx              (~200 lines — layout & orchestration)
├── hooks/useCheckoutCart.ts   ← Cart reducer + all cart logic
├── CheckoutScanner.tsx        ← Scanning section
├── CheckoutCartView.tsx       ← Cart items display
├── CheckoutSummaryDialog.tsx  ← Confirmation/summary flow
└── CheckoutSearchPanel.tsx    ← Product search integration
```

## Acceptance Criteria

- [ ] No single file exceeds 400 lines
- [ ] Each extracted module has a single responsibility
- [ ] All existing checkout functionality works identically
- [ ] Cart reducer logic is in a dedicated hook
- [ ] Build passes, no regressions
EOF
)"
echo "✅ Issue 1 created: CheckoutPage refactor"

# Issue 2: Event store types
gh issue create --repo "$REPO" \
  --title "🔴 CRITICAL: Add discriminated union types to event store — eliminate \`any\` usage" \
  --label "refactor" \
  --body "$(cat <<'EOF'
## Problem

The event store (`src/lib/event-store/store.ts`) uses `any` for event payloads:

```typescript
// Current
payload: any;
function mapRowToEvent(row: any): EventEnvelope
```

Also in `useAgentInbox.ts`:
```typescript
decisions.map(d => (d.payload as any).actionId)
```

This defeats TypeScript's compile-time safety on a critical data path. Type errors in events could corrupt data silently.

## Proposed Solution

Use **discriminated unions** for event payloads:

```typescript
type DomainEvent =
  | { type: 'ProductCreated'; payload: { productId: string; name: string; barcode?: string } }
  | { type: 'ProductUpdated'; payload: { productId: string; changes: Partial<Product> } }
  | { type: 'StockLevelChanged'; payload: { productId: string; delta: number; movementType: 'IN' | 'OUT' } }
  | { type: 'LowStockAlert'; payload: { productId: string; currentStock: number; minStock: number } }

interface EventEnvelope<T extends DomainEvent = DomainEvent> {
  id: string;
  type: T['type'];
  payload: T['payload'];
  timestamp: string;
}
```

## Acceptance Criteria

- [ ] Zero `any` usage in event store files
- [ ] All event types have explicit payload interfaces
- [ ] `mapRowToEvent` uses proper type narrowing
- [ ] `useAgentInbox` uses typed payload access (no `as any`)
- [ ] Build passes with `strict: true`
EOF
)"
echo "✅ Issue 2 created: Event store types"

# Issue 3: React Router
gh issue create --repo "$REPO" \
  --title "🟡 MEDIUM: Add React Router for URL-based navigation" \
  --label "enhancement" \
  --body "$(cat <<'EOF'
## Problem

The app currently uses `useState` for page switching:

```tsx
const [view, setView] = useState<'home' | 'manage' | 'checkout' | 'inventory'>('home');
```

This means:
- **No deep linking** — users can't bookmark or share a URL to a specific page
- **Browser back button doesn't work** — pressing back exits the app instead of going to previous view
- **No URL state** — refreshing always returns to the home view
- **Won't scale** — adding more views makes the state machine increasingly complex

## Proposed Solution

Add `react-router-dom` with route-based navigation:

```
/              → ScanPage (home)
/inventory     → InventoryListPage
/checkout      → CheckoutPage
/product/:id   → ProductDetail (enables deep linking)
```

## Acceptance Criteria

- [ ] Install and configure `react-router-dom`
- [ ] Each page has its own URL route
- [ ] Browser back/forward buttons work correctly
- [ ] Page refresh preserves the current route
- [ ] Navigation bar uses `<Link>` or `useNavigate` (not `setView`)
- [ ] Deep linking to product detail is supported
- [ ] PWA standalone mode still works
EOF
)"
echo "✅ Issue 3 created: React Router"

# Issue 4: EditProductDialog refactor
gh issue create --repo "$REPO" \
  --title "🟡 MEDIUM: Extract useEditProductForm hook from EditProductDialog (678 lines)" \
  --label "refactor" \
  --body "$(cat <<'EOF'
## Problem

`src/components/product/EditProductDialog.tsx` is **678 lines**, mixing:

- Form state management (many `useState` calls)
- Validation logic
- Image upload handling
- Camera capture orchestration
- Barcode scanning
- Pricing tier calculations
- API mutation calls

This makes it hard to test form logic independently and hard to modify one concern without risking others.

## Proposed Solution

Extract a **headless form hook** that owns all state and validation:

```typescript
// hooks/useEditProductForm.ts
export function useEditProductForm(product: Product) {
  // All form state
  // All validation rules
  // All computed values (pricing calculations)
  // Submit handler
  return { fields, errors, isValid, handleSubmit, setField, ... }
}
```

The dialog component becomes purely presentational — it renders the form and calls the hook.

## Acceptance Criteria

- [ ] Form state and validation extracted to `useEditProductForm` hook
- [ ] EditProductDialog.tsx reduced to <300 lines (render only)
- [ ] Image/camera logic in separate sub-component or hook
- [ ] All existing edit functionality works identically
- [ ] Build passes, no regressions
EOF
)"
echo "✅ Issue 4 created: EditProductDialog refactor"

# Issue 5: ESLint import boundaries
gh issue create --repo "$REPO" \
  --title "🟡 MEDIUM: Add ESLint rules enforcing API layer import boundaries" \
  --label "chore" \
  --body "$(cat <<'EOF'
## Problem

The API provider pattern (`lib/api-provider.ts`) cleanly abstracts the backend. But **nothing enforces** this at the tooling level. A developer could easily bypass the abstraction:

```typescript
// Inside a component — bypasses entire API layer!
import { supabase } from '@/lib/supabase';
const { data } = await supabase.from('products').select('*');
```

Today, the architecture is clean by **discipline**. ESLint rules would make it **enforced by tooling**.

## Proposed Solution

Add ESLint `no-restricted-imports` rules:

```javascript
// eslint.config.js
rules: {
  'no-restricted-imports': ['error', {
    patterns: [
      {
        group: ['@/lib/supabase', '@/lib/supabase-api', '@/lib/airtable', '@/lib/api'],
        importNames: ['supabase', 'airtableBase'],
        message: 'Import from @/lib/api-provider instead. Direct backend imports bypass the abstraction layer.'
      }
    ]
  }]
}
```

**Exception**: `lib/api-provider.ts` itself is allowed to import backends.

## Acceptance Criteria

- [ ] ESLint rule prevents direct imports of `supabase.ts`, `supabase-api.ts`, `airtable.ts`, `api.ts` from components/hooks/pages
- [ ] `api-provider.ts` is exempted from the rule
- [ ] `pnpm lint` catches violations
- [ ] Existing code passes (no current violations)
- [ ] Rule documented in CLAUDE.md
EOF
)"
echo "✅ Issue 5 created: ESLint import boundaries"

# Issue 6: localStorage debounce
gh issue create --repo "$REPO" \
  --title "🟢 LOW: Debounce localStorage writes in useRecentProducts" \
  --label "performance" \
  --body "$(cat <<'EOF'
## Problem

`src/hooks/useRecentProducts.ts` writes to `localStorage` on every state change with no debouncing. If a user rapidly scans products, this triggers synchronous `localStorage.setItem()` on every scan — potentially causing UI jank since localStorage is a blocking, synchronous API.

## Proposed Solution

Add a debounced write (300-500ms) using `useEffect` + `setTimeout`:

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentIds));
  }, 300);
  return () => clearTimeout(timer);
}, [recentIds]);
```

## Acceptance Criteria

- [ ] localStorage writes are debounced (300-500ms)
- [ ] Recent products still persist across page refreshes
- [ ] No data loss on rapid sequential scans
- [ ] Cleanup on unmount prevents stale writes
EOF
)"
echo "✅ Issue 6 created: localStorage debounce"

# Issue 7: Pre-commit optimization
gh issue create --repo "$REPO" \
  --title "🟢 LOW: Move E2E tests from pre-commit hook to CI pipeline" \
  --label "chore" \
  --body "$(cat <<'EOF'
## Problem

The pre-commit hook runs full Playwright E2E tests on every commit. This:

- **Slows commits** — E2E tests can take 30-60+ seconds
- **Blocks workflow** — developers must wait for browser tests before committing
- **Discourages small commits** — friction leads to fewer, larger commits
- **Runs redundantly** — same tests will run again in CI

Pre-commit hooks should be fast (<5 seconds) to encourage frequent commits.

## Proposed Solution

**Pre-commit** (fast, <5s):
- TypeScript type check (`tsc --noEmit`)
- ESLint on staged files
- Doc validation

**CI pipeline** (thorough):
- Full E2E Playwright suite
- Build verification
- Full lint

## Acceptance Criteria

- [ ] Pre-commit hook completes in <5 seconds
- [ ] E2E tests run in CI (GitHub Actions or equivalent)
- [ ] Pre-commit still catches type errors and lint issues
- [ ] Docs validation remains in pre-commit
- [ ] README/CLAUDE.md updated with new workflow
EOF
)"
echo "✅ Issue 7 created: Pre-commit optimization"

echo ""
echo "🎉 All 7 architectural issues created successfully!"
echo "View them at: https://github.com/$REPO/issues"
