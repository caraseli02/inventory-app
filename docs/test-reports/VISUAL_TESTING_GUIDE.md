# Visual Testing Guide - Stock Movements
**Quick Reference for Manual Browser Testing**

## Setup
1. **Open Application**: http://localhost:5175
2. **Open DevTools**: Press F12 or Cmd+Opt+I (Mac)
3. **Open Console Tab**: To see API logs
4. **Navigate**: Click "Inventory List" from home page

## What You Should See

### 1. Inventory List Page
```
+--------------------------------------------------+
|  ← Back             Inventory List               |
+--------------------------------------------------+
|  [Filters] [Import] [Export] [Refresh]          |
+--------------------------------------------------+
| Product Name          Stock    Price   Actions  |
|--------------------------------------------------|
| Test Product           40      €5.00   [+] [-]  |
| Another Product         0      €3.50   [+] [-]  |
| Third Product         100      €9.99   [+] [-]  |
+--------------------------------------------------+
```

**Look for**:
- Plus (+) button: Add stock IN
- Minus (-) button: Remove stock OUT
- Stock numbers update immediately when clicked

---

### 2. Quick Adjust Buttons (Mobile View)
```
+--------------------------------+
| Test Product                   |
| Category: Groceries            |
| Stock: 40 | Price: €5.00       |
|                                |
| [+10]  [-10]  [View Details]  |
+--------------------------------+
```

**Behavior**:
- Click +10: Adds 10 units instantly
- Click -10: Removes 10 units (if available)
- Gray button = loading state

---

### 3. Product Detail Dialog
```
+--------------------------------------------------+
|                Test Product                   [X]|
|            [Groceries]                           |
+--------------------------------------------------+
|  [Image]         Price: €5.00    Stock: 40       |
|                  Barcode: 123456                 |
+--------------------------------------------------+
| Lifetime Statistics                              |
| ↗ Total IN: 85      ↘ Total OUT: 45             |
+--------------------------------------------------+
| Recent Movements                                 |
|  ↓ +50 units        IN    2025-12-18            |
|  ↑ -10 units        OUT   2025-12-18            |
|  ↓ +20 units        IN    2025-12-17            |
+--------------------------------------------------+
|  [Close]                           [Edit] -------|
+--------------------------------------------------+
```

**Verify**:
- Movement history shows ALL transactions
- Lifetime stats match total IN/OUT
- Current stock = Total IN - Total OUT

---

### 4. Success Toast (Top-right corner)
```
+-----------------------------------+
| ✓ Stock Updated Successfully      |
| Added 10 units to Test Product    |
+-----------------------------------+
```

**Variants**:
- Green = Success (stock added/removed)
- Red = Error (insufficient stock, API failure)
- Yellow = Warning (low stock alert)

---

### 5. Error Toast (Insufficient Stock)
```
+-----------------------------------+
| ⚠ Insufficient Stock              |
| Cannot remove 50 units. Only 40   |
| units available.                  |
+-----------------------------------+
```

---

### 6. Console Logs (Expected Output)

**On page load**:
```
📦 Using Supabase as database backend
Fetching all products
All products fetched {recordCount: 15}
```

**On Stock IN (+50 units)**:
```
Adding stock movement {productId: "abc-123", quantity: 50, type: "IN"}
Stock movement recorded {movementId: "def-456", finalQuantity: 50, type: "IN"}
```

**On Stock OUT (-10 units)**:
```
Adding stock movement {productId: "abc-123", quantity: 10, type: "OUT"}
Stock movement recorded {movementId: "ghi-789", finalQuantity: -10, type: "OUT"}
```

**On Error**:
```
Stock adjustment failed {
  productId: "abc-123",
  productName: "Test Product",
  quantity: 50,
  type: "OUT",
  currentStock: 40,
  errorMessage: "Cannot remove more than current stock",
  timestamp: "2025-12-18T10:30:45.123Z"
}
```

---

## Step-by-Step Testing

### Test 1: Add Stock IN
1. Find product with 0 or low stock
2. Click the **[+]** button or **[+10]** button
3. **Observe**:
   - Stock number increases immediately
   - Green toast appears (top-right)
   - Console shows: "Adding stock movement"
4. **Verify**:
   - Click product to open details
   - Check "Recent Movements" - new entry at top
   - Check "Lifetime Stats" - Total IN increased

### Test 2: Remove Stock OUT
1. Find product with stock > 10
2. Click the **[-]** button or **[-10]** button
3. **Observe**:
   - Stock number decreases immediately
   - Green toast appears
   - Console shows: "Adding stock movement"
4. **Verify**:
   - Open product details
   - Check movements - new OUT entry at top
   - Check Lifetime Stats - Total OUT increased
   - Verify: Current Stock = Total IN - Total OUT

### Test 3: Error Handling
1. Find product with stock = 10
2. Click **[-]** and try to remove 50 units
3. **Observe**:
   - RED error toast appears
   - Message: "Cannot remove 50 units. Only 10 available."
   - Stock number does NOT change
   - NO console log for API call (prevented)

### Test 4: Optimistic Updates
1. Open DevTools → Network tab
2. Throttle to "Slow 3G" (top dropdown)
3. Click **[+10]** to add stock
4. **Observe**:
   - Stock number updates INSTANTLY
   - API request shows "pending" in Network tab
   - After 2-3 seconds, request completes
   - Stock number stays updated (no flash)

### Test 5: Movement History
1. Select a product with stock movements
2. Click to open Product Detail Dialog
3. Scroll to "Recent Movements"
4. **Verify**:
   - Movements listed newest-first
   - Each shows: Icon, Quantity, Date, Badge
   - Green icon = IN, Gray icon = OUT
   - Quantities have correct +/- signs

---

## Quick Math Checks

### Example Scenario
```
Initial Stock: 0

Operation 1: Add 50 IN
→ Stock = 0 + 50 = 50 ✓

Operation 2: Remove 10 OUT
→ Stock = 50 - 10 = 40 ✓

Operation 3: Add 20 IN
→ Stock = 40 + 20 = 60 ✓

Operation 4: Remove 30 OUT
→ Stock = 60 - 30 = 30 ✓

Lifetime Stats:
- Total IN: 50 + 20 = 70 ✓
- Total OUT: 10 + 30 = 40 ✓
- Current: 70 - 40 = 30 ✓
```

---

## Common Issues & Solutions

### Issue: Buttons do nothing
**Solution**: Check console for errors. Verify Supabase connection.

### Issue: Stock doesn't update
**Solution**: 
1. Check Network tab for failed requests
2. Verify internet connection
3. Check console for "Stock adjustment failed" error

### Issue: "Cannot remove X units" error
**Solution**: This is EXPECTED when trying to remove more than available. Stock level is correct.

### Issue: Movements not showing in history
**Solution**: 
1. Close and reopen product detail dialog
2. Check console for "Failed to fetch stock movements" error
3. Verify Supabase stock_movements table has data

### Issue: Wrong stock calculation
**Solution**:
1. Open product details
2. Manually sum Total IN - Total OUT
3. Compare with Current Stock
4. Check Supabase table for incorrect signed quantities

---

## Browser Compatibility

**Tested Browsers**:
- Chrome 120+ ✓
- Firefox 120+ ✓
- Safari 17+ ✓
- Edge 120+ ✓

**Mobile Browsers**:
- iOS Safari ✓
- Chrome Mobile ✓

---

## Performance Expectations

**Operation Times**:
- Stock IN/OUT: < 500ms (local network)
- Open details: < 300ms
- Load movements: < 200ms
- Optimistic update: < 50ms (instant)

**If slower**:
- Check network throttling
- Verify Supabase region/latency
- Check DevTools Performance tab

---

## Supabase Verification

### Check Database Directly
1. Go to: https://qjrwvsjigyzkfxbvdfoa.supabase.co
2. Login with credentials
3. Navigate: Table Editor → `stock_movements`
4. Verify entries:
   - `type`: 'IN' or 'OUT'
   - `quantity`: Negative for OUT, Positive for IN
   - `date`: Today's date (YYYY-MM-DD)
   - `product_id`: Valid UUID

### SQL Console Test
```sql
-- View recent movements
SELECT * FROM stock_movements 
ORDER BY created_at DESC 
LIMIT 10;

-- Calculate stock for specific product
SELECT 
  p.name,
  SUM(sm.quantity) as current_stock
FROM products p
LEFT JOIN stock_movements sm ON sm.product_id = p.id
WHERE p.name = 'Test Product'
GROUP BY p.name;
```

---

## Checklist Before Submitting

- [ ] Tested Stock IN operation
- [ ] Tested Stock OUT operation
- [ ] Tested insufficient stock error
- [ ] Verified movement history display
- [ ] Verified lifetime statistics calculation
- [ ] Checked console logs (no errors)
- [ ] Verified Supabase database entries
- [ ] Tested on mobile viewport
- [ ] Tested optimistic UI updates
- [ ] Tested concurrent operation prevention

---

**End of Visual Testing Guide**
