---
title: Checkout Infinite Loop on Non-Existent Products
category: frontend
severity: HIGH
date: '2026-02-01'
tags: []
module: Unknown
related_github_issue: null
status: resolved
symptoms:
  - Scanning a product that doesn't exist in checkout causes infinite loop
  - No error message shown to user
  - App becomes unresponsive
commit: 0e4e5f1
---

# Problem Description
Checkout Infinite Loop on Non-Existent Products

# Symptoms
*   Scanning a product that doesn't exist in checkout causes infinite loop
*   No error message shown to user
*   App becomes unresponsive


# Root Cause Analysis
Lookup handler only checked for `product` (success) and `error` states, but missed the "product not found" case where `!isLoading && !product && !error`:

```typescript
// ❌ BEFORE (missing case)
useEffect(() => {
  if (!state.scannedCode) return;

  if (product) {
    // Handle success
  }

  if (error) {
    // Handle error
  }

  // Missing: what if product is null but no error?
}, [error, playSound, product, state.scannedCode]);
```



# Solution
Added explicit handling for "not found" case:

```typescript
// ✅ AFTER (all cases handled)
useEffect(() => {
  if (!state.scannedCode) return;

  // Product found successfully
  if (product) {
    dispatch({ type: 'ADD_TO_CART', product });
    dispatch({ type: 'LOOKUP_SUCCESS' });
    return;
  }

  // Product not found (null returned, no error)
  if (!isLoading && !product && !error) {
    playSound('error');
    dispatch({
      type: 'LOOKUP_ERROR',
      error: 'Product not found. Please add it to inventory first.'
    });
    return;
  }

  // Network or API error
  if (error) {
    // Handle error
  }
}, [error, isLoading, playSound, product, state.scannedCode]);
```



# Files Changed
- `src/pages/CheckoutPage.tsx` (lines 301-310)



# Prevention

