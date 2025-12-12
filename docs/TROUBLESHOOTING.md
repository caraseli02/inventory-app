# Production Troubleshooting Guide

This document covers all production issues encountered and their solutions. Use this guide when debugging similar issues in the future.

## Table of Contents

1. [Black Screens / Failed API Calls](#black-screens--failed-api-calls)
2. [Scanner Issues](#scanner-issues)
3. [PWA & Service Worker Issues](#pwa--service-worker-issues)
4. [UI/UX Issues](#uiux-issues)

---

## Black Screens / Failed API Calls

### Issue: Production App Shows Black Screen

**Symptoms:**
- App loads but shows black screen
- Console shows CSP (Content Security Policy) errors
- All API calls fail with "Refused to connect" errors
- Network tab shows blocked requests to api.airtable.com

**Root Cause:**
The `vercel.json` file contained overly restrictive CSP headers that blocked essential API domains:

```json
// ❌ BEFORE (blocked Airtable)
"connect-src 'self' world.openfoodfacts.org"
```

**Solution:**
Updated `vercel.json` to allow all required domains:

```json
// ✅ AFTER (allows all needed APIs)
"connect-src 'self' https://api.airtable.com https://*.airtable.com https://world.openfoodfacts.org https://images.openfoodfacts.org"
```

**Files Changed:**
- `vercel.json` (line 8)

**Commit:** `d39bb8f`

**Prevention:**
- Always test in production after deployment
- Check browser console for CSP violations
- Verify all external API domains are whitelisted in CSP

---

## Scanner Issues

### Issue 1: Scanner Loop (Continuous Item Additions)

**Symptoms:**
- Scanning a barcode once adds item multiple times
- Phone vibrates continuously when barcode stays in view
- Multiple API requests sent for same barcode

**Root Cause:**
Scanner component restarted on every render due to `onScanSuccess` callback in `useEffect` dependencies:

```typescript
// ❌ BEFORE
useEffect(() => {
  // Scanner initialization
}, [onScanSuccess]); // Callback changes on every render
```

**Solution:**
1. Use ref-based callback pattern to prevent restarts
2. Add 2-second debounce for duplicate scans

```typescript
// ✅ AFTER
const onScanSuccessRef = useRef(onScanSuccess);
const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);

useEffect(() => {
  onScanSuccessRef.current = onScanSuccess;
}, [onScanSuccess]);

useEffect(() => {
  // Scanner with debounce
  scanner.start(
    { facingMode: 'environment' },
    config,
    (decodedText) => {
      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.code === decodedText &&
        now - lastScanRef.current.timestamp < 2000
      ) {
        return; // Ignore duplicate
      }
      lastScanRef.current = { code: decodedText, timestamp: now };
      onScanSuccessRef.current(decodedText);
    }
  );
}, [regionId]); // Only restart on region change
```

**Files Changed:**
- `src/components/scanner/Scanner.tsx` (lines 13-93)

**Commit:** `968933d`

---

### Issue 2: Scanner Active During Modal Interaction

**Symptoms:**
- Scanner keeps running when product detail modal opens
- Phone vibrates while user interacts with add/remove controls
- Unwanted scans happen in background
- Multiple concurrent API requests

**Root Cause:**
Scanner was hidden with CSS (`className="hidden"`) but still mounted and running:

```tsx
// ❌ BEFORE (hidden but still running)
<div className={scannedCode ? 'hidden' : ''}>
  <Scanner onScanSuccess={handleScanSuccess} />
</div>
```

**Solution:**
Changed to conditional rendering (unmounting):

```tsx
// ✅ AFTER (fully stops when unmounted)
{!scannedCode && (
  <div>
    <Scanner onScanSuccess={handleScanSuccess} />
  </div>
)}
```

**Files Changed:**
- `src/pages/ScanPage.tsx` (lines 101-160 mobile, 197-255 desktop)

**Commit:** `0e4e5f1`

---

### Issue 3: Mobile Checkout Scanner Always Active

**Symptoms:**
- In checkout mode, scanner runs even when cart panel is open
- Unwanted scans while reviewing cart on mobile
- Phone vibrates during cart interaction

**Root Cause:**
Scanner was always rendered on mobile, regardless of cart state.

**Solution:**
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

**Files Changed:**
- `src/pages/CheckoutPage.tsx` (lines 518-533, 298-300)

**Commit:** `96437d2`

---

### Issue 4: Checkout Infinite Loop on Non-Existent Products

**Symptoms:**
- Scanning a product that doesn't exist in checkout causes infinite loop
- No error message shown to user
- App becomes unresponsive

**Root Cause:**
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

**Solution:**
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

**Files Changed:**
- `src/pages/CheckoutPage.tsx` (lines 301-310)

**Commit:** `0e4e5f1`

---

## PWA & Service Worker Issues

### Issue: Black Screen After Deployment (Chunk Load Failed)

**Symptoms:**
- App works locally but shows black screen in production
- Console shows "ChunkLoadError: Loading chunk X failed"
- Error: "Failed to fetch dynamically imported module"

**Root Cause:**
PWA service worker was caching old JavaScript chunks. When new code was deployed:
1. Vite created new chunk filenames (e.g., `ScanPage-XYZ789.js`)
2. Service worker still referenced old chunks (e.g., `ScanPage-ABC123.js`)
3. Browser tried to load non-existent chunks → Black screen

**Solution:**

**1. Added lazy import retry mechanism:**

```typescript
const retryLazyImport = (
  importFn: () => Promise<any>,
  retriesLeft = 3,
  interval = 1000
): Promise<any> => {
  return importFn().catch((error) => {
    if (retriesLeft === 0) {
      console.error('Chunk load failed. Reloading page...');
      window.location.reload(); // Force reload to get fresh chunks
      throw error;
    }

    console.warn(`Chunk load failed. Retrying... (${retriesLeft} left)`);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(retryLazyImport(importFn, retriesLeft - 1, interval));
      }, interval);
    });
  });
};

const ScanPage = lazy(() => retryLazyImport(() => import('./pages/ScanPage')));
```

**2. Improved PWA service worker configuration:**

```typescript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    skipWaiting: true,           // Force new SW to activate immediately
    clientsClaim: true,          // Take control of pages right away
    cleanupOutdatedCaches: true, // Remove old cached chunks
    runtimeCaching: [
      // ... cache strategies
    ]
  }
})
```

**How it works:**
- `skipWaiting: true` → New service worker activates immediately on deployment
- `clientsClaim: true` → Takes control of all pages without waiting for reload
- `cleanupOutdatedCaches: true` → Automatically removes old chunks
- Retry mechanism → If chunk still fails, retries 3 times then reloads page

**Files Changed:**
- `src/App.tsx` (lines 11-34)
- `vite.config.ts` (lines 81-86)

**Commits:** `5785aa1`, `968933d`

**Prevention:**
- Always test in production after code-split changes
- Monitor for ChunkLoadError in production logs
- Consider versioning strategy for critical apps

---

## UI/UX Issues

### Issue: Transparent Dialog Background

**Symptoms:**
- Confirmation dialog shows camera feed through background
- Dialog appears semi-transparent
- Hard to read text

**Root Cause:**
Dialog component used `bg-background` CSS variable that was never defined in `index.css`:

```tsx
// ❌ BEFORE (undefined variable)
className="... bg-background ..."
```

**Solution:**
Changed to explicit white background:

```tsx
// ✅ AFTER (solid white)
className="... bg-white border border-stone-200 ..."
```

**Files Changed:**
- `src/components/ui/dialog.tsx` (line 40)

**Commit:** `413bb9f`

---

## Architecture Improvements

### Improvement: Extracted useStockMutation Hook

**Problem:**
Stock mutation logic was duplicated in `ProductDetail.tsx` with:
- Optimistic updates
- Error handling
- Loading states
- Toast notifications

**Solution:**
Created reusable `useStockMutation` hook:

```typescript
// src/hooks/useStockMutation.ts
export const useStockMutation = (product: Product) => {
  const { handleStockChange, loadingAction, isLoading } = useStockMutation(product);

  return {
    handleStockChange,  // (quantity, type) => void
    loadingAction,      // 'IN' | 'OUT' | null
    isLoading,          // boolean
  };
};
```

**Benefits:**
- ✅ Centralized stock mutation logic
- ✅ Reusable across components
- ✅ Consistent error handling
- ✅ Better maintainability

**Files Changed:**
- Created: `src/hooks/useStockMutation.ts`
- Updated: `src/components/product/ProductDetail.tsx`

**Commit:** `968933d`

---

## Quick Reference: Deployment Checklist

Before deploying to production, verify:

### Environment Variables
- [ ] `NUXT_PUBLIC_AIRTABLE_API_KEY` is set in hosting platform
- [ ] `NUXT_PUBLIC_AIRTABLE_BASE_ID` is set in hosting platform

### CSP Headers (vercel.json)
- [ ] `connect-src` includes `https://api.airtable.com`
- [ ] `connect-src` includes `https://*.airtable.com`
- [ ] `connect-src` includes `https://world.openfoodfacts.org`
- [ ] `img-src` includes `https:` and `blob:`
- [ ] `script-src` includes `'unsafe-eval'` (for React/Vite)

### PWA Configuration (vite.config.ts)
- [ ] `skipWaiting: true` is set
- [ ] `clientsClaim: true` is set
- [ ] `cleanupOutdatedCaches: true` is set

### Testing After Deployment
- [ ] App loads without black screen
- [ ] Scanner works (no infinite loops)
- [ ] Modals open without background scanning
- [ ] Dialogs have solid backgrounds
- [ ] API calls succeed (check Network tab)
- [ ] No CSP errors in console

---

## Common Debugging Commands

### Check service worker status:
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Active service workers:', registrations);
});
```

### Clear service worker cache:
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => registration.unregister());
});
caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
```

### Force app reload with cache clear:
```javascript
// In browser console
window.location.reload(true);
```

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check browser console for errors
2. Check Network tab for failed requests
3. Look for CSP violations in console
4. Check service worker status in DevTools → Application → Service Workers
5. Review recent commits with `git log --oneline -10`
6. Search GitHub issues: https://github.com/your-repo/issues

---

**Last Updated:** 2025-12-07
**Version:** 1.0.0
