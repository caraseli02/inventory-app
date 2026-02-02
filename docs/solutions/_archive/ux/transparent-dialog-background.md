---
title: Transparent Dialog Background
category: ux
severity: HIGH
date: '2026-02-01'
tags: []
module: Unknown
related_github_issue: null
status: resolved
symptoms:
  - Confirmation dialog shows camera feed through background
  - Dialog appears semi-transparent
  - Hard to read text
commit: 413bb9f
---

# Problem Description
Transparent Dialog Background

# Symptoms
*   Confirmation dialog shows camera feed through background
*   Dialog appears semi-transparent
*   Hard to read text


# Root Cause Analysis
Dialog component used `bg-background` CSS variable that was never defined in `index.css`:

```tsx
// ❌ BEFORE (undefined variable)
className="... bg-background ..."
```



# Solution
Changed to explicit white background:

```tsx
// ✅ AFTER (solid white)
className="... bg-white border border-stone-200 ..."
```



# Files Changed
- `src/components/ui/dialog.tsx` (line 40)



# Prevention

