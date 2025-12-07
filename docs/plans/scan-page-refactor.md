# Plan: Refactor ScanPage with CheckoutPage Layout Pattern

## Overview
Apply the same minimalistic full-screen layout from CheckoutPage to ScanPage (add/remove products), replacing the current centered card layout with a collapsible bottom sheet on mobile and two-column layout on tablet.

---

## Visual Mockups

### Mobile Layout - Collapsed State (Scanner visible)

```
┌─────────────────────────────────────────────┐
│  ← [Scan items barcode...]            ×    │ ← Transparent header
├─────────────────────────────────────────────┤
│                                             │
│    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    │
│    ┃                                  ┃    │
│    ┃         CAMERA FEED              ┃    │
│    ┃                                  ┃    │ ← Scanner with
│    ┃     [Corner]      [Corner]      ┃    │   slate-700 brackets
│    ┃                                  ┃    │   on slate gradient
│    ┃          ─────────               ┃    │
│    ┃                                  ┃    │
│    ┃     [Corner]      [Corner]      ┃    │
│    ┃                                  ┃    │
│    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    │
│                                             │
│                                             │
│                    ▲                        │ ← Toggle button
│ ┌──────────────────────────────────────┐   │   (ChevronUp icon)
│ │  📦  Point camera at barcode         │   │
│ │      [Add Mode - slate badge]        │   │ ← Collapsed summary
│ └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Mobile Layout - Expanded State (Product Detail/Form visible)

```
┌─────────────────────────────────────────────┐
│  ← [Scan items barcode...]            ×    │ ← Header (same)
├─────────────────────────────────────────────┤
│                                             │
│    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    │
│    ┃         (Scanner still here)     ┃    │
│    ┃         but mostly covered       ┃    │ ← Scanner (75% covered)
│                    ▼                        │ ← Toggle button
├─────────────────────────────────────────────┤   (ChevronDown icon)
│ ┌─────────────────────────────────────────┐ │
│ │ 📦 Add Mode • Found: Banana             │ │ ← Panel header with
│ │                              € 1.99     │ │   status & mode badge
│ ├─────────────────────────────────────────┤ │
│ │                                         │ │
│ │   [Product Image]                      │ │
│ │                                         │ │ ← Scrollable content
│ │   Name: Banana                          │ │   (ProductDetail OR
│ │   Category: Fruits                      │ │    CreateProductForm)
│ │   Current Stock: 10                     │ │
│ │                                         │ │
│ │   Quantity to Add: [1] [+] [-]         │ │
│ │                                         │ │
│ ├─────────────────────────────────────────┤ │
│ │ [Switch to Remove Mode]                 │ │ ← Action buttons
│ │ [Add Stock / Create Product]            │ │   in footer
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
    ↑─────── 75vh height ──────↑
```

### Tablet/Desktop Layout (Static Two-Column)

```
┌────────────────────────────────────────────────────────────────┐
│  ←        [Scan items barcode...]                          ×   │ ← Transparent header
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┏━━━━━━━━━━━━━━━━━━━━━━┓    ┌──────────────────────────────┐ │
│  ┃                       ┃    │ 📦 Point camera at barcode  │ │
│  ┃                       ┃    │    [Add Mode - slate]       │ │
│  ┃   CAMERA FEED         ┃    ├──────────────────────────────┤ │
│  ┃                       ┃    │                              │ │
│  ┃   [Corner] [Corner]   ┃    │  (Empty state OR             │ │
│  ┃                       ┃    │   ProductDetail OR           │ │
│  ┃      ─────────        ┃    │   CreateProductForm)         │ │
│  ┃                       ┃    │                              │ │
│  ┃   [Corner] [Corner]   ┃    │  Success toast shown here    │ │
│  ┃                       ┃    │  for 2s after add/remove     │ │
│  ┗━━━━━━━━━━━━━━━━━━━━━━┛    ├──────────────────────────────┤ │
│                                │ [Switch to Remove Mode]      │ │
│                                │ [Add Stock / Create Product] │ │
│   ← 45% Scanner                └──────────────────────────────┘ │
│                                     ← 55% Panel →              │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Layout Structure Changes

#### 1.1 Add State Management
Add to ScanPage.tsx (after line 30):
```typescript
const [isPanelExpanded, setIsPanelExpanded] = useState(false);
const [showSuccessMessage, setShowSuccessMessage] = useState(false);
```

#### 1.2 Auto-Expand Logic
Add useEffect to auto-expand panel when product is scanned:
```typescript
useEffect(() => {
  if (scannedCode && (product || error)) {
    setIsPanelExpanded(true);
  }
}, [scannedCode, product, error]);
```

#### 1.3 Success Message Flow
After successful stock mutation in ProductDetail:
```typescript
// Show success message
setShowSuccessMessage(true);

// After 2 seconds: hide message, collapse panel, reset scanner
setTimeout(() => {
  setShowSuccessMessage(false);
  setIsPanelExpanded(false);
  handleReset(); // Clear scannedCode and return to scanner
}, 2000);
```

#### 1.4 Create Mobile Layout Structure
Replace current centered layout (lines 135-305) with:
- Full-screen container with slate gradient
- Transparent header (Back + Instruction + Close)
- Scanner section (same as CheckoutPage)
- Collapsible bottom panel with toggle button

#### 1.5 Create Desktop/Tablet Layout
Add new section (similar to CheckoutPage lines 543-770):
- Two-column flex layout (45% + 55%)
- Left: Scanner with slate-700 brackets
- Right: Static panel (always visible)

### Phase 2: Panel Content States

#### 2.1 Empty State (No Product Scanned)
When `!scannedCode`:
```typescript
<div className="flex flex-col items-center justify-center h-full text-center">
  <ShoppingCartIcon className="h-16 w-16 opacity-20 mb-3 text-gray-400" />
  <p className="text-sm text-gray-500">Point camera at barcode</p>
</div>
```

#### 2.2 Product Found State
When `product && scannedCode`:
- **Auto-expand panel**: `setIsPanelExpanded(true)` in useEffect
- Show ProductDetail component
- Panel header shows: Mode badge (slate) + Product name + Price

#### 2.3 Product Not Found State
When `!product && !isLoading && scannedCode`:
- **Auto-expand panel**: `setIsPanelExpanded(true)` in useEffect
- Show CreateProductForm component
- Panel header shows: Mode badge (slate) + "New Product"

### Phase 3: Panel Structure (Mobile & Desktop)

#### 3.1 Panel Header
```typescript
<div className="p-6 pb-4 flex items-center justify-between border-b">
  <div className="flex items-center gap-3">
    <BoxIcon className="h-6 w-6 text-stone-900" />
    <div>
      <h3 className="text-lg font-bold text-gray-900">
        {product ? product.fields.Name : 'New Product'}
      </h3>
      <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-300">
        {mode === 'add' ? 'Add Mode' : 'Remove Mode'}
      </Badge>
    </div>
  </div>
  {product && (
    <div className="text-2xl font-bold text-stone-900">
      € {product.fields.Price?.toFixed(2) || 'N/A'}
    </div>
  )}
</div>
```

**Note**: Badge uses neutral slate colors (not green/amber)

#### 3.2 Scrollable Content Area
```typescript
<div className="flex-1 overflow-y-auto p-6">
  {showCreateForm && <CreateProductForm barcode={scannedCode} />}
  {showDetail && <ProductDetail product={product} mode={mode} />}
  {!scannedCode && <EmptyState />}
</div>
```

#### 3.3 Panel Footer
```typescript
<div className="p-6 pt-4 border-t space-y-3">
  <Button variant="outline" className="w-full h-12"
    onClick={handleModeToggle}>
    Switch to {mode === 'add' ? 'Remove' : 'Add'} Mode
  </Button>

  {/* Conditional action button based on state */}
  {showDetail && (
    <Button className="w-full h-12 bg-stone-900"
      onClick={() => setIsPanelExpanded(false)}>
      Next Product
    </Button>
  )}

  {showCreateForm && (
    <Button className="w-full h-12 bg-stone-900"
      onClick={handleCreateProduct}>
      Create Product
    </Button>
  )}
</div>
```

### Phase 4: Scanner Integration

#### 4.1 Use Unique Scanner IDs
- Mobile: `scannerId="add-mobile-reader"`
- Desktop: `scannerId="add-desktop-reader"`

#### 4.2 Scanner Styling
- Match CheckoutPage exactly:
  - Black background scanner area
  - Slate-700 corner brackets (not white)
  - Slate-700 scan line
  - Slate gradient background

### Phase 5: Button Behaviors

#### 5.1 Mode Toggle Button
Location: Panel footer
Action: `onModeChange(mode === 'add' ? 'remove' : 'add')`
Style: Outline variant, full width

#### 5.2 Back Button
Location: Transparent header (top-left)
Action: `onBack()`
Icon: ArrowLeftIcon

#### 5.3 Close Button
Location: Transparent header (top-right)
Action: `onBack()`
Icon: CloseIcon

#### 5.4 Next Product Button
Location: Panel footer
Action: Collapse panel + reset scanner
Conditional: Only shown after successful add/remove

---

## Files to Modify

### Primary File
- **`src/pages/ScanPage.tsx`**
  - Complete layout restructure
  - Add collapsible panel logic
  - Preserve all existing business logic (hooks, mutations, AI)
  - Update styling to match CheckoutPage aesthetic

### Components (No changes needed)
- `src/components/product/ProductDetail.tsx` - Use as-is
- `src/components/product/CreateProductForm.tsx` - Use as-is
- `src/components/scanner/Scanner.tsx` - Already supports scannerId prop

---

## Design System Consistency

### Colors (from CheckoutPage)
- Background: `bg-gradient-to-br from-slate-100 to-slate-200`
- Header: Transparent with `border-b border-white/50`
- Panel: `bg-white rounded-2xl shadow-lg`
- Brackets/Lines: `border-slate-700` and `bg-slate-700`
- Buttons: `bg-stone-900 hover:bg-stone-800` (black)

### Spacing
- Header padding: `p-4`
- Panel padding: `p-6`
- Button height: `h-12`
- Gap between buttons: `space-y-3`

### Transitions
- Panel height: `transition-all duration-300 ease-in-out`
- Button hovers: Built into shadcn components

---

## Behavior Changes Summary

| Current Behavior | New Behavior |
|-----------------|--------------|
| Centered card with scanner | Full-screen scanner with bottom sheet |
| Mode toggle in header | Mode toggle in panel footer |
| Status banner above scanner | Status in panel header |
| Separate pages for create/detail | Modal panel with same content |
| Manual "Back" navigation | "Next Product" collapses panel |

---

## Preserving Existing Logic

### Keep Unchanged:
✅ Product lookup hook (`useProductLookup`)
✅ Stock mutation logic (add/remove)
✅ AI auto-fill for CreateProductForm
✅ Manual barcode entry
✅ Mode switching logic
✅ Form validation
✅ Error handling

### Only Change:
🎨 Layout structure
🎨 Component positioning
🎨 Visual styling
🎨 Responsive breakpoints

---

## Testing Checklist

- [ ] Mobile: Scanner visible when panel collapsed
- [ ] Mobile: Panel expands to 75vh when product scanned
- [ ] Mobile: Toggle button works (ChevronUp/Down)
- [ ] Mobile: Panel scrolls when content exceeds height
- [ ] Tablet: Two-column layout (45% scanner, 55% panel)
- [ ] Scanner IDs are unique (no conflicts with CheckoutPage)
- [ ] Mode toggle switches between Add/Remove
- [ ] ProductDetail shows for existing products
- [ ] CreateProductForm shows for new products
- [ ] "Next Product" button collapses panel
- [ ] Back button returns to home
- [ ] All existing business logic preserved

---

## User Decisions (Confirmed)

✅ **Empty State Text**: "Point camera at barcode"
✅ **Panel Auto-Expand**: Yes, automatically expand when product is scanned
✅ **Success State**: Show success message (2 seconds), then auto-collapse panel
✅ **Mode Badge Color**: Neutral slate/stone for consistent minimal design
