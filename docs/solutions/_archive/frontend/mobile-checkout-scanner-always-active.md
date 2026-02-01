---
title: Mobile Checkout Scanner Always Active
category: frontend
severity: HIGH
date: '2026-02-01'
tags: []
module: Unknown
related_github_issue: null
status: resolved
symptoms:
  - In checkout mode, scanner runs even when cart panel is open
  - Unwanted scans while reviewing cart on mobile
  - Phone vibrates during cart interaction
commit: 96437d2
---

# Problem Description
Mobile Checkout Scanner Always Active

# Symptoms
*   In checkout mode, scanner runs even when cart panel is open
*   Unwanted scans while reviewing cart on mobile
*   Phone vibrates during cart interaction


# Root Cause Analysis
Scanner was always rendered on mobile, regardless of cart state.



# Solution
Conditionally render scanner based on cart expansion state:

```tsx
// ✅ Mobile: Scanner stops when cart expanded
{!state.isCartExpanded && (
  <div className="px-6 pt-4">
    <ScannerFrame scannerId="mobile-reader" {...props} />
  </div>
)}
```

Auto-collapse cart after successful scan for smooth flow:

```typescript
if (product) {
  dispatch({ type: 'ADD_TO_CART', product });
  playSound('success');
  dispatch({ type: 'LOOKUP_SUCCESS' });
  dispatch({ type: 'SET_CART_EXPANDED', expanded: false }); // Auto-collapse
  return;
}
```



# Files Changed
- `src/pages/CheckoutPage.tsx` (lines 518-533, 298-300)



# Prevention

