# CSP Testing - Quick Reference Card

## 30-Second Start

```bash
# Run quick test
cd /Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/csp-validation
./quick-test.sh

# Then open browser
open http://localhost:5173
# Press F12 → Console → Look for errors
```

## Files You Need

| File | Purpose | Location |
|------|---------|----------|
| **CSP_TESTING_GUIDE.md** | Master guide | Project root |
| **manual-test-guide.md** | Step-by-step testing | csp-validation/ |
| **TEST_RESULTS.md** | Document results here | csp-validation/ |
| **quick-test.sh** | Quick validation | csp-validation/ |

## 8 Tests in 2 Minutes Each

1. Homepage → Check console errors
2. Language selector → Click and check errors
3. Inventory page → Navigate and check errors
4. Invoice dialog → Open and check errors
5. Scanner page → Open and check errors
6. Network tab → Filter "fonts" → Check status 200
7. Service Worker → Application tab → Check active
8. Mobile view → Resize to 375px → Check errors

## What to Look For

### Red Flags (FAIL)
- "Refused to load..."
- "CSP violation..."
- "net::ERR_BLOCKED_BY_CLIENT"
- Any console errors

### Green Lights (PASS)
- Zero console errors
- All fonts load (HTTP 200)
- Service Worker active
- Font caches exist

## Report Results

Update `TEST_RESULTS.md`:
- Mark each test PASS/FAIL
- Count errors
- Add screenshots
- Final verdict: PRODUCTION READY or ISSUES FOUND

## Quick Commands

```bash
# Navigate to testing directory
cd /Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/csp-validation

# Run quick test
./quick-test.sh

# View manual guide
cat manual-test-guide.md

# View results template
cat TEST_RESULTS.md

# Open application
open http://localhost:5173
```

## DevTools Shortcuts

- **F12** - Open DevTools
- **Cmd+Option+I** - Open DevTools (Mac)
- **Cmd+Shift+M** - Toggle device toolbar (mobile view)
- **Cmd+R** - Reload page
- **Cmd+Shift+R** - Hard reload (clear cache)

## Console Filters

In DevTools Console tab:
- Filter: `error` - Show only errors
- Filter: `CSP` - Show CSP violations
- Filter: `fonts` - Show font-related messages

## Network Filters

In DevTools Network tab:
- Filter: `fonts` - Show only font requests
- Check Status column - Should be 200
- Check Type column - Should be font/woff2

## Application Tab Checks

1. Click Application tab
2. Service Workers → Should show "activated and running"
3. Cache Storage → Should show:
   - google-fonts-cache
   - gstatic-fonts-cache

## Success = Zero Errors

If you see ZERO console errors and all fonts load, the test PASSES.

## Need Help?

- Full guide: `CSP_TESTING_GUIDE.md` (project root)
- Manual steps: `manual-test-guide.md` (this directory)
- Results: `TEST_RESULTS.md` (this directory)

