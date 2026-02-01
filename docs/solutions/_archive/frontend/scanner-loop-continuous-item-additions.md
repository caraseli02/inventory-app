---
title: Scanner Loop (Continuous Item Additions)
category: frontend
severity: HIGH
date: '2026-02-01'
tags: []
module: Unknown
related_github_issue: null
status: resolved
symptoms:
  - Scanning a barcode once adds item multiple times
  - Phone vibrates continuously when barcode stays in view
  - Multiple API requests sent for same barcode
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

