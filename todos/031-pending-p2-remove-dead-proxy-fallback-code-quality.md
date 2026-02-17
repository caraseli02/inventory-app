---
status: pending
priority: p2
issue_id: "031"
tags: [code-quality, duplication, cleanup, code-review]
dependencies: []
---

# Remove dead fallback path to deleted Vercel proxy

## Problem Statement

The code contains a fallback path to `/api/extract-invoice` which references the **deleted Vercel proxy**. This path will 404 in production if `VITE_INVOICE_API_URL` is not set, causing silent service unavailability.

**Medium Risk:** Production misconfiguration causes service to fail silently with 404 errors instead of helpful error messages.

## Findings

### Root Cause Analysis

**Location:** `src/lib/invoiceOCR.ts:368-373`

**Current implementation:**
```typescript
// Call FastAPI directly (no proxy)
const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;
const extractUrl = apiUrl
  ? `${apiUrl.replace(/\/$/, '')}/extract`
  : import.meta.env.DEV
    ? 'http://localhost:8000/extract'
    : '/api/extract-invoice'; // ← DELETED proxy, will 404!
```

**Why this exists:**
- Plan document mentions: "Fallback during transition"
- Intended to provide backward compatibility during migration
- Proxy file `api/extract-invoice.ts` was deleted in this refactor

**What happens if fallback triggers:**
1. `VITE_INVOICE_API_URL` not set in production env vars
2. Code falls back to `/api/extract-invoice`
3. Browser makes request to `https://lavio.vercel.app/api/extract-invoice`
4. Vercel returns **404 Not Found** (proxy deleted)
5. XMLHttpRequest fails with `Upload failed` error
6. User sees: "Network error while processing invoice"

### Impact Assessment

| Scenario | Impact | Severity | Likelihood |
|----------|--------|----------|
| Production env var missing | Service unavailable | 🟠 High | Low |
| Staging env var missing | Service unavailable | 🟡 Medium | Medium |
| Dev env var not set | Fallback to localhost (works) | 🟢 Low | High |

**Overall Risk:** Medium - Low likelihood but high impact when it occurs

### Git History Analysis

**Commit: `130fc98` - "fix(security): move invoice OCR auth to server-side proxy"**
- This commit **added** the proxy
- Proxy was security fix for API key exposure
- Valid from Feb 10, 2026 to present

**Current Refactor:**
- Proxy deleted in current changes
- Fallback path left in code
- Inconsistent state: proxy deleted but fallback remains

## Proposed Solutions

### Solution 1: Remove Fallback Entirely ✅ RECOMMENDED

**Approach:** Delete the `/api/extract-invoice` fallback and require `VITE_INVOICE_API_URL` to be set.

**Implementation:**
```typescript
// src/lib/invoiceOCR.ts:368-371

// Before (current):
const extractUrl = apiUrl
  ? `${apiUrl.replace(/\/$/, '')}/extract`
  : import.meta.env.DEV
    ? 'http://localhost:8000/extract'
    : '/api/extract-invoice'; // ← Dead fallback

// After (recommended):
if (!apiUrl && !import.meta.env.DEV) {
  logger.error('VITE_INVOICE_API_URL not configured', {
    env: import.meta.env.DEV ? 'development' : 'production',
  });
  return {
    success: false,
    error: 'Invoice service not configured. Please contact support.',
  };
}

const extractUrl = apiUrl
  ? `${apiUrl.replace(/\/$/, '')}/extract`
  : 'http://localhost:8000/extract'; // Dev only
```

**Same fix in `src/lib/invoiceImportApi.ts`:**
```typescript
// src/lib/invoiceImportApi.ts:45-54

function getInvoiceApiBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;

  if (!apiUrl) {
    if (import.meta.env.DEV) {
      logger.warn('VITE_INVOICE_API_URL not set, using localhost:8000');
      return 'http://localhost:8000';
    }
    
    logger.error('VITE_INVOICE_API_URL not configured in production');
    throw new Error('Invoice service not configured. Please contact support.');
  }

  return apiUrl.replace(/\/$/, '');
}
```

**Pros:**
- ✅ Removes dead code entirely
- ✅ Fail-fast with clear error message
- ✅ Forces proper configuration
- ✅ Production doesn't silently fail with 404
- ✅ Simpler code (no ternary chain)

**Cons:**
- ❌ Requires `VITE_INVOICE_API_URL` in production (but should be set anyway)
- ❌ Dev must set env var or use localhost (but that's reasonable)

**Effort:** 15 minutes (update 2 files)
**Risk:** Low (just removes dead code)

---

### Solution 2: Keep Fallback with Better Error Handling ⚠️ NOT RECOMMENDED

**Approach:** Keep fallback path but add check to verify proxy endpoint exists.

**Implementation:**
```typescript
const extractUrl = apiUrl
  ? `${apiUrl.replace(/\/$/, '')}/extract`
  : '/api/extract-invoice';

// Verify proxy exists before using
if (extractUrl === '/api/extract-invoice') {
  const healthCheck = await fetch('/api/extract-invoice', { method: 'HEAD' });
  if (!healthCheck.ok) {
    logger.error('Proxy endpoint does not exist');
    return {
      success: false,
      error: 'Invoice service not configured. Please contact support.',
    };
  }
}
```

**Pros:**
- ✅ Provides graceful degradation
- ✅ Checks if proxy exists before use

**Cons:**
- ❌ Adds network overhead (HEAD request)
- ❌ Still has dead code path
- ❌ More complex
- ❌ Doesn't fix root cause (fallback should be removed)

**Effort:** 30 minutes (add health check)
**Risk:** Medium (adds complexity without solving root issue)

---

### Solution 3: Add CI/CD Validation for Env Vars ⚠️ PARTIAL MITIGATION

**Approach:** Add CI/CD check to ensure `VITE_INVOICE_API_URL` is set before deployment.

**Implementation:**
```yaml
# .github/workflows/deploy-client.yml
- name: Validate Environment Variables
  run: |
    if [ -z "$VITE_INVOICE_API_URL" ]; then
      echo "ERROR: VITE_INVOICE_API_URL must be set!"
      echo "Add it to Vercel dashboard → Settings → Environment Variables"
      exit 1
    fi
    
    # Verify it's a valid URL
    if [[ ! "$VITE_INVOICE_API_URL" =~ ^https?:// ]]; then
      echo "ERROR: VITE_INVOICE_API_URL must be a valid URL"
      exit 1
    fi
    
    echo "✅ VITE_INVOICE_API_URL configured: $VITE_INVOICE_API_URL"
```

**Pros:**
- ✅ Prevents production misconfiguration
- ✅ Catches missing env vars before deployment
- ✅ Automated validation

**Cons:**
- ❌ Doesn't remove dead fallback code
- ❌ Doesn't fix runtime misconfiguration (env var deleted after deploy)
- ❌ Only works during CI/CD, not at runtime

**Effort:** 10 minutes (add CI/CD check)
**Risk:** Medium (partial solution)

## Recommended Action

**Choose Solution 1: Remove Fallback Entirely**

**Rationale:**
- Removes dead code (YAGNI principle)
- Fail-fast with clear error message
- Forces proper configuration in production
- Simpler code (no ternary chain)
- Minimal effort for maximum benefit
- Aligns with refactoring goals (eliminate proxy)

**Execution Plan:**
1. Update `src/lib/invoiceOCR.ts` to remove fallback and add validation
2. Update `src/lib/invoiceImportApi.ts` to remove fallback and add validation
3. Test locally:
   - Without env var → clear error message
   - With env var → works correctly
4. Add CI/CD validation (Solution 3 as complementary check)
5. Update `.env.example` to make `VITE_INVOICE_API_URL` required
6. Deploy to staging
7. Test staging with missing env var → clear error
8. Deploy to production

**DO NOT CHOOSE** Solution 2 - Health check adds complexity without solving root issue.

## Acceptance Criteria

- [ ] `/api/extract-invoice` fallback removed from `invoiceOCR.ts`
- [ ] `/api/extract-invoice` fallback removed from `invoiceImportApi.ts`
- [ ] Production: Missing `VITE_INVOICE_API_URL` → clear error message
- [ ] Development: Missing `VITE_INVOICE_API_URL` → localhost:8000 with warning log
- [ ] Error message is actionable ("Invoice service not configured. Please contact support.")
- [ ] CI/CD validation added to `.github/workflows/deploy-client.yml`
- [ ] CI/CD rejects deployment without `VITE_INVOICE_API_URL`
- [ ] `.env.example` updated to mark `VITE_INVOICE_API_URL` as required
- [ ] Local testing completed (with and without env var)
- [ ] Staging testing completed
- [ ] Production deployment verified

## Work Log

### 2026-02-17 - Code Review Discovery

**By:** Claude Code (Security Sentinel + Code Simplicity Reviewer Agents)

**Actions:**
- Reviewed `invoiceOCR.ts` for fallback paths
- Identified dead fallback to deleted proxy
- Analyzed git history (proxy added in commit 130fc98)
- Created removal plan with validation
- Added CI/CD validation as complementary check

**Learnings:**
- Dead fallback paths cause silent failures
- Fail-fast is better than silent degradation
- CI/CD validation prevents misconfiguration
- Simple code is easier to maintain
- YAGNI principle: remove unnecessary features

**Next Steps:**
- Remove fallback from both files
- Add validation logic
- Implement CI/CD check
- Test all scenarios

## Technical Details

**Affected Files:**
- `src/lib/invoiceOCR.ts:368-373` - Remove fallback
- `src/lib/invoiceImportApi.ts:45-54` - Remove fallback
- `.github/workflows/deploy-client.yml` - Add env var validation (NEW)
- `.env.example` - Mark `VITE_INVOICE_API_URL` as required

**Related Components:**
- Vercel proxy (`api/extract-invoice.ts`) - DELETED
- FastAPI service - Production endpoint (no changes)

**Database Changes:**
- None

**API Changes:**
- None (client-side validation only)

## Resources

**Code Review Agents:**
- Security Sentinel: Identified dead fallback as security concern
- Code Simplicity Reviewer: Identified as unnecessary complexity
- Git History Analyzer: Confirmed proxy deletion timeline

**Related Issues:**
- Previous proxy implementation: Issue #001 (security fix)
- Rollback commit: `130fc98` - "fix(security): move invoice OCR auth to server-side proxy"

---

## Notes

- **CI/CD:** Add validation to prevent deployment without `VITE_INVOICE_API_URL`
- **Testing:** Must test both scenarios (env var present/absent)
- **Documentation:** Update `.env.example` to make env var required
- **Error Messages:** Clear, actionable, no technical jargon
