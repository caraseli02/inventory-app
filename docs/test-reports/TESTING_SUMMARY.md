# Stock Movement Testing - Summary & Instructions

## Current Status
- **Server**: Running at http://localhost:5175
- **Backend**: Supabase (PostgreSQL)
- **Environment**: Fully configured
- **Code Status**: No TypeScript errors
- **Ready for Testing**: YES ✓

## What Has Been Prepared

### 1. Documentation Created
I've created comprehensive testing documentation for you:

1. **STOCK_MOVEMENT_TEST_REPORT.md**
   - Complete technical testing guide
   - 8 detailed test scenarios with expected results
   - Code references and implementation analysis
   - Database verification queries
   - Test summary template to fill out

2. **VISUAL_TESTING_GUIDE.md**
   - Quick reference for browser testing
   - Visual UI mockups showing what to expect
   - Step-by-step testing instructions
   - Console log expectations
   - Troubleshooting guide

### 2. Implementation Analysis
I've analyzed the complete stock movement implementation:

**Key Features**:
- ✓ Supabase integration (PostgreSQL backend)
- ✓ Optimistic UI updates (instant feedback)
- ✓ Error handling with rollback
- ✓ Insufficient stock validation
- ✓ Concurrent operation prevention
- ✓ Movement history tracking
- ✓ Lifetime statistics calculation

**Files Verified**:
- `/src/lib/supabase-api.ts` - Stock movement API (lines 215-266)
- `/src/lib/api-provider.ts` - Backend abstraction layer
- `/src/pages/InventoryListPage.tsx` - Quick adjust UI (lines 84-172)
- `/src/components/inventory/ProductDetailDialog.tsx` - Movement history display

## How to Test

### Quick Start (5 minutes)
1. Open http://localhost:5175 in your browser
2. Navigate to "Inventory List"
3. Find a product with low stock
4. Click the **[+]** button to add stock
5. Click the **[-]** button to remove stock
6. Click the product to view details and see movement history

### Comprehensive Testing (20 minutes)
Follow the detailed guides in:
- **VISUAL_TESTING_GUIDE.md** - For quick visual verification
- **STOCK_MOVEMENT_TEST_REPORT.md** - For thorough testing

## Test Scenarios Overview

| # | Scenario | Expected Time |
|---|----------|---------------|
| 1 | Stock IN: Add 50 units | 2 min |
| 2 | Stock OUT: Remove 10 units | 2 min |
| 3 | Multiple movements (4 operations) | 3 min |
| 4 | Insufficient stock error | 1 min |
| 5 | Optimistic UI updates | 3 min |
| 6 | Movement history display | 2 min |
| 7 | Concurrent operation prevention | 2 min |
| 8 | Error handling & rollback | 3 min |

**Total Testing Time**: ~20 minutes

## What to Verify

### UI Behavior
- [ ] Stock numbers update immediately when clicking +/-
- [ ] Green success toast appears after operations
- [ ] Red error toast appears for insufficient stock
- [ ] Loading state prevents double-clicks
- [ ] Product detail shows movement history
- [ ] Lifetime statistics are accurate

### Console Logs
Expected logs in browser console (F12 → Console):
```
📦 Using Supabase as database backend
Adding stock movement {productId, quantity, type}
Stock movement recorded {movementId, finalQuantity}
```

### Database Verification
Check Supabase directly:
1. Go to https://qjrwvsjigyzkfxbvdfoa.supabase.co
2. Table Editor → `stock_movements`
3. Verify entries match your test operations

## Expected Results

### Stock IN (+50 units)
- Stock: 0 → 50
- Toast: "Stock updated successfully"
- History: New "+50 units" entry (green)
- Lifetime: Total IN increases by 50

### Stock OUT (-10 units)
- Stock: 50 → 40
- Toast: "Stock updated successfully"
- History: New "-10 units" entry (gray)
- Lifetime: Total OUT increases by 10

### Insufficient Stock Error
- Attempt to remove 50 from 40
- Toast: "Cannot remove 50 units. Only 40 available."
- Stock: Remains at 40 (no change)
- No API call made

## Known Implementation Details

### How Stock is Calculated
```typescript
// Stock movements are signed:
// IN:  positive quantity (+50)
// OUT: negative quantity (-10)

Current Stock = SUM(all quantities)
              = (50) + (20) + (-10) + (-5)
              = 55
```

### Optimistic Updates
The UI updates BEFORE the API responds:
1. User clicks +10
2. Stock updates immediately (optimistic)
3. API call happens in background
4. On success: Change persists
5. On error: Stock reverts + error toast

### Error Handling
- **Client-side**: Prevents negative stock (no API call)
- **Server-side**: Validates all inputs
- **Network errors**: Auto-rollback with error message
- **Concurrent ops**: Loading state prevents duplicates

## Troubleshooting

### Issue: Server not running
```bash
# Start server manually
pnpm dev
# Opens on http://localhost:5175 (or next available port)
```

### Issue: No products in inventory
1. Click "Import" button
2. Upload sample file: `/public/magazin.xlsx`
3. Products will appear in list

### Issue: Buttons don't work
- Check browser console for errors (F12)
- Verify Supabase connection (look for "Using Supabase" log)
- Refresh page and try again

### Issue: Wrong stock calculations
- Open product details
- Verify: Current Stock = Total IN - Total OUT
- Check Supabase `stock_movements` table for data integrity

## After Testing

### If All Tests Pass
1. Update `feature_list.json`:
   ```json
   {
     "id": "F003",
     "name": "Stock Movement Management",
     "tested": true  // ← Change to true
   }
   ```

2. Update `claude-progress.md`:
   - Increment "Testing Status"
   - Add notes to "Recent Activity Log"

3. Fill out test summary in `STOCK_MOVEMENT_TEST_REPORT.md`

4. Commit changes:
   ```bash
   git add feature_list.json claude-progress.md STOCK_MOVEMENT_TEST_REPORT.md
   git commit -m "test: Complete stock movement testing - all scenarios pass"
   ```

### If Tests Fail
1. Document failures in `STOCK_MOVEMENT_TEST_REPORT.md`
2. Note specific error messages
3. Include screenshots if possible
4. Check console logs for detailed error info
5. Report findings for debugging

## Quick Reference Commands

```bash
# Start dev server
pnpm dev

# Check TypeScript errors
pnpm tsc --noEmit

# Build for production
pnpm build

# Run linter
pnpm lint
```

## Testing Checklist

Before marking testing complete, verify:

- [ ] Tested on desktop browser
- [ ] Tested on mobile/tablet viewport
- [ ] Verified all 8 test scenarios
- [ ] Checked console logs (no errors)
- [ ] Verified Supabase database entries
- [ ] Filled out test summary template
- [ ] Updated `feature_list.json`
- [ ] Updated `claude-progress.md`
- [ ] Committed changes to git

## Resources

### Documentation
- `STOCK_MOVEMENT_TEST_REPORT.md` - Detailed test scenarios
- `VISUAL_TESTING_GUIDE.md` - Quick visual reference
- `CLAUDE.md` - Project overview and architecture

### Key Files
- `/src/lib/supabase-api.ts` - Stock movement API
- `/src/pages/InventoryListPage.tsx` - Main UI component
- `/src/components/inventory/ProductDetailDialog.tsx` - History display

### External Links
- Supabase Dashboard: https://qjrwvsjigyzkfxbvdfoa.supabase.co
- Dev Server: http://localhost:5175
- Project Repo: (check git remote)

## Notes

- **Playwright MCP**: Not available in this environment, so manual testing required
- **Backend**: Using Supabase (NOT Airtable) - confirmed via VITE_SUPABASE_URL
- **Stock Signing**: OUT movements stored as negative quantities in DB
- **Calculation**: Current stock = SUM of all signed quantities
- **Validation**: Client-side prevents negative stock, server validates all inputs

---

**Testing prepared by**: Claude Code (Sonnet 4.5)  
**Date**: 2025-12-18  
**Status**: Ready for manual testing ✓

---

## Questions?

If you encounter issues during testing:
1. Check the troubleshooting section above
2. Review console logs for errors
3. Verify Supabase connection and data
4. Check Network tab for failed API requests

**Happy Testing!** 🚀
