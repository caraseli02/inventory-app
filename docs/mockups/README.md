# UX Mockups & Interactive Prototypes

This directory contains interactive HTML mockups created during the design phase. These mockups were used to explore different UX approaches before implementation.

## Files

### Checkout Flow Mockups
- **checkout-ux-proposals.html** (88KB)
  - 4 interactive variants for checkout cart UI
  - Created: 2025-12-17
  - Explores different approaches to cart display, item management, and checkout flow
  - Features: Cart header variants, item quantity controls, checkout buttons

- **checkout-completion-ux-proposals.html** (83KB)
  - Checkout completion screen variants
  - Created: 2025-12-17
  - Post-checkout success states and actions
  - Features: Order summary, print receipt, share options

### Inventory Management Mockups
- **inventory-ux-proposals.html** (51KB)
  - Inventory list and management UI variants
  - Created: 2025-12-17
  - Different approaches to displaying and managing product inventory
  - Features: List views, filters, quick actions

### Invoice Upload Mockups
- **invoice-upload-ui-variants.html** (72KB)
  - Invoice upload and OCR processing UI
  - Created: 2025-12-17
  - Drag & drop, progress indicators, product preview tables
  - Features: File upload, OCR status, editable product table

## Usage

These are **interactive prototypes** - open them in a browser to explore different UX variants:

```bash
# Open in default browser
open docs/mockups/checkout-ux-proposals.html

# Or use a local server
python3 -m http.server 8000
# Then visit: http://localhost:8000/docs/mockups/
```

## Design System

All mockups follow the "Fresh Precision" design system:
- **Colors**: Cream background, Forest green primary, Terracotta warnings
- **Typography**: Inter (body), Instrument Serif (headers)
- **Framework**: Tailwind CSS v3 (via CDN)
- **Icons**: Lucide icons

## Implementation Status

| Mockup | Status | Implementation Location |
|--------|--------|------------------------|
| Checkout UX Proposals | ✅ Implemented | `src/pages/CheckoutPage.tsx` |
| Checkout Completion | ✅ Implemented | `src/pages/CheckoutPage.tsx` (completion state) |
| Inventory UX Proposals | ✅ Implemented | `src/pages/InventoryListPage.tsx` |
| Invoice Upload UI | ✅ Implemented | `src/components/invoice/InvoiceUploadDialog.tsx` |

## Notes

- These mockups were created **before implementation** to explore UX options
- Some variants were combined in the final implementation
- Mockups remain as **design documentation** and reference
- They are **not part of the production build** (not in `/dist`)

## Related Documentation

- **Design Decisions**: See `docs/CHECKOUT_UI_IMPROVEMENTS.md`
- **UX Research**: See `docs/inventory-ux-research-findings.md`
- **Product Edit Mockups**: See `docs/proposals/product-edit-ux-proposals-v3.html`
- **Implementation Guide**: See `CLAUDE.md` (UI Components & Design System section)
