# CSP Comprehensive Visual & Console Testing Suite

This directory contains comprehensive testing resources for validating CSP (Content Security Policy) compliance and console error monitoring for the inventory app.

## Quick Start

### Option 1: Automated Playwright Testing (Recommended)

```bash
# From project root
npx playwright test --config=playwright.config.csp-test.ts --headed

# View results
npx playwright show-report test-screenshots/csp-validation/playwright-report
```

### Option 2: Manual Browser Testing

1. Start dev server: `pnpm dev`
2. Open http://localhost:5173 in Chrome/Edge
3. Open DevTools (F12)
4. Follow manual-test-guide.md step by step
5. Document results in TEST_RESULTS.md

## Files in This Directory

### Testing Resources
- **manual-test-guide.md** - Step-by-step manual testing instructions with DevTools
- **TEST_RESULTS.md** - Results template (to be filled during testing)
- **README.md** - This file

### Automated Testing (Future)
- **playwright.config.csp-test.ts** - Playwright configuration (in project root)
- **csp-comprehensive.spec.ts** - Automated test suite (to be created)

### Test Artifacts
- **screenshots/** - Screenshots from each test scenario
- **console-logs.txt** - Captured console output
- **playwright-report/** - HTML test report (after running Playwright)

## Test Scenarios Covered

### Critical CSP Validation
1. Homepage Load & Console Check
   - Google Fonts loading without CSP violations
   - Service Worker registration
   - Initial page load errors

2. Language Selector Interaction
   - Dropdown functionality
   - JavaScript errors during interaction

3. Navigation to Inventory Page
   - Supabase connection (no CSP blocks)
   - Data loading
   - Network errors

4. Invoice Upload Dialog (CRITICAL)
   - Dialog opening without CSP violations
   - File upload permissions
   - Supabase integration

5. Scanner Page Test
   - Camera permissions
   - Media-src CSP compliance
   - Scanner library initialization

6. Network Tab Monitoring
   - Font resource loading (fonts.googleapis.com, fonts.gstatic.com)
   - HTTP status codes (all 200 OK)
   - Failed requests detection

7. Service Worker Caching Test
   - SW registration and activation
   - google-fonts-cache existence
   - gstatic-fonts-cache existence
   - Workbox error checking

8. Mobile Viewport Test
   - Responsive layout
   - Mobile-specific console errors
   - Touch interactions

## What to Look For

### CSP Violations (CRITICAL)
```
Refused to load the...
Content Security Policy...
CSP violation...
```

### Network Errors
```
net::ERR_BLOCKED_BY_CLIENT
net::ERR_FAILED
Failed to fetch
NetworkError
```

### Service Worker Errors
```
no-response
workbox-strategies
registration failed
```

## Success Criteria

### PASS Conditions
- Zero CSP violations across all scenarios
- Zero console errors (excluding acceptable warnings)
- All font resources load successfully (HTTP 200)
- Service Worker active and caches populated
- No network failures

### FAIL Conditions
- Any CSP violations found
- Console errors related to blocked resources
- Failed font resource requests
- Service Worker registration failures
- Broken functionality due to policy blocks

## Reporting

After testing, update TEST_RESULTS.md with:
1. Pass/fail status for each scenario
2. Count of errors/warnings/violations
3. Specific error messages with timestamps
4. Screenshots showing before/after states
5. Final verdict: PRODUCTION READY or ISSUES FOUND

## Comparison with Pre-Fix State

### Known Issues Before CSP Fix
- Google Fonts blocked by strict CSP
- Service Worker cache-first strategy causing font loading issues
- Console errors for fonts.googleapis.com and fonts.gstatic.com

### Expected After CSP Fix
- All font resources load successfully
- No CSP violations in console
- Service Worker caches fonts properly
- Clean console with zero errors

## Next Steps

1. Run comprehensive tests using this suite
2. Document all findings in TEST_RESULTS.md
3. Save screenshots to screenshots/ directory
4. If PASS: Mark as production ready
5. If FAIL: Document specific issues and create fix tickets

## Support

For questions or issues with testing:
- Review CLAUDE.md for project context
- Check manual-test-guide.md for detailed steps
- Run Playwright tests for automated validation
- Contact project maintainer with TEST_RESULTS.md findings

