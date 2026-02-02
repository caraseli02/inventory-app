---
module: ScannerComponent
date: 2026-02-01
problem_type: scanner_issue
component: scanner
symptoms:
  - Scanner keeps running when product detail modal opens
  - Phone vibrates while user interacts with add/remove controls
  - Unwanted scans happen in background
  - Multiple concurrent API requests
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [scanner, modal, conditional-rendering, cleanup]
related_github_issue: null
commit: 0e4e5f1
---

# Problem Description
Scanner Active During Modal Interaction

# Symptoms
*   Scanner keeps running when product detail modal opens
*   Phone vibrates while user interacts with add/remove controls
*   Unwanted scans happen in background
*   Multiple concurrent API requests


# Root Cause Analysis
Scanner was hidden with CSS (`className="hidden"`) but still mounted and running:

```tsx
// ❌ BEFORE (hidden but still running)
<div className={scannedCode ? 'hidden' : ''}>
  <Scanner onScanSuccess={handleScanSuccess} />
</div>
```



# Solution
Changed to conditional rendering (unmounting):

```tsx
// ✅ AFTER (fully stops when unmounted)
{!scannedCode && (
  <div>
    <Scanner onScanSuccess={handleScanSuccess} />
  </div>
)}
```



# Files Changed
- `src/pages/ScanPage.tsx` (lines 101-160 mobile, 197-255 desktop)



# Prevention

- [x] Use conditional rendering (unmount) instead of CSS hiding for scanner (see Pattern 2 in critical-patterns.md)
- [x] Scanner component properly cleans up on unmount via useEffect return
- [ ] Document pattern in component comments for future developers
