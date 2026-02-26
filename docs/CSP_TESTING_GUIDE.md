# CSP Comprehensive Visual Testing Guide

## Quick Reference

**Server URL**: http://localhost:5173
**Testing Directory**: `/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/csp-validation/`
**Status**: READY FOR TESTING

---

## Get Started in 30 Seconds

```bash
# Option 1: Quick validation
cd test-screenshots/csp-validation
./quick-test.sh

# Option 2: Follow manual guide
open test-screenshots/csp-validation/manual-test-guide.md
```

---

## What Was Created

### Testing Documentation (test-screenshots/csp-validation/)
1. **README.md** - Complete overview and instructions
2. **manual-test-guide.md** - Step-by-step DevTools testing
3. **TEST_RESULTS.md** - Results template to fill out
4. **TESTING_SUMMARY.md** - Implementation summary
5. **quick-test.sh** - Executable quick validation script

### Configuration Files (project root)
- **playwright.config.csp-test.ts** - Playwright test configuration

---

## Three Ways to Test

### 1. Quick Validation (5 minutes) - EASIEST

```bash
cd test-screenshots/csp-validation
./quick-test.sh
```

Then open http://localhost:5173 in Chrome and check:
- Console for errors (F12 → Console)
- Network for font loading (F12 → Network → filter "fonts")
- Service Worker status (F12 → Application → Service Workers)

### 2. Manual Comprehensive Testing (20 minutes) - RECOMMENDED

1. Open browser to http://localhost:5173
2. Open DevTools (F12)
3. Follow guide: `test-screenshots/csp-validation/manual-test-guide.md`
4. Document results in: `test-screenshots/csp-validation/TEST_RESULTS.md`
5. Save screenshots to: `test-screenshots/csp-validation/screenshots/`

### 3. Automated Playwright Testing (Future)

```bash
# Install Playwright
npx playwright install

# Run tests
npx playwright test --config=playwright.config.csp-test.ts --headed

# View report
npx playwright show-report test-screenshots/csp-validation/playwright-report
```

---

## 8 Test Scenarios

### Critical CSP Validation Tests

1. **Homepage Load & Console Check**
   - Verify Google Fonts load without CSP violations
   - Check Service Worker registration
   - Monitor initial page load errors

2. **Language Selector Interaction**
   - Test dropdown functionality
   - Monitor JavaScript errors

3. **Navigation to Inventory Page**
   - Verify Supabase connection (no CSP blocks)
   - Check data loading
   - Monitor network errors

4. **Invoice Upload Dialog** (CRITICAL)
   - Verify dialog opens without CSP violations
   - Test file upload permissions
   - Validate Supabase integration

5. **Scanner Page Test**
   - Test camera permissions
   - Verify media-src CSP compliance
   - Check scanner library initialization

6. **Network Tab Monitoring**
   - Verify fonts.googleapis.com (HTTP 200)
   - Verify fonts.gstatic.com (HTTP 200)
   - Check for blocked requests

7. **Service Worker Caching Test**
   - Verify SW is active
   - Check google-fonts-cache exists
   - Check gstatic-fonts-cache exists

8. **Mobile Viewport Test**
   - Test responsive layout
   - Check mobile-specific errors
   - Verify touch interactions

---

## What to Look For

### CRITICAL - CSP Violations
```
Refused to load...
Content Security Policy...
CSP violation...
```

### Network Errors
```
net::ERR_BLOCKED_BY_CLIENT
net::ERR_FAILED
Failed to fetch
```

### Service Worker Errors
```
no-response
workbox-strategies
registration failed
```

---

## Success Criteria

### ✅ PASS (Production Ready)
- Zero CSP violations across all scenarios
- Zero console errors
- All font resources load (HTTP 200)
- Service Worker active with font caches
- No network failures
- All features work without errors

### ❌ FAIL (Issues Found)
- Any CSP violations
- Console errors for blocked resources
- Failed font requests
- Service Worker failures
- Missing font caches
- Broken functionality

---

## How to Report Results

After testing, update `TEST_RESULTS.md` with:

1. Pass/fail status for each scenario
2. Count of errors/warnings/violations
3. Specific error messages with timestamps
4. Screenshots for each scenario
5. Overall verdict: PRODUCTION READY or ISSUES FOUND

---

## Files Reference

### Quick Access Paths
```bash
# Main testing directory
cd /Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/csp-validation/

# View manual guide
cat manual-test-guide.md

# View results template
cat TEST_RESULTS.md

# Run quick test
./quick-test.sh
```

### File Locations
- Testing Suite: `/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/csp-validation/`
- This Guide: `/Users/vladislavcaraseli/Documents/inventory-app/CSP_TESTING_GUIDE.md`
- Playwright Config: `/Users/vladislavcaraseli/Documents/inventory-app/playwright.config.csp-test.ts`
- Project Docs: `/Users/vladislavcaraseli/Documents/inventory-app/CLAUDE.md`

---

## Expected Results

### Before CSP Fix
- ❌ Google Fonts blocked by CSP
- ❌ Console errors: "Refused to load fonts.googleapis.com"
- ❌ Console errors: "Refused to load fonts.gstatic.com"
- ❌ Service Worker "no-response" errors
- ❌ Fonts fall back to system fonts

### After CSP Fix
- ✅ Google Fonts load successfully
- ✅ Zero CSP violations
- ✅ Service Worker caches fonts
- ✅ All font requests HTTP 200
- ✅ Clean console (zero errors)
- ✅ Fonts render correctly (Instrument Serif, Inter)

---

## Next Steps

1. Choose a testing method (Quick/Manual/Automated)
2. Run the tests following the appropriate guide
3. Document findings in TEST_RESULTS.md
4. Capture screenshots for all scenarios
5. Determine final verdict: PRODUCTION READY or ISSUES FOUND

---

## Support

For questions or issues:
- Review: `test-screenshots/csp-validation/README.md`
- Manual steps: `test-screenshots/csp-validation/manual-test-guide.md`
- Quick test: `test-screenshots/csp-validation/quick-test.sh`
- Project context: `CLAUDE.md`

---

## Summary

A complete CSP validation testing suite is ready with:
- ✅ Detailed manual testing guide
- ✅ Quick validation script
- ✅ Results documentation template
- ✅ 8 comprehensive test scenarios
- ✅ Clear success criteria
- ✅ Playwright infrastructure

**Status**: READY FOR TESTING
**Next Action**: Run tests and validate NO CSP violations

