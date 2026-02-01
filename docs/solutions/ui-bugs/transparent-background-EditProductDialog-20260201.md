---
module: EditProductDialog
date: 2026-02-01
problem_type: ui_bug
component: dialog_component
symptoms:
  - Confirmation dialog shows camera feed through background
  - Dialog appears semi-transparent
  - Hard to read text
root_cause: config_error
resolution_type: code_fix
severity: high
tags: [dialog, shadcn, css, tailwind, background]
related_github_issue: null
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

- [x] Use explicit color values (bg-white) instead of CSS variables for critical UI
- [ ] Define all CSS variables in index.css before using them
- [ ] Test dialogs/modals over camera or video backgrounds
