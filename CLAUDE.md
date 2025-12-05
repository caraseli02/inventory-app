# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a tablet-first grocery inventory app built with React + TypeScript + Vite. The app scans grocery barcodes, syncs inventory to Airtable, and provides a clean UI for stock management. Key features include barcode scanning (html5-qrcode), PWA support, and AI-powered product suggestions via OpenFoodFacts.

## Commands

### Development
```bash
pnpm dev              # Start dev server
pnpm build            # Build for production (runs tsc -b && vite build)
pnpm preview          # Preview production build locally
pnpm lint             # Run ESLint
```

### Environment Setup
```bash
cp .env.example .env  # Create environment file
```

## Architecture

### Core Principles
- **UI and logic separation**: Components never talk to Airtable directly; all backend calls live in `/lib`
- **Backend abstraction**: Airtable calls isolated in `lib/airtable.ts` and `lib/api.ts` for easy migration
- **Modular AI layer**: AI helpers in `lib/ai/` imported only when needed
- **PWA-first**: Optimized for tablet/mobile fullscreen experience

### Directory Structure
```
src/
├── components/       # Global UI components
│   ├── scanner/      # Scanner component (html5-qrcode)
│   └── product/      # Product management forms
├── pages/            # Top-level page components (ScanPage.tsx)
├── lib/              # Business logic & external services
│   ├── airtable.ts   # Airtable client initialization & table constants
│   ├── api.ts        # CRUD functions (getProductByBarcode, createProduct, etc.)
│   └── ai/           # AI helpers (OpenFoodFacts integration)
├── hooks/            # Custom React hooks (useProductLookup)
├── types/            # TypeScript types (Product, StockMovement)
└── assets/           # Static assets (PWA icons)
```

### Data Flow
1. Scanner captures barcode → `hooks/useProductLookup.ts`
2. Hook calls `lib/api.ts` functions
3. API functions use `lib/airtable.ts` to interact with Airtable
4. AI suggestions fetched from `lib/ai/` when product not found

### Airtable Integration
- Two tables: `Products` and `Stock Movements`
- Table names defined as constants in `lib/airtable.ts` (use `TABLES.PRODUCTS`, `TABLES.STOCK_MOVEMENTS`)
- Product lookup uses `filterByFormula` for barcode matching
- Stock movements use signed quantities (+/- based on IN/OUT type) for rollup calculation
- Image field expects Airtable attachment format: `[{ url: string }]`

### AI/Product Suggestions
- OpenFoodFacts API integration in `lib/ai/openFoodFacts.ts`
- Category mapping from OFF tags to internal categories in `lib/ai/index.ts`
- Fallback to "General" category if no match found
- Returns: name, category, imageUrl, source

## Spec-Driven Development

This project follows a **spec-driven development** approach. All features and cross-cutting concerns are documented as specifications in `docs/specs/` before implementation.

### Workflow

1. **Read the spec first** - Before implementing any feature, read the corresponding spec in `docs/specs/`
2. **Follow BDD scenarios** - Implement features to satisfy the Given/When/Then scenarios
3. **Check dependencies** - Each spec lists dependencies on other specs that must be considered
4. **Update status** - When completing implementation, update the spec's Status field
5. **Keep specs authoritative** - Specs are the single source of truth; update them when requirements change

### Spec Structure

Each spec follows this format:

```markdown
# Feature: [Name]

**Version**: 0.1.0 (draft)
**Status**: NOT_STARTED | PARTIAL | IN_PROGRESS | COMPLETE
**Owner**: TBD
**Last Updated**: YYYY-MM-DD
**Dependencies**: [linked_spec.md], [another_spec.md]

As a [user type]
I want [feature]
So that [benefit]

Scenario: [Scenario name]
    Given [precondition]
    When [action]
    Then [expected result]
    And [additional expectation]

## Changelog
### 0.1.0 (YYYY-MM-DD)
- Initial draft
```

### Spec Types

**Feature Specs** (BDD scenarios):
- `scanner.md` - Barcode scanning functionality
- `product_management.md` - Product CRUD operations
- `stock_management.md` - Stock movement tracking

**Cross-Cutting Specs** (requirements & acceptance criteria):
- `backend_proxy.md` - Security proxy for Airtable (MVP-critical)
- `validation_guardrails.md` - Input validation rules (MVP-critical)
- `scanner_error_handling.md` - Error handling patterns (MVP-critical)
- `operations_safety.md` - Deployment & ops guidance (MVP-critical)
- `observability.md` - Logging/monitoring (post-MVP)
- `pwa_offline.md` - Offline behavior (post-MVP)

### Finding Specs

- **All specs**: `docs/specs/*.md`
- **Spec index**: `docs/README.md` (tracks status and priority)
- **MVP scope**: `docs/specs/mvp_scope.md` (defines what's critical for launch)
- **Architecture decisions**: `docs/adrs/` (ADR-0001 covers Airtable proxy decision)

### Implementation Guidelines

1. **Start with MVP-critical specs** - See `docs/specs/mvp_scope.md` for prioritization
2. **Implement BDD scenarios in order** - Each scenario becomes a test case
3. **Follow acceptance criteria** - Don't mark a spec complete until all criteria are met
4. **Update the changelog** - Add an entry when making spec changes
5. **Cross-reference in code** - Reference spec file paths in comments for complex logic

### Example: Implementing from a Spec

To implement barcode scanning (from `docs/specs/scanner.md`):

1. Read the spec and its dependencies (`validation_guardrails.md`, `scanner_error_handling.md`)
2. Implement the "Successfully scanning a product" scenario first
3. Add error handling for "Camera permission denied"
4. Consider the "Manual entry fallback" scenario
5. Update spec status from `PARTIAL` to `COMPLETE` when all scenarios work
6. Add changelog entry documenting what was implemented

### When to Create/Update Specs

**Create a new spec when**:
- Adding a new user-facing feature
- Introducing a cross-cutting concern (security, validation, etc.)
- Making an architectural decision (also create an ADR in `docs/adrs/`)

**Update an existing spec when**:
- Requirements change or expand
- Implementation reveals missing edge cases
- BDD scenarios need refinement based on user feedback

**Don't update specs for**:
- Minor code refactoring that doesn't change behavior
- Internal implementation details not visible to users
- Bug fixes that don't require new scenarios (unless spec was incomplete)

## Security & Environment

### Required Environment Variables
- `VITE_AIRTABLE_API_KEY`: Airtable personal access token (read/write)
- `VITE_AIRTABLE_BASE_ID`: Base ID for inventory workspace

### Planned (Not Yet Implemented)
- `VITE_BACKEND_PROXY_URL`: Backend proxy to hide Airtable credentials
- `VITE_PROXY_AUTH_TOKEN`: Auth token for proxy

**Important**: Never commit `.env` files. Currently, Airtable credentials are exposed client-side; backend proxy is planned per `docs/specs/backend_proxy.md`.

## Documentation

- All specs are authoritative sources of truth: `docs/specs/`
- Architecture reference: `docs/project_architecture_structure.md`
- Documentation index: `docs/README.md`
- ADRs (Architecture Decision Records): `docs/adrs/`

### MVP Scope (from `docs/specs/mvp_scope.md`)
**MVP-Critical** (must ship):
- Backend proxy for Airtable
- Validation guardrails (barcode formats, non-negative stock/price)
- Scanner/API error handling
- Operations & safety basics

**Nice-to-have**: Docs polish, observability hooks, PWA offline behavior

## Type System

### Product Type
```typescript
interface Product {
  id: string;                    // Airtable Record ID
  fields: {
    Name: string;
    Barcode: string;
    Category?: string;
    Price?: number;
    'Expiry Date'?: string;
    Image?: Array<{ url: string }>;
    'Current Stock'?: number;    // Rollup field (sum of stock movements)
  };
}
```

### Stock Movement Type
```typescript
interface StockMovement {
  id: string;
  fields: {
    Product: string[];           // Link to Product (array of IDs)
    Quantity: number;            // Signed: positive for IN, negative for OUT
    Type: 'IN' | 'OUT';
    Date?: string;
    Note?: string;
  };
}
```

## Code Patterns

### Creating Products
Use `CreateProductDTO` from `lib/api.ts`:
- Image field must be converted to Airtable attachment format
- Use `typecast: true` option for Airtable create operations

### Stock Movements
- Always use `addStockMovement(productId, quantity, type)` from `lib/api.ts`
- Function handles quantity signing automatically based on type
- Rollup field `Current Stock` on Product is calculated by Airtable

### Error Handling
- Check for missing env vars in `lib/airtable.ts` (logs warning if absent)
- API functions should be wrapped in try/catch at the component level
- Scanner errors handled by `html5-qrcode` library callbacks

## Tech Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 7
- **Styling**: TailwindCSS v4 (via `@tailwindcss/vite`)
- **State Management**: TanStack Query (React Query)
- **Scanner**: html5-qrcode
- **Backend**: Airtable (via `airtable` npm package)
- **PWA**: vite-plugin-pwa (auto-update, standalone mode)
- **Linting**: ESLint 9 with TypeScript support

## Testing

No test framework is currently set up. Tests are planned post-MVP.

## Common Pitfalls

1. **Airtable field names**: Use exact field names from Airtable schema (e.g., `'Expiry Date'` not `expiryDate`)
2. **Image attachments**: Must use `[{ url: string }]` format, not plain URL strings
3. **Stock quantity signs**: Don't manually negate quantities; use type parameter in `addStockMovement`
4. **Environment variables**: All Vite env vars must be prefixed with `VITE_`
5. **Table name typos**: Always import and use `TABLES` constants from `lib/airtable.ts`
