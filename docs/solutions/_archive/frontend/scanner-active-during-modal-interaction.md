---
title: Scanner Active During Modal Interaction
category: frontend
severity: HIGH
date: '2026-02-01'
tags: []
module: Unknown
related_github_issue: null
status: resolved
symptoms:
  - Scanner keeps running when product detail modal opens
  - Phone vibrates while user interacts with add/remove controls
  - Unwanted scans happen in background
  - Multiple concurrent API requests
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

