# Comprehensive Visual & Console Testing Guide
## Interactive Testing with Browser DevTools

**Server**: http://localhost:5173
**Test Date**: 2025-12-18

---

## Setup Instructions

1. Open Chrome/Edge browser
2. Navigate to http://localhost:5173
3. Open DevTools (F12 or Cmd+Option+I)
4. Open these tabs:
   - **Console** (monitor errors/warnings)
   - **Network** (monitor requests)
   - **Application** → Service Workers (check caching)

---

## Test Scenarios Checklist

### 1. Homepage Load & Console Check ✓

**Steps**:
1. Navigate to http://localhost:5173
2. Wait 3 seconds for all assets to load
3. Check Console tab for errors

**Expected Results**:
- ✅ Google Fonts loaded successfully
- ✅ No CSP violations for fonts.googleapis.com
- ✅ No CSP violations for fonts.gstatic.com
- ✅ Service worker registered without errors
- ✅ No Workbox "no-response" errors

**Console Check**:
```
Filter: error
Filter: CSP
Filter: violation
```

**Screenshot**: `01-homepage.png`

---

### 2. Language Selector Interaction ✓

**Steps**:
1. Click language selector (top right)
2. Wait for dropdown to appear
3. Check Console tab
4. Select a language option
5. Check Console tab again

**Expected Results**:
- ✅ Dropdown opens without errors
- ✅ No JavaScript errors
- ✅ Language changes successfully

**Screenshot**: `02-language-dropdown.png`, `02-language-selected.png`

---

### 3. Navigation to Inventory Page ✓

**Steps**:
1. Click "Inventory Management" card
2. Wait for page load
3. Check Console tab
4. Check Network tab

**Expected Results**:
- ✅ Supabase connection works (no CSP blocks)
- ✅ Product list loads
- ✅ No network errors
- ✅ No CSP violations

**Screenshot**: `03-inventory-page.png`

---

### 4. Invoice Upload Dialog (Critical CSP Test) ✓

**Steps**:
1. On inventory page, click "Import Invoice" button
2. Wait for dialog to open
3. Check Console tab
4. Test file input interactions

**Expected Results**:
- ✅ Dialog opens without errors
- ✅ No CSP violations for Supabase
- ✅ File upload permissions work

**Screenshot**: `04-invoice-dialog.png`

---

### 5. Scanner Page Test ✓

**Steps**:
1. Navigate back to home
2. Click "Scan Product" card
3. Allow camera permissions when prompted
4. Check Console tab

**Expected Results**:
- ✅ Camera access works
- ✅ No CSP violations for media-src
- ✅ No scanner library errors

**Screenshot**: `05-scanner-page.png`

---

### 6. Network Tab Monitoring ✓

**Steps**:
1. Open Network tab in DevTools
2. Reload the page (Cmd+R)
3. Filter by "fonts"
4. Check status codes

**Expected Results**:
- ✅ fonts.googleapis.com: Status 200 (not blocked)
- ✅ fonts.gstatic.com: Status 200 (not blocked)
- ✅ Supabase domains: Allowed if used
- ✅ No failed requests due to CSP

**Network Requests to Check**:
```
fonts.googleapis.com/css2?family=...
fonts.gstatic.com/s/...woff2
supabase.co (if applicable)
```

---

### 7. Service Worker Caching Test ✓

**Steps**:
1. Open Application tab → Service Workers
2. Check service worker status
3. Click on "Cache Storage"
4. Verify caches exist

**Expected Results**:
- ✅ Service Worker: Active and running
- ✅ google-fonts-cache exists
- ✅ gstatic-fonts-cache exists
- ✅ No cache errors

**Service Worker Console**:
- Look for registration messages
- Check for Workbox messages

---

### 8. Mobile Viewport Test ✓

**Steps**:
1. Open Device Toolbar (Cmd+Shift+M)
2. Set to iPhone SE (375x667)
3. Navigate through all pages
4. Check Console on each page

**Pages to Test**:
- Homepage
- Inventory Management
- Scanner Page

**Expected Results**:
- ✅ Responsive layout works
- ✅ No console errors on mobile
- ✅ Touch interactions work

**Screenshots**: `08-mobile-homepage.png`, `08-mobile-inventory.png`

---

## Console Monitoring Checklist

For EVERY step above, check for:

### Error Types:
- [ ] CSP violation messages
- [ ] Network errors (net::ERR_*)
- [ ] JavaScript runtime errors
- [ ] Service worker errors
- [ ] Fetch API failures

### Specific CSP Checks:
```javascript
// In Console, run:
console.log('CSP violations:', window.__cspViolations || 'none');

// Check for blocked resources:
performance.getEntriesByType('resource').filter(r => r.name.includes('fonts'))
```

---

## Report Format

For each test scenario:

```
### [Scenario Name]
**Status**: ✅ PASS / ❌ FAIL
**Console Errors**: [count] - [list if any]
**Console Warnings**: [count] - [list if any]
**CSP Violations**: ✅ NONE / ❌ [details]
**Network Issues**: ✅ NONE / ❌ [details]
**Additional Notes**: [observations]
```

---

## Final Summary Template

```
===========================================
COMPREHENSIVE TEST RESULTS
===========================================

Total Tests Run: 8
Tests Passed: ___
Tests Failed: ___

Console Errors Across All Tests: ___
CSP Violations Found: ___
Network Failures: ___

===========================================
ERROR DETAILS (if any)
===========================================

[List all errors with timestamps and context]

===========================================
COMPARISON WITH PRE-FIX STATE
===========================================

Before Fix:
- CSP Violations: [count]
- Console Errors: [count]

After Fix:
- CSP Violations: [count]
- Console Errors: [count]

===========================================
OVERALL VERDICT
===========================================

✅ PRODUCTION READY - All tests pass, no CSP violations
❌ ISSUES FOUND - [describe issues]

===========================================
```

---

## Quick Console Commands

### Check for CSP violations:
```javascript
// Run in browser console
console.log('All errors:', performance.getEntriesByType('navigation'));
console.log('Font resources:', performance.getEntriesByType('resource').filter(r => r.name.includes('font')));
```

### Check Service Worker:
```javascript
navigator.serviceWorker.ready.then(reg => {
  console.log('SW Active:', reg.active);
  console.log('SW State:', reg.active.state);
});

caches.keys().then(keys => {
  console.log('Cache names:', keys);
});
```

### Check Network Errors:
```javascript
// Monitor fetch errors
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});
```

---

## Automated Testing Alternative

To run automated tests with Playwright:

```bash
# Install Playwright (if not installed)
npm install -D @playwright/test

# Run tests
npx playwright test test-screenshots/csp-validation/comprehensive-test.js --headed

# View report
npx playwright show-report
```

