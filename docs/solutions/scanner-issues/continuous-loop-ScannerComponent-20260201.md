---
module: ScannerComponent
date: 2026-02-01
problem_type: scanner_issue
component: scanner
symptoms:
  - Scanning a barcode once adds item multiple times
  - Phone vibrates continuously when barcode stays in view
  - Multiple API requests sent for same barcode
root_cause: dependency_array
resolution_type: code_fix
severity: high
tags: [scanner, useEffect, dependency-array, debounce, ref-pattern]
related_github_issue: null
commit: 968933d
---

# Problem Description
Scanner Loop (Continuous Item Additions)

# Symptoms
*   Scanning a barcode once adds item multiple times
*   Phone vibrates continuously when barcode stays in view
*   Multiple API requests sent for same barcode


# Root Cause Analysis
Scanner component restarted on every render due to `onScanSuccess` callback in `useEffect` dependencies:

```typescript
// ❌ BEFORE
useEffect(() => {
  // Scanner initialization
}, [onScanSuccess]); // Callback changes on every render
```



# Solution
1. Use ref-based callback pattern to prevent restarts
2. Add 2-second debounce for duplicate scans

```typescript
// ✅ AFTER
const onScanSuccessRef = useRef(onScanSuccess);
const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);

useEffect(() => {
  onScanSuccessRef.current = onScanSuccess;
}, [onScanSuccess]);

useEffect(() => {
  // Scanner with debounce
  scanner.start(
    { facingMode: 'environment' },
    config,
    (decodedText) => {
      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.code === decodedText &&
        now - lastScanRef.current.timestamp < 2000
      ) {
        return; // Ignore duplicate
      }
      lastScanRef.current = { code: decodedText, timestamp: now };
      onScanSuccessRef.current(decodedText);
    }
  );
}, [regionId]); // Only restart on region change
```



# Files Changed
- `src/components/scanner/Scanner.tsx` (lines 13-93)



# Prevention

- [x] Use ref-based callback pattern for scanner callbacks (see Pattern 1 in critical-patterns.md)
- [x] Add debounce to prevent duplicate scans within 2 seconds
- [ ] Consider adding ESLint rule to warn about callback functions in useEffect dependencies
