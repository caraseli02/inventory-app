# UX Design Proposals

This directory contains detailed UX design proposals and alternative approaches explored during development.

## Files

### Product Edit UX Proposals v3
**File**: `product-edit-ux-proposals-v3.html` (79KB)

Interactive mockup exploring different approaches to the product edit dialog:

- **Created**: 2025-12-17
- **Purpose**: Evaluate UX options for editing product details
- **Variants**: Multiple approaches to form layout, field grouping, and action placement

**Features Explored**:
- Form field organization (single column vs. multi-column)
- Price tier editing (50%, 70%, 100% markup)
- Stock threshold configuration
- Camera capture integration
- Barcode scanning in edit mode
- Image upload/URL input

**Implementation Status**: ✅ Implemented in `src/components/product/EditProductDialog.tsx`

**Key Decisions**:
- Chose single-column form for mobile-first approach
- Integrated barcode scanner button for products without barcodes
- Combined URL input and camera capture for image flexibility
- Used toggle group for markup percentage selection

## Viewing Proposals

These are **interactive HTML prototypes** - open in browser to explore:

```bash
# Open in default browser
open docs/proposals/product-edit-ux-proposals-v3.html

# Or serve with local server
python3 -m http.server 8000
# Visit: http://localhost:8000/docs/proposals/
```

## Design Process

1. **Research Phase**: User feedback, usability issues identified
2. **Proposal Phase**: Create interactive mockups (this directory)
3. **Review Phase**: Team evaluation, user testing
4. **Implementation Phase**: Build chosen variant
5. **Refinement Phase**: Iterate based on real usage

## Design System

All proposals follow the **"Fresh Precision"** design system:

**Colors**:
- `--color-cream`: #FAFAF9 (background)
- `--color-forest`: #059669 (primary actions)
- `--color-terracotta`: #EA580C (warnings/destructive)
- `--color-lavender`: #8B5CF6 (accents)
- `--color-stone`: #78716C (text)

**Typography**:
- Headers: Instrument Serif
- Body: Inter

**Framework**: Tailwind CSS v3 (via CDN)

## Related Documentation

- **Mockups**: See `docs/mockups/` for checkout, inventory, and invoice UI mockups
- **Design System**: See `CLAUDE.md` section "UI Components & Design System"
- **Implementation**: See component files in `src/components/`
- **UX Research**: See `docs/inventory-ux-research-findings.md`

## Adding New Proposals

When creating new UX proposals:

1. **Create HTML mockup**: Use the design system colors and typography
2. **Document variants**: Show 2-4 different approaches
3. **Add to this README**: Document the proposal and its purpose
4. **Review with team**: Get feedback before implementation
5. **Update status**: Mark as implemented when done
6. **Keep for reference**: Don't delete - useful for design documentation

## Proposal Template

New proposals should include:

- **Title**: Clear description of the feature/area
- **Created Date**: When the proposal was made
- **Purpose**: What problem it solves
- **Variants**: 2-4 different approaches
- **Trade-offs**: Pros/cons of each variant
- **Recommendation**: Suggested approach with reasoning
- **Dependencies**: Related features or constraints
