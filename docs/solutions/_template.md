---
title: Short Descriptive Title (e.g., Scanner Infinite Loop Fix)
category: frontend # [frontend, backend, infrastructure, security, ux]
severity: HIGH # [HIGH, MEDIUM, LOW]
date: 2026-02-01 # YYYY-MM-DD
tags: [scanner, camera, performance, bugfix]
module: ScannerComponent # Component or module name
related_github_issue: 123 # Issue ID (integer) or null
status: resolved # [resolved, deprecated]
symptoms:
  - "Scanner does not stop after successful scan"
  - "Camera preview freezes"
commit: "a1b2c3d" # Optional: Git commit hash of the fix
---

# Problem Description
Brief description of the issue. What went wrong? What was the impact?

# Symptoms
*   List observable behaviors
*   Error messages (if any)
*   Steps to reproduce

# Root Cause Analysis
Why did this happen? Technical details of the failure.
*   "The generic `useEffect` dependency array was missing `isScanning`..."

# Solution
Step-by-step explanation of the fix.
1.  Added guard clause to scanner logic.
2.  Updated state management for `isScanning`.

# Files Changed
*   `src/components/Scanner.tsx`: Fixed dependency array.
*   `src/hooks/useCamera.ts`: Added debounce.

# Prevention
How do we ensure this doesn't happen again?
*   [ ] Added unit test for this scenario.
*   [ ] Updated linter rule.
