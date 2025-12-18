# Stock Movement Testing Report
**Test Date**: 2025-12-18  
**URL**: http://localhost:5175  
**Backend**: Supabase  
**Status**: Ready for Manual Testing

## Overview
This document provides a comprehensive testing guide for the stock IN/OUT movement functionality in the inventory management application.

## Implementation Analysis

### Architecture
- **API Layer**: `/src/lib/api-provider.ts` - Unified API that switches between Supabase and Airtable
- **Supabase Implementation**: `/src/lib/supabase-api.ts` - PostgreSQL-backed stock movements
- **UI Component**: `/src/pages/InventoryListPage.tsx` - Handles quick adjust buttons
- **Detail View**: `/src/components/inventory/ProductDetailDialog.tsx` - Shows movement history

### Stock Movement Logic (Supabase)

```typescript
// From supabase-api.ts lines 215-266
export const addStockMovement = async (
  productId: string,
  quantity: number,
  type: 'IN' | 'OUT'
): Promise<StockMovement> => {
  // Validation:
  // - Product ID must be non-empty
  // - Quantity must be positive number
  // - Type must be 'IN' or 'OUT'
  
  // Quantity signing:
  // - OUT: negative value (-Math.abs(quantity))
  // - IN: positive value (Math.abs(quantity))
  
  const finalQuantity = type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity);
  
  // Insert into stock_movements table
  await supabase.from('stock_movements').insert({
    product_id: productId,
    quantity: finalQuantity,
    type,
    date: new Date().toISOString().split('T')[0]
  });
}
```

### Stock Calculation
Current stock is calculated by summing all stock movements for a product:
- IN movements: positive quantities
- OUT movements: negative quantities
- Sum = Total IN - Total OUT = Current Stock

## Test Scenarios

### Test 1: Stock IN Movement
**Preconditions**:
1. Navigate to http://localhost:5175/inventory-list
2. Ensure products exist (import if empty)
3. Identify a product with 0 stock

**Steps**:
1. Locate the product in the inventory list
2. Click the "+" button or "Stock IN" button
3. Enter quantity: `50`
4. Submit the form
5. Observe the stock level update

**Expected Results**:
- Stock level changes from 0 to 50
- Green success toast appears: "Stock updated successfully"
- Product card/row updates immediately (optimistic UI)
- Console logs: `Adding stock movement {productId, quantity: 50, type: 'IN'}`
- Console logs: `Stock movement recorded {finalQuantity: 50, type: 'IN'}`

**Verification**:
- Open product details dialog
- Check "Recent Movements" section
- Verify movement shows: "+50 units" with today's date
- Verify "Lifetime Statistics" shows: Total In = 50, Total Out = 0

---

### Test 2: Stock OUT Movement
**Preconditions**:
1. Product must have stock > 0 (use product from Test 1 with 50 units)

**Steps**:
1. Locate the same product
2. Click the "-" button or "Stock OUT" button
3. Enter quantity: `10`
4. Submit the form
5. Observe the stock level update

**Expected Results**:
- Stock level changes from 50 to 40
- Green success toast appears: "Stock removed successfully"
- Product updates immediately
- Console logs: `Adding stock movement {productId, quantity: 10, type: 'OUT'}`
- Console logs: `Stock movement recorded {finalQuantity: -10, type: 'OUT'}`

**Verification**:
- Open product details dialog
- Check "Recent Movements" section
- Verify TWO movements appear:
  - First: "-10 units" (most recent)
  - Second: "+50 units" (from Test 1)
- Verify "Lifetime Statistics" shows: Total In = 50, Total Out = 10
- Current Stock = 40

---

### Test 3: Multiple Movements
**Steps**:
1. Add 20 units IN
2. Remove 5 units OUT
3. Add 15 units IN
4. Remove 30 units OUT

**Expected Results**:
- After step 1: Stock = 40 + 20 = 60
- After step 2: Stock = 60 - 5 = 55
- After step 3: Stock = 55 + 15 = 70
- After step 4: Stock = 70 - 30 = 40

**Verification**:
- Open product details
- Verify 4 new movements in history (6 total including Tests 1-2)
- Verify Lifetime Stats:
  - Total IN: 50 + 20 + 15 = 85
  - Total OUT: 10 + 5 + 30 = 45
  - Current Stock: 85 - 45 = 40

---

### Test 4: Insufficient Stock Error Handling
**Steps**:
1. Product has 40 units
2. Try to remove 50 units OUT

**Expected Results**:
- RED error toast appears: "Insufficient stock"
- Message: "Cannot remove 50 units. Only 40 available."
- Stock level does NOT change
- No API call made (prevented client-side)

**Code Reference** (InventoryListPage.tsx lines 100-108):
```typescript
// Prevent negative stock
if (type === 'OUT' && currentStock < quantity) {
  showToast(
    'error',
    t('product.insufficientStock'),
    t('product.cannotRemove', { quantity, available: currentStock }),
    4000
  );
  return; // Exit before API call
}
```

---

### Test 5: Optimistic UI Updates
**Purpose**: Verify UI updates immediately before API confirmation

**Steps**:
1. Open browser DevTools → Network tab
2. Throttle network to "Slow 3G"
3. Add 10 units IN
4. Observe stock count

**Expected Results**:
- Stock count updates IMMEDIATELY (optimistic)
- API request is still pending (visible in Network tab)
- On success: change persists
- On failure: stock reverts to original value + error toast

**Code Reference** (InventoryListPage.tsx lines 116-132):
```typescript
// Optimistically update the cache BEFORE API call
queryClient.setQueryData<Product[]>(['products', 'all'], (oldData) => {
  if (!oldData) return oldData;
  
  return oldData.map((p) => {
    if (p.id !== productId) return p;
    
    const newStock = currentStock + delta;
    return {
      ...p,
      fields: {
        ...p.fields,
        'Current Stock Level': newStock,
      },
    };
  });
});

// Then make API call
await addStockMovement(productId, quantity, type);
```

---

### Test 6: Stock Movement History
**Steps**:
1. Select a product with movements
2. Click to open Product Detail Dialog
3. Scroll to "Recent Movements" section

**Expected Results**:
- Movements listed in reverse chronological order (newest first)
- Each movement shows:
  - Icon: Green arrow down (IN) or Gray arrow up (OUT)
  - Quantity: "+X units" (IN) or "-X units" (OUT)
  - Date: formatted as locale date
  - Badge: "IN" (green) or "OUT" (gray)
- Loading spinner appears while fetching
- Empty state if no movements: "No stock movements yet"

---

### Test 7: Concurrent Operations Prevention
**Purpose**: Prevent duplicate operations while one is in progress

**Steps**:
1. Throttle network to "Slow 3G"
2. Click "+10" button
3. IMMEDIATELY click "+10" again (before first completes)

**Expected Results**:
- First click: Triggers API call
- Second click: IGNORED (no-op)
- Only ONE movement created (quantity: 10)
- Loading state prevents double-submission

**Code Reference** (InventoryListPage.tsx lines 88-90):
```typescript
// Prevent multiple simultaneous operations on the same product
if (loadingProducts.has(productId)) return;
```

---

### Test 8: API Error Handling & Rollback
**Purpose**: Verify graceful error handling with rollback

**Steps**:
1. Disconnect internet OR use DevTools to block network
2. Try to add 10 units IN
3. Observe behavior

**Expected Results**:
- Initial: Stock updates optimistically (appears to succeed)
- After ~2-5 seconds: Error toast appears
- Stock reverts to original value (rollback)
- Error message shows network/API error

**Code Reference** (InventoryListPage.tsx lines 157-160):
```typescript
// Rollback on error
if (previousData) {
  queryClient.setQueryData(['products', 'all'], previousData);
}
```

---

## Console Logging Guide

### Expected Console Messages

**Successful Stock IN**:
```
📦 Using Supabase as database backend
Adding stock movement {productId: "uuid-here", quantity: 50, type: 'IN'}
Stock movement recorded {movementId: "uuid", finalQuantity: 50, type: 'IN'}
```

**Successful Stock OUT**:
```
Adding stock movement {productId: "uuid-here", quantity: 10, type: 'OUT'}
Stock movement recorded {movementId: "uuid", finalQuantity: -10, type: 'OUT'}
```

**Error (Insufficient Stock)**:
```
// No API call made - prevented client-side
// Only UI toast appears
```

**Error (API Failure)**:
```
Stock adjustment failed {
  productId: "uuid",
  productName: "Product Name",
  quantity: 10,
  type: "IN",
  currentStock: 40,
  errorMessage: "Network error",
  timestamp: "2025-12-18T..."
}
```

---

## Database Verification

### Check Supabase Directly

1. Go to https://qjrwvsjigyzkfxbvdfoa.supabase.co
2. Navigate to Table Editor → `stock_movements`
3. Verify entries match test operations
4. Check columns:
   - `id`: UUID
   - `product_id`: UUID (links to products table)
   - `quantity`: Signed integer (negative for OUT, positive for IN)
   - `type`: 'IN' or 'OUT'
   - `date`: YYYY-MM-DD
   - `created_at`: Timestamp

### SQL Query to Verify Stock
```sql
-- Calculate current stock for a product
SELECT 
  p.name,
  SUM(sm.quantity) as current_stock,
  COUNT(sm.id) as total_movements
FROM products p
LEFT JOIN stock_movements sm ON sm.product_id = p.id
WHERE p.id = 'your-product-uuid'
GROUP BY p.id, p.name;
```

---

## Known Issues & Edge Cases

### 1. Zero Stock Products
**Status**: WORKING  
Products can have 0 stock and accept IN movements.

### 2. Negative Stock Prevention
**Status**: WORKING  
Client-side validation prevents OUT movements that would result in negative stock.

### 3. Decimal Quantities
**Status**: NOT TESTED  
Current implementation expects integers. Decimal quantities may cause issues.

### 4. Rapid Clicking
**Status**: WORKING  
Loading state prevents duplicate submissions.

### 5. Offline Mode
**Status**: PARTIAL  
Optimistic updates work, but changes are lost if offline (no queue/retry).

---

## Test Summary Template

Copy this table and fill in results after manual testing:

| Test # | Scenario | Status | Notes |
|--------|----------|--------|-------|
| 1 | Stock IN: Add 50 units | ⬜ PASS / ⬜ FAIL | |
| 2 | Stock OUT: Remove 10 units | ⬜ PASS / ⬜ FAIL | |
| 3 | Multiple movements (20 IN, 5 OUT, 15 IN, 30 OUT) | ⬜ PASS / ⬜ FAIL | |
| 4 | Insufficient stock error (remove 50 from 40) | ⬜ PASS / ⬜ FAIL | |
| 5 | Optimistic UI update | ⬜ PASS / ⬜ FAIL | |
| 6 | Movement history display | ⬜ PASS / ⬜ FAIL | |
| 7 | Concurrent operation prevention | ⬜ PASS / ⬜ FAIL | |
| 8 | Error handling & rollback | ⬜ PASS / ⬜ FAIL | |

**Overall Status**: ⬜ ALL PASS / ⬜ SOME FAILURES / ⬜ NOT TESTED

**Tester**: _____________  
**Date**: _____________  
**Browser**: _____________  
**Notes**: _______________________________________________________

---

## Next Steps After Testing

1. **If all tests pass**:
   - Update `feature_list.json`: Mark F003 (Stock Movement Management) as `tested: true`
   - Update `claude-progress.md`: Increment testing progress
   - Commit changes with message: `test: Complete stock movement testing`

2. **If tests fail**:
   - Document failure details in this report
   - Create GitHub issue with reproduction steps
   - Link to this test report

3. **Additional testing**:
   - Test on different devices (tablet, mobile)
   - Test with multiple users simultaneously
   - Load test with 100+ products

---

## Files Referenced

- `/src/lib/supabase-api.ts` - Stock movement API implementation
- `/src/lib/api-provider.ts` - API abstraction layer
- `/src/pages/InventoryListPage.tsx` - Quick adjust UI
- `/src/components/inventory/ProductDetailDialog.tsx` - Movement history display
- `/src/hooks/useStockMutation.ts` - React Query mutation hook

---

**End of Test Report**
