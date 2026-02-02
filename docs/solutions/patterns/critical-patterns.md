# Critical Patterns

Patterns that must be followed to avoid recurring issues. These are extracted from solved problems that occurred multiple times or had significant impact.

---

## Pattern 1: Scanner Callback Stability

**Problem:** Scanner loops continuously when callback changes on every render

**Root Cause:** `onScanSuccess` in useEffect dependencies causes restart on every render

**Solution Pattern:**
```typescript
// ❌ WRONG
useEffect(() => {
  scanner.start(onScanSuccess);
}, [onScanSuccess]); // Restarts every render!

// ✅ CORRECT
const callbackRef = useRef(onScanSuccess);
useEffect(() => { callbackRef.current = onScanSuccess; }, [onScanSuccess]);
useEffect(() => {
  scanner.start((code) => callbackRef.current(code));
}, []); // Stable - never restarts
```

**Related Solutions:**
- `docs/solutions/scanner-issues/continuous-loop-ScannerComponent-20260201.md`
- `docs/solutions/scanner-issues/modal-interference-ScannerComponent-20260201.md`

---

## Pattern 2: Modal Scanner Cleanup

**Problem:** Scanner stays active when modal opens, causing interference

**Solution Pattern:**
```typescript
// ❌ WRONG
<Dialog open={isOpen}>
  {/* Scanner still running in background */}
</Dialog>

// ✅ CORRECT
useEffect(() => {
  if (isModalOpen) {
    scanner.pause();
    return () => scanner.resume();
  }
}, [isModalOpen]);
```

**Related Solutions:**
- `docs/solutions/scanner-issues/modal-interference-ScannerComponent-20260201.md`
- `docs/solutions/scanner-issues/always-active-CheckoutPage-20260201.md`

---

## Pattern 3: CSP for Production Builds

**Problem:** App shows black screen in production due to CSP violations

**Solution Pattern:**
```
# vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        }
      ]
    }
  ]
}
```

**Related Solutions:**
- `docs/solutions/build-errors/csp-black-screen-Vercel-20260201.md`
