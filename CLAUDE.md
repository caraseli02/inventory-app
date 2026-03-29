# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a tablet-first grocery inventory app built with React + TypeScript + Vite. The app scans grocery barcodes, syncs inventory to **Supabase** (or Airtable for legacy support), and provides a clean UI for stock management. Key features include barcode scanning (html5-qrcode), PWA support, AI-powered product suggestions via OpenFoodFacts, and a flexible backend abstraction layer.

---

## 💬 Communication Standards

**Be extremely concise. Sacrifice grammar for the sake of concision.**

Apply throughout all interactions: plans, explanations, code reviews, feedback. Prioritize clarity & brevity over perfect English.

---

## 📁 Directory & Root Organization

### Root Directory Policy
- **NO CLUTTER**: Never add screenshots, temporary `.md` files, or scripts directly to the root.
- **Allowed root files**: `README.md`, `CLAUDE.md`, `AGENTS.md`, `claude-progress.md`, `package.json`, and config files (`vite.config.ts`, `tsconfig.json`, etc.).
- **Automatic Enforcement**: `pnpm check-root-files` runs on pre-commit. Use `node scripts/check-root-files.js --all` to check the entire repo.

### Standards
- **Screenshots**: Always place in `docs/assets/screenshots/`.
- **Documentation**: New guides or specs belong in `docs/` or `docs/specs/`.
- **Scripts**: All utility scripts belong in `scripts/`.
- **Backend/API**: Vercel functions in `api/`, shared logic in root `lib/` (AI agent logic) or `src/lib/`.

---

## Commands

### Development
```bash
pnpm dev              # Start dev server
pnpm typecheck        # Run TypeScript project check (tsc -b --noEmit)
pnpm build            # Build for production (runs tsc -b && vite build)
pnpm preview          # Preview production build locally
pnpm lint             # Run ESLint (warnings fail: --max-warnings=0)
```

### Testing
```bash
pnpm test:unit        # Run unit tests
pnpm test:integration # Run integration tests
pnpm test:e2e         # Run Playwright end-to-end tests
pnpm test:visual      # Run visual regression tests
```

### Workflow Utilities
```bash
pnpm validate-docs    # Validate solution docs/schema
pnpm check-root-files # Validate protected root files
pnpm pr:sync-body     # Sync required PR template sections
pnpm prepare          # Install simple-git-hooks manually
```

### MCP / Agent Utilities
```bash
pnpm mcp:typecheck    # Type-check MCP server code only
pnpm mcp:build        # Build MCP app bundle
pnpm mcp:serve        # Run MCP app server
pnpm mcp:stdio        # Run MCP server over stdio
pnpm mcp:smoke        # Run MCP smoke test
pnpm whatsapp:replay  # Replay fixture-backed Twilio-shaped requests through the real webhook
pnpm whatsapp:eval    # Run WhatsApp simulator eval
```

### Environment Setup
```bash
cp .env.example .env  # Create environment file
```

## Architecture

### Core Principles
- **shadcn/ui primitives only**: NEVER use raw HTML elements (`<button>`, `<input>`, etc.) - always use shadcn components from `@/components/ui/`
- **UI and logic separation**: Components never talk to the backend directly; all backend calls live in `/lib`
- **Backend abstraction**: **API provider pattern** - `lib/api-provider.ts` automatically selects between Supabase (`lib/supabase-api.ts`) or Airtable (`lib/api.ts`) based on environment variables
- **Modular AI layer**: AI helpers in `lib/ai/` imported only when needed
- **PWA-first**: Optimized for tablet/mobile fullscreen experience
- **Design consistency**: Follow the "Fresh Precision" aesthetic with CSS variables, gradients, and organic rounded corners
- **Currency standard**: All prices are displayed in EUR (€). Use `€${price.toFixed(2)}` format throughout the application

### Directory Structure
```
src/
├── components/       # Global UI components
│   ├── ui/           # shadcn/ui primitives (Button, Input, Card, etc.)
│   ├── scanner/      # Scanner component (html5-qrcode)
│   └── product/      # Product management forms
├── pages/            # Top-level page components (ScanPage.tsx, CheckoutPage.tsx)
├── lib/              # Business logic & external services
│   ├── utils.ts      # Utility functions (cn helper for shadcn)
│   ├── api-provider.ts  # Backend abstraction layer (Supabase or Airtable)
│   ├── supabase.ts   # Supabase client initialization
│   ├── supabase-api.ts  # Supabase CRUD functions
│   ├── airtable.ts   # Airtable client (legacy)
│   ├── api.ts        # Airtable CRUD functions (legacy)
│   ├── database.types.ts  # Generated Supabase types
│   ├── errors.ts     # Custom error classes (ValidationError, NetworkError)
│   └── ai/           # AI helpers (OpenFoodFacts integration)
├── hooks/            # Custom React hooks (useProductLookup)
├── types/            # TypeScript types (Product, StockMovement)
└── assets/           # Static assets (PWA icons)
```

### Data Flow
1. Scanner captures barcode → `hooks/useProductLookup.ts`
2. Hook calls `lib/api-provider.ts` functions
3. API provider routes to either:
   - `lib/supabase-api.ts` (if `VITE_SUPABASE_URL` is set) ✅ **Recommended**
   - `lib/api.ts` (if `VITE_AIRTABLE_API_KEY` is set) - Legacy
4. Backend interacts with Supabase PostgreSQL or Airtable
5. AI suggestions fetched from `lib/ai/` when product not found

### WhatsApp Chat State Guardrails

**Critical**: conversational memory and transactional order state are different domains.

- `conversation_history.messages` may help answer follow-ups, but must not by itself create or confirm an order
- `pending_order` is transactional state and needs explicit lifecycle, expiry, and regression coverage
- `pending_order` must be read with peek semantics by default; only explicit confirm/cancel transitions may consume/clear it
- Never let assistant reply text become the default source for future product search candidates
- Never rebuild `ORDER:` from history-only quantity or pickup time; current-turn evidence is required
- Prefer explicit channel signals over inferred history when available:
  - Twilio `ButtonPayload`
  - reply-context metadata
  - current-turn structured order fields
- A fresh browse query must not resurrect an older pending order

**Cart-flow state (`pending_selection`) is also transactional — not just conversational:**

- `pending_selection` drives the state machine: `category_list → product_list → awaiting_qty → building_order → awaiting_pickup_time`
- The cart-flow code path (`handleCartPickupTime` in `lib/whatsapp/selection-resolver.ts`) creates `pending_order` **outside** the LLM path — same TTL/atomicity rules apply
- **Never clear cart state (`pending_selection`) before `storePendingOrder` write completes without error**
- `storePendingProductSelection` swallows errors by design (best-effort write) — callers must not assume selection was persisted if the DB is degraded
- If you add a new state transition, update `docs/specs/whatsapp_agent.md` with the new BDD scenario

Required reading before WhatsApp/chat refactors:
- `docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md`
- `docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md`
- `docs/plans/2026-03-12-refactor-whatsapp-chat-state-plan.md`
- `docs/runbooks/whatsapp_agent.md`

### Backend Integration

#### API Provider Pattern (`lib/api-provider.ts`)

The app uses a **provider pattern** to abstract backend operations. The backend is automatically selected based on environment variables:

```typescript
// Priority: Supabase > Airtable > None
const useSupabase = !!import.meta.env.VITE_SUPABASE_URL;
const useAirtable = !!import.meta.env.VITE_AIRTABLE_API_KEY;
```

**How it works**:
1. On app initialization, `api-provider.ts` checks which env vars are set
2. It dynamically imports the appropriate backend module (`supabase-api.ts` or `api.ts`)
3. All API functions are exported through a unified interface
4. Components import from `lib/api-provider.ts` and are backend-agnostic

**Switching backends**: Just set/unset environment variables - no code changes needed!

#### Supabase Backend (Recommended) 🌟

**Location**: `lib/supabase-api.ts`

**Features**:
- PostgreSQL database with Row Level Security (RLS)
- Type-safe queries with generated TypeScript types (`database.types.ts`)
- Comprehensive validation layer with custom error classes
- Structured logging (debug, info, error levels)
- Client-side stock calculation from movements

**Database Schema**:
- Two tables: `products` and `stock_movements`
- Products store all product fields (name, barcode, price, category, etc.)
- Stock movements store signed quantities (+/- based on IN/OUT type)
- Current stock calculated by summing all movements for a product

**Key Functions**:
- `getProductByBarcode(barcode)` - Lookup product by barcode
- `createProduct(data)` - Create new product with validation
- `updateProduct(productId, data)` - Update existing product
- `deleteProduct(productId)` - Delete product (with FK constraint checks)
- `getAllProducts()` - Fetch all products with calculated stock levels
- `addStockMovement(productId, quantity, type)` - Record IN/OUT movement
- `getStockMovements(productId)` - Get movement history

**Error Handling**:
- Custom error classes: `ValidationError`, `NetworkError`, `AuthorizationError`
- PostgreSQL error code mapping (23503 = FK violation, PGRST116 = RLS policy violation)
- User-friendly error messages with actionable guidance

**Type Safety**:
```typescript
// Generated from Supabase schema
import type { Database } from './database.types';
type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
```

#### Airtable Backend (Legacy)

**Location**: `lib/api.ts` + `lib/airtable.ts`

**Note**: Maintained for backward compatibility. New projects should use Supabase.

**Features**:
- Two tables: `Products` and `Stock Movements`
- Table names defined as constants in `lib/airtable.ts` (use `TABLES.PRODUCTS`, `TABLES.STOCK_MOVEMENTS`)
- Product lookup uses `filterByFormula` for barcode matching
- Stock movements use signed quantities (+/- based on IN/OUT type) for rollup calculation
- Image field expects Airtable attachment format: `[{ url: string }]`

**Migration Path**: See `docs/MIGRATION_GUIDE.md` for step-by-step migration from Airtable to Supabase.

### AI/Product Suggestions
- OpenFoodFacts API integration in `lib/ai/openFoodFacts.ts`
- Category mapping from OFF tags to internal categories in `lib/ai/index.ts`
- Fallback to "General" category if no match found
- Returns: name, category, imageUrl, source

### xlsx Integration (Phase 1)

The app supports importing/exporting product data from Excel files, enabling customers to use their existing xlsx workflow for pricing while benefiting from the app's inventory tracking.

**Spec**: `docs/specs/xlsx_integration.md`

**Features**:
- F021: Excel Import - Import products from xlsx files
- F022: Excel Export - Export inventory to xlsx
- F023: Pricing Tiers - Support 50%, 70%, 100% markup prices

**Sample xlsx File**: `public/magazin.xlsx`

**Column Mapping**:
| xlsx Column | App Field | Required |
|-------------|-----------|----------|
| Cod de bare (Barcode) | `Barcode` | No (can add later via edit) |
| Denumirea produsului | `Name` | **Yes** |
| Categorie | `Category` | No |
| Preț (euro) | `Price` | No |
| Cost preț magazin 50% | `price50` | No |
| Cost preț magazin 70% | `price70` | No |
| Cost preț magazin 100% | `price100` | No |
| Stock curent / Cantitatea | `currentStock` | No |
| Stock minim | `Min Stock Level` | No |
| Furnizor | `Supplier` | No |
| Data expirare | `Expiry Date` | No |

**Flexible Import**: Products can be imported without barcodes - add them later via the edit dialog using the barcode scanner button.

**Architecture Roadmap**:
```
Phase 1 (COMPLETE): SheetJS + Supabase ✅
  └── Import/Export xlsx, Supabase as primary database
  └── Airtable legacy support maintained for backward compatibility

Phase 2 (Future): Dexie.js + Supabase
  └── Add local-first IndexedDB storage for offline support
  └── Sync with Supabase when online
  └── Full PWA offline capabilities

Phase 3 (Optional): Multi-tenant + Authentication
  └── User authentication with Supabase Auth
  └── Row Level Security (RLS) policies
  └── Multi-device sync per user
  └── Real-time collaboration features
```

### Image Upload & Camera Capture

The EditProductDialog supports two methods for adding product images:

1. **URL Input** - Paste any image URL directly
2. **Camera Capture** - Take a photo with device camera

**Camera Capture Flow**:
- Camera photos are captured as base64 data URLs
- Airtable requires actual URLs (can't accept data URLs)
- Photos are uploaded to storage and URL is saved to Airtable

**Image Storage (Vercel Blob + imgbb fallback)**:
```
Production (Vercel):
  └── Uses Vercel Blob storage via /api/upload serverless function
  └── Add BLOB_READ_WRITE_TOKEN in Vercel dashboard

Development (Local):
  └── Falls back to imgbb.com (free image hosting)
  └── Add VITE_IMGBB_API_KEY to .env
```

**Environment Variables**:
```bash
# Development: imgbb fallback
VITE_IMGBB_API_KEY=your_api_key_here  # Get free key at https://api.imgbb.com/

# Production: Vercel Blob (set in Vercel dashboard)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx
```

**Barcode Scanner in Edit Dialog**:
- Products without barcodes show a scan button
- Opens camera to scan barcode directly
- Supports UPC-A, UPC-E, EAN-13, EAN-8, QR codes

## Spec-Driven Development

This project follows a **spec-driven development** approach. All features and cross-cutting concerns are documented as specifications in `docs/specs/` before implementation.

### Workflow

1. **Read the spec first** - Before implementing any feature, read the corresponding spec in `docs/specs/`
2. **Follow BDD scenarios** - Implement features to satisfy the Given/When/Then scenarios
3. **Check dependencies** - Each spec lists dependencies on other specs that must be considered
4. **Update status** - When completing implementation, update the spec's Status field
5. **Keep specs authoritative** - Specs are the single source of truth; update them when requirements change

### Bug Fix Workflow

0.  **Search first**: Check for existing solutions before starting. If a matching solution exists, link to it rather than creating a duplicate.
    ```bash
    node scripts/search-solutions.js --query "symptom keywords here"
    ```
1.  **Report**: Create a GitHub Issue with clear reproduction steps.
2.  **Fix**: Implement the fix in a branch.
3.  **Document**: Create a solution entry in `docs/solutions/` using `_template.md` and following `docs/solutions/schema.yaml`.
    *   ⚠️ **CRITICAL**: Must follow [Pattern 4: Documentation Schema Compliance](docs/solutions/patterns/critical-patterns.md#pattern-4-documentation-schema-compliance)
    *   One solution per issue, placed in the correct sub-directory (e.g., `ui-bugs/`, `logic-errors/`).
    *   Must use correct enum values for `problem_type`, `component`, `root_cause`, `resolution_type`.
    *   Must reference the GitHub Issue number (if applicable).
    *   Pre-commit hooks will validate schema automatically.
4.  **Close**: Link the solution in the GitHub Issue and close it.

**Quick Reference**:
```bash
# Search existing solutions (Step 0 — always do this first)
node scripts/search-solutions.js --query "your search terms"

# Use template
cp docs/solutions/_template.md docs/solutions/[category]/[name].md

# Validate a specific file interactively
node scripts/validate-docs.js docs/solutions/[category]/[name].md

# Validate all solution files (used by CI)
node scripts/validate-docs.js --all
```

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

### Backend Environment Variables

The app automatically detects which backend to use based on which environment variables are set. **If both are set, Supabase takes priority.**

#### Option 1: Supabase (Recommended) 🌟

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Security Model**:
- ✅ **Safe to expose client-side**: The publishable key (also called "anon" key) is designed for browser use
- ✅ **Row Level Security (RLS)**: Protect data with PostgreSQL policies in Supabase dashboard
- ✅ **No credentials in bundle**: API keys don't grant write access without proper RLS policies
- ✅ **Authentication ready**: Easy to add user authentication with Supabase Auth when needed

**Setup Guide**: See `docs/SUPABASE_SETUP.md` for detailed instructions.

#### Option 2: Airtable (Legacy)

```bash
VITE_AIRTABLE_API_KEY=patAbcd1234567890...
VITE_AIRTABLE_BASE_ID=appXyzAbcd1234567
```

**Security Model**:
- ⚠️ **Credentials exposed client-side**: Airtable API key is embedded in the production bundle
- ⚠️ **Full access**: API key grants read/write access to the entire base
- ⚠️ **For trusted users only**: Acceptable for MVP testing with known users
- ⚠️ **Backend proxy recommended**: See `docs/specs/backend_proxy.md` for production hardening

**Migration Path**: If currently using Airtable, see `docs/MIGRATION_GUIDE.md` to migrate to Supabase.

### Additional Environment Variables

**Image Upload** (Optional):
```bash
# Development fallback (free tier)
VITE_IMGBB_API_KEY=your_imgbb_api_key_here

# Production (Vercel Blob - set in Vercel dashboard)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx
```

**Invoice OCR** (Optional - secured via Supabase Edge Functions):
- No client-side environment variables needed!
- API keys are configured server-side in Supabase Dashboard
- See `docs/SUPABASE_EDGE_FUNCTIONS.md` for setup guide
- Edge Functions:
  - `invoice-ocr` - Google Cloud Vision OCR (server-side)
  - `invoice-parse` - OpenAI GPT-4o mini parsing (server-side)
- Cost: ~$0.001 per invoice (1,000 pages free/month)

**Important**: Never commit `.env` files. They're gitignored by default.

## Documentation

- All specs are authoritative sources of truth: `docs/specs/`
- Canonical current status / handoff doc: `docs/project-status.md`
- Architecture reference: `docs/project_architecture_structure.md`
- Documentation index: `docs/README.md`
- ADRs (Architecture Decision Records): `docs/adrs/`
- **Solutions Knowledge Base**: `docs/solutions/` (Searchable history of resolved issues)
- **Project management files**:
  - `feature_list.json` - Complete feature tracking with testing status
  - `docs/project-status.md` - Canonical current priorities, active work, next steps, and handoff layer
  - `docs/project/claude-progress.md` - Deprecated redirect kept for compatibility
  - `scripts/init.sh` - Initialization script for server startup and testing

### MVP Scope (from `docs/specs/mvp_scope_lean.md`)
**CURRENT STATUS**: All 15 MVP-critical features implemented ✅

**Core features complete**:
- Barcode scanning, product lookup, AI auto-fill
- Stock movements (IN/OUT), movement history
- Optimistic UI updates, error handling
- PWA support, responsive design

**Post-MVP** (deferred until user validation):
- Backend proxy for Airtable
- Comprehensive input sanitization
- Observability & logging infrastructure
- PWA offline support

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
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: TanStack Query (React Query)
- **Scanner**: html5-qrcode
- **Backend**: Airtable (via `airtable` npm package)
- **PWA**: vite-plugin-pwa (auto-update, standalone mode)
- **Linting**: ESLint 9 with TypeScript support

## UI Components & Design System

### shadcn/ui Philosophy

**CRITICAL**: This project uses shadcn/ui components exclusively. **NEVER** create custom HTML buttons, inputs, forms, or other interactive elements when a shadcn component exists.

### Available shadcn Components

Components are located in `src/components/ui/` and should be imported using the `@/` alias:

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toggle } from '@/components/ui/toggle';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
```

### Usage Rules

1. **Always use shadcn components** - Never write `<button>`, `<input>`, `<select>`, etc. directly
2. **Import from `@/components/ui/`** - Use the configured path alias
3. **Follow component patterns** - Study existing implementations before creating new ones
4. **Maintain design consistency** - Use the established "Fresh Precision" aesthetic

### Design System: "Fresh Precision"

The app follows a cohesive design language defined in `src/index.css`:

**Typography**:
- Display/Headers: `Instrument Serif` (font-family: var(--font-display))
- Body/UI: `Inter` (font-family: var(--font-body))

**Color Palette** (CSS variables):
```css
--color-cream: #FAFAF9        /* Background */
--color-forest: #059669       /* Primary actions */
--color-forest-dark: #047857  /* Primary hover */
--color-terracotta: #EA580C   /* Warnings/Remove */
--color-terracotta-dark: #C2410C
--color-lavender: #8B5CF6     /* Accents */
--color-lavender-dark: #7C3AED
--color-stone: #78716C         /* Text */
--color-stone-dark: #57534E
```

**Visual Style**:
- Organic rounded corners (rounded-2xl for cards, rounded-lg for inputs)
- Gradient backgrounds on headers/footers
- Subtle shadows for depth
- 2px borders (border-2) for definition
- Smooth transitions and hover states

### Component Examples

**❌ WRONG - Custom HTML:**
```tsx
<button className="px-4 py-2 bg-blue-500 text-white rounded">
  Click Me
</button>
```

**✅ CORRECT - shadcn Button:**
```tsx
<Button
  className="bg-gradient-to-br text-white"
  style={{
    background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))',
  }}
>
  Click Me
</Button>
```

**❌ WRONG - Custom form input:**
```tsx
<input
  type="text"
  className="border rounded px-3 py-2"
  placeholder="Enter name"
/>
```

**✅ CORRECT - shadcn Input with Label:**
```tsx
<div>
  <Label htmlFor="name" className="text-stone-700 font-semibold">Name</Label>
  <Input
    id="name"
    type="text"
    placeholder="Enter name"
    className="mt-1.5 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)]"
  />
</div>
```

**❌ WRONG - Custom card structure:**
```tsx
<div className="bg-white rounded-lg p-6 shadow">
  <h2>Title</h2>
  <p>Content</p>
</div>
```

**✅ CORRECT - shadcn Card:**
```tsx
<Card className="shadow-lg border-stone-200">
  <CardHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200">
    <h2 className="text-2xl font-bold text-stone-900">Title</h2>
  </CardHeader>
  <CardContent className="p-6">
    <p>Content</p>
  </CardContent>
</Card>
```

### When to Add New shadcn Components

If you need a component not yet in the project:

1. Check [shadcn/ui documentation](https://ui.shadcn.com) for the component
2. Install it: `npx shadcn-vue@latest add [component-name]` (or manually add to `src/components/ui/`)
3. Ensure it imports `cn` from `@/lib/utils`
4. Apply the "Fresh Precision" aesthetic with appropriate classes
5. Update this CLAUDE.md file with the new component in the "Available shadcn Components" list

## Testing & Project Management

### Project Management Files

This project uses three critical files to track progress and ensure quality:

#### 1. feature_list.json
**Location**: `/feature_list.json`
**Purpose**: Comprehensive feature tracking with implementation and testing status

**Structure**:
- 20 features total (15 MVP-critical + 5 post-MVP)
- Each feature includes:
  - Unique ID, name, category, priority
  - Implementation status (`implemented: true/false`)
  - Testing status (`tested: true/false`)
  - Step-by-step breakdown with completion status
  - Test scenarios with test file references

**⚠️ CRITICAL RULES**:
- **ONLY** modify `implemented` and `tested` boolean fields
- **NEVER** remove or modify feature entries, steps, or scenarios
- Update this file after implementing or testing a feature
- Commit changes immediately after updates

**Example usage**:
```json
{
  "id": "F001",
  "name": "Barcode Scanning",
  "implemented": true,
  "tested": true,  // ← Update this after testing
  "test_scenarios": [
    {
      "scenario": "Successfully scan a product barcode",
      "tested": true  // ← Update this after specific test passes
    }
  ]
}
```

#### 2. project-status.md
**Location**: `/docs/project-status.md`
**Purpose**: Canonical current status, handoff layer, and "what's next?" control doc

**Contains**:
- Current priorities
- Active work
- Recently completed
- Next up
- Decision notes
- Links to canonical plans

**When to update**:
- In every PR that changes shipped behavior, priorities, roadmap order, or the meaning of "what's next"
- When a plan becomes active
- When work moves from active to recently completed
- Before merging if the current handoff view changed

#### 3. init.sh
**Location**: `/init.sh` (executable)
**Purpose**: Automated initialization and testing guide

**TODO**: Verify `init.sh` assumptions before relying on it for Supabase-first or MCP-specific workflows; it still prompts for Airtable-only setup.

**What it does**:
1. Checks environment setup (.env file)
2. Verifies dependencies installed
3. Runs TypeScript validation (`tsc -b --noEmit`)
4. Builds for production (`pnpm build`)
5. Starts dev server on http://localhost:5173
6. Provides testing instructions for Playwright MCP

**Usage**:
```bash
./init.sh
```

### Testing Workflow with Playwright MCP

This project uses **Playwright MCP** for automated browser testing. Playwright is already configured in Claude Code.

#### Step-by-Step Testing Process

**1. Start the Development Server**
```bash
./init.sh
```

This will:
- Validate your environment
- Check dependencies
- Run TypeScript checks
- Build the project
- Start the dev server at http://localhost:5173

**2. Open a New Terminal for Testing**

In a separate terminal, use Claude Code with Playwright MCP to run tests.

**3. Test Features with Playwright**

Use prompts like these:

```
Navigate to http://localhost:5173 and take a screenshot of the scanner page
```

```
Test the product creation flow at http://localhost:5173:
1. Fill in Name: "Test Product"
2. Fill in Barcode: "1234567890"
3. Fill in Price: 5.99
4. Submit the form
5. Verify it was created successfully
```

```
Test stock movement at http://localhost:5173:
1. Navigate to an existing product
2. Add a stock IN movement of 10 units
3. Verify the stock count updates
```

```
Test error handling at http://localhost:5173:
1. Block camera permissions
2. Verify error message is displayed
```

**4. Mark Tests as Complete**

After each test scenario passes:

1. Update `feature_list.json`:
   ```json
   "test_scenarios": [
     {
       "scenario": "Successfully scan a product barcode",
       "tested": true  // ← Change from false to true
     }
   ]
   ```

2. Update `docs/project-status.md`:
   - refresh `Active Work`, `Recently Completed`, or `Next Up` if the PR changes current execution reality
   - add links to any newly active plan or newly created solution doc

**5. Commit Your Changes**

After testing is complete:
```bash
git add feature_list.json docs/project-status.md
git commit -m "test: Complete testing for [feature name]"
```

**6. Leave Project Merge-Ready**

After each testing session, ensure:
- ✅ All tests documented in tracking files
- ✅ All changes committed to git
- ✅ No uncommitted changes
- ✅ Features working as expected
- ✅ Project ready for deployment

### Testing Philosophy

**IMPORTANT**: After implementing any feature, you MUST:
1. Test it immediately with Playwright MCP
2. Mark it as tested in `feature_list.json`
3. Update `docs/project-status.md` when the PR changes the current handoff view
4. Commit changes to git
5. Ensure project is in merge-ready state

**This workflow is MANDATORY** - do not skip testing or leave changes uncommitted.

**WhatsApp-specific minimum regression set** for changes touching `lib/whatsapp/`, `api/whatsapp.ts`, `api/whatsapp-simulate.ts`, or Orders confirmation paths:

```bash
pnpm vitest run tests/unit/whatsappAgent.test.ts tests/integration/whatsapp-agent.test.ts
```

Must cover:
- fresh browse query after prior pending order
- exact-product order creation
- button confirm/cancel
- `DA` / `NU` fallback
- expired pending-order behavior

### Review Routing

Use `workflows-review` for every substantial PR.

Add a specialist review when the PR matches these risk shapes:

- `security-sentinel`: any change in `api/`, `mcp/`, auth, secrets, webhooks, CORS, or env-based access control
- `kieran-typescript-reviewer`: any React/TypeScript refactor, hook extraction, reducer/state rewrite, or i18n-sensitive UI change
- `data-integrity-guardian`: any change that writes orders, stock, conversation history, Supabase RPCs, migrations, or retry/concurrency logic
- `deployment-verification-agent`: any high-risk PR touching CI, deploy config, workflows, migrations, or production-only behavior

Rule:
- Keep `workflows-review` as the default broad pass
- Add only the specialist review that matches the PR's main risk

### CI Risk-Tiered Policy (IMPORTANT)

The repository uses risk-tiered CI checks in `.github/workflows/ci.yml`.

**Detection scripts**:
- `scripts/detect-tests.sh` - test strategy detection
- `scripts/detect-risk-tier.sh` - risk tier + checklist/full-test requirement

**Risk tiers**:
- `low`: docs/non-critical changes (selective tests)
- `medium`: feature/refactor app logic (broader unit/integration/e2e)
- `high`: deploy/config/workflow or critical runtime domains (full tests + checklist validation)

**High-risk PR body requirements** (must be checked):
- `[x] High-Risk Deploy Checklist Completed`
- `[x] Rollback Plan Included`
- `[x] Refactor Regression Proof Added`

These fields are validated by the `High-Risk PR Checklist` CI job and are defined in `.github/pull_request_template.md`.
Before or immediately after `gh pr create`, run `pnpm pr:sync-body` to append any missing required template sections to the current PR body.
This includes the `Project Status` section used by the repo's yeet/publish PR flow, so do not open or merge a PR without updating `docs/project-status.md`.

**Push-event diff safety**:
- Detection scripts accept push SHA ranges (`before`, `after`) from CI to avoid empty-diff misclassification.
- Scripts include fallback chains for robustness (`origin/<base>...HEAD`, then `HEAD~1...HEAD`).

**Policy mode**:
- Default mode is `enforce`.
- Temporary relax mode: set repository variable `RISK_POLICY_MODE=advisory`.

### Delivery Policy (IMPORTANT)

- **Releasable source of truth**: a change is releasable only when required CI checks are green.
- `docs/project-status.md` is the canonical handoff doc, but CI remains the release gate.
- `feature_list.json` is a tracking artifact, not release authority.
- Local hooks are split for feedback speed:
  - `pre-commit`: root-file checks, docs validation, typecheck, lint
  - `pre-push`: unit + integration tests
  - E2E remains CI-gated via risk-tiered workflow.
- Branch/PR policy:
  - Target branch lifetime: under 48h
  - PR size guidance: warn over 300 net LOC; hard limit over 600 unless `size-exception` label + justification

## Common Pitfalls

1. **Using raw HTML elements**: Never use `<button>`, `<input>`, `<select>`, etc. - ALWAYS use shadcn components from `@/components/ui/`
2. **Airtable field names**: Use exact field names from Airtable schema (e.g., `'Expiry Date'` not `expiryDate`)
3. **Image attachments**: Must use `[{ url: string }]` format, not plain URL strings
4. **Stock quantity signs**: Don't manually negate quantities; use type parameter in `addStockMovement`
5. **Environment variables**: All Vite env vars must be prefixed with `VITE_`
6. **Table name typos**: Always import and use `TABLES` constants from `lib/airtable.ts`
7. **Path aliases**: Import shadcn components using `@/components/ui/` not relative paths like `../../components/ui/`
8. **Design consistency**: Follow the "Fresh Precision" aesthetic - use CSS variables for colors, maintain rounded corners, and apply gradients to headers/footers
9. **Modifying feature_list.json**: ONLY change `implemented` and `tested` boolean fields - NEVER remove or modify features, steps, or scenarios
10. **Skipping testing**: ALWAYS test features with Playwright MCP after implementation - do not skip this step
11. **Uncommitted changes**: ALWAYS commit changes after testing - leaving uncommitted work is not acceptable
12. **Not updating handoff status**: ALWAYS update `docs/project-status.md` in any PR that changes current priorities, active work, recently completed work, or next steps
13. **Missing high-risk PR checklist items**: High-risk PRs fail CI unless all 3 required checkbox lines are checked in PR body
14. **Assuming push and PR diff behavior is identical**: Use SHA-aware detection logic for push events to avoid empty-diff test/risk skips
