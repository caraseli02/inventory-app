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

---

## Pattern 4: Documentation Schema Compliance

**Problem:** Bug solutions documented without proper schema cause validation failures and break searchability

**Root Cause:** Not following `docs/solutions/schema.yaml` structure - missing required YAML fields, incorrect enum values, or wrong directory placement

**Solution Pattern:**

### ❌ WRONG - Incompatible Schema
```yaml
---
title: Scanner not working
category: frontend  # ← Wrong enum
severity: HIGH      # ← Wrong format
date: 2026-02-01
tags: [scanner]
# ← Missing required fields
---
```

### ✅ CORRECT - Compound-Plugin Compatible
```yaml
---
module: ScannerComponent          # ← Component name
date: 2026-02-01                  # ← ISO format
problem_type: scanner_issue       # ← Valid enum (12 options)
component: scanner                # ← Valid enum (11 options)
symptoms:                         # ← Array (1-5 items)
  - "Scanner fails to initialize"
root_cause: missing_validation    # ← Valid enum (see schema.yaml for full list)
resolution_type: dependency_fix   # ← Valid enum (7 options)
severity: high                    # ← Lowercase (critical|high|medium|low)
tags: [html5-qrcode, initialization]  # ← Max 8 tags
related_github_issue: 42          # ← Optional
---
```

### Required Workflow

**Every bug fix MUST:**

1. **Use the template**: `cp docs/solutions/_template.md docs/solutions/[category]/[name].md`
2. **Validate schema**: Pre-commit hook runs `scripts/validate-docs.js` automatically
3. **Place in correct directory**: Based on `problem_type` enum
   - `build_error` → `build-errors/`
   - `scanner_issue` → `scanner-issues/`
   - `ui_bug` → `ui-bugs/`
   - `state_issue` → `state-issues/`
   - (see `schema.yaml` for full mapping)
4. **Reference GitHub issue**: Link to issue number if applicable
5. **Add prevention section**: Document how to avoid in future

### Validation Commands

```bash
# Validate specific file
node scripts/validate-docs.js docs/solutions/scanner-issues/your-file.md

# Search solutions
node scripts/search-solutions.js --query "scanner loop"

# Pre-commit hook validates automatically
git commit -m "docs: add solution for X"
```

### Schema Reference

See `docs/solutions/schema.yaml` for:
- **12 problem_type values**: `build_error`, `runtime_error`, `performance_issue`, `state_issue`, `api_error`, `ui_bug`, `scanner_issue`, `pwa_issue`, `integration_issue`, `logic_error`, `developer_experience`, `documentation_gap`
- **11 component values**: `react_component`, `custom_hook`, `api_client`, `scanner`, `form_component`, `dialog_component`, `page_component`, `utility`, `type_definition`, `pwa_config`, `build_config`
- **12 root_cause values**: See schema for full list
- **7 resolution_type values**: See schema for full list

**Related Solutions:**
- All solutions in `docs/solutions/` follow this pattern after 2026-02-01 migration
- See `docs/plans/2026-02-01-compound-schema-migration-plan.md` for migration details
