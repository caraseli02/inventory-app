---
module: ComponentName
date: 2026-02-01
problem_type: ui_bug
component: react_component
symptoms:
  - "Observable symptom 1"
  - "Observable symptom 2"
root_cause: dependency_array
resolution_type: code_fix
severity: high
tags: [keyword1, keyword2]
related_github_issue: null
commit: null
---

# Problem Description

Brief description of the issue. What went wrong? What was the impact?

# Symptoms

- List observable behaviors
- Error messages (if any)
- Steps to reproduce

# Root Cause Analysis

Why did this happen? Technical details of the failure.

```typescript
// ❌ BEFORE - The problematic code
```

# Solution

Step-by-step explanation of the fix.

```typescript
// ✅ AFTER - The fixed code
```

# Files Changed

- `src/path/to/file.tsx` (lines X-Y)

# Prevention

How do we ensure this doesn't happen again?

- [ ] Added unit test for this scenario
- [ ] Updated linting rules
- [ ] Added to critical patterns
