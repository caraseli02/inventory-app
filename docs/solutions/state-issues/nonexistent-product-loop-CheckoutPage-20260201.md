---
module: CheckoutPage
date: 2026-02-01
problem_type: state_issue
component: page_component
symptoms:
  - Scanning a product that doesn't exist in checkout causes infinite loop
  - No error message shown to user
  - App becomes unresponsive
root_cause: missing_error_handler
resolution_type: code_fix
severity: high
tags: [checkout, product-lookup, error-handling, useEffect]
related_github_issue: null
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

- [x] Handle all three states explicitly: success, not-found, and error
- [x] Add `isLoading` to useEffect dependencies to detect completion
- [ ] Consider adding TypeScript exhaustive check for lookup states
