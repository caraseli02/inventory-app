---
status: pending
priority: p2
issue_id: "032"
tags: [code-quality, duplication, dry, code-review]
dependencies: []
---

# Create shared invoice API utility to eliminate duplicate code

## Problem Statement

URL construction logic, token retrieval, and auth header building are **duplicated** in `invoiceImportApi.ts` and `invoiceOCR.ts`. This violates the DRY (Don't Repeat Yourself) principle, makes maintenance harder, and increases bug risk.

**Medium Risk:** Bug fixes must be made in 2 places, increasing chance of inconsistent fixes and missing updates.

## Findings

### Root Cause Analysis

**Location:**
- `src/lib/invoiceImportApi.ts:45-78` - Duplicated logic
- `src/lib/invoiceOCR.ts:343-383` - Duplicated logic

**Duplicate Logic #1: URL Construction**

**invoiceImportApi.ts:**
```typescript
function getInvoiceApiBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;
  if (apiUrl) {
    return apiUrl.replace(/\/$/, '');
  }
  return import.meta.env.DEV ? 'http://localhost:8000' : '/api';
}
```

**invoiceOCR.ts:**
```typescript
const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;
const extractUrl = apiUrl
  ? `${apiUrl.replace(/\/$/, '')}/extract`
  : import.meta.env.DEV
    ? 'http://localhost:8000/extract'
    : '/api/extract-invoice';
```

**Issue:** Same URL construction logic in 2 places with slight variation.

---

**Duplicate Logic #2: Token Retrieval**

**invoiceImportApi.ts:**
```typescript
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;

if (!token) {
  throw new Error('Authentication required. Please sign in to preview pricing.');
}

headers.Authorization = `Bearer ${token}`;
```

**invoiceOCR.ts:**
```typescript
const { data } = await supabase.auth.getSession();
token = data.session?.access_token;

if (!token) {
  return {
    success: false,
    error: 'Authentication required. Please sign in to process invoices.',
  };
}

// Later...
headers.Authorization = `Bearer ${token}`;
```

**Issue:** Same token retrieval and validation in 2 places.

---

**Duplicate Logic #3: Dev API Key**

**invoiceImportApi.ts:**
```typescript
if (import.meta.env.DEV && import.meta.env.VITE_DEV_INVOICE_API_KEY) {
  headers['X-API-Key'] = import.meta.env.VITE_DEV_INVOICE_API_KEY;
}
```

**invoiceOCR.ts:**
```typescript
if (import.meta.env.DEV && import.meta.env.VITE_DEV_INVOICE_API_KEY) {
  headers['X-API-Key'] = import.meta.env.VITE_DEV_INVOICE_API_KEY;
}
```

**Issue:** Same dev API key logic in 2 places.

### Impact Assessment

| Impact | Severity | Likelihood |
|--------|----------|------------|
| Bug fixes duplicated | 🟡 Medium | High |
| Inconsistent fixes across files | 🟡 Medium | Medium |
| Missing update in one file | 🟡 Medium | Medium |
| Increased code complexity | 🟢 Low | High |
| Harder to maintain | 🟡 Medium | High |

**Overall Risk:** Medium - High likelihood of bugs from inconsistent updates

### Code Metrics

**Current State:**
- `invoiceImportApi.ts`: 96 lines
- `invoiceOCR.ts`: 668 lines
- Duplicated code: ~30 lines across 2 files
- Duplication percentage: ~4%

**After Shared Utility:**
- `invoiceApiShared.ts`: ~50 lines (NEW)
- `invoiceImportApi.ts`: ~60 lines (-36 lines)
- `invoiceOCR.ts`: ~630 lines (-38 lines)
- Total net reduction: ~24 lines

## Proposed Solutions

### Solution 1: Create Shared Invoice API Utility ✅ RECOMMENDED

**Approach:** Create `src/lib/invoiceApiShared.ts` with shared URL, token, and auth header functions.

**Implementation:**

**New file: `src/lib/invoiceApiShared.ts`**
```typescript
import { supabase } from './supabase';
import { logger } from './logger';

/**
 * Get FastAPI base URL from environment variables.
 * Throws error if not configured in production.
 */
export function getInvoiceApiBaseUrl(): string {
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

/**
 * Get authenticated headers for FastAPI requests.
 * Retrieves fresh Supabase token and adds dev API key if configured.
 */
export async function getInvoiceAuthHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  
  if (!token) {
    logger.error('No Supabase session found');
    throw new Error('Authentication required. Please sign in to use invoice features.');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
  
  // Dev-only API key for testing
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_INVOICE_API_KEY) {
    headers['X-API-Key'] = import.meta.env.VITE_DEV_INVOICE_API_KEY;
  }
  
  return headers;
}

/**
 * Get extract URL for invoice OCR endpoint.
 */
export function getExtractUrl(): string {
  const baseUrl = getInvoiceApiBaseUrl();
  return `${baseUrl}/extract`;
}

/**
 * Get preview pricing URL for invoice pricing endpoint.
 */
export function getPreviewPricingUrl(): string {
  const baseUrl = getInvoiceApiBaseUrl();
  return `${baseUrl}/invoice/preview-pricing`;
}
```

**Update `src/lib/invoiceImportApi.ts`:**
```typescript
- import { supabase } from './supabase';
+ import { getInvoiceAuthHeaders, getPreviewPricingUrl } from './invoiceApiShared';

export async function previewInvoicePricing(
  payload: PreviewPricingRequest
): Promise<PreviewPricingResponse> {
-  const baseUrl = getInvoiceApiBaseUrl();
-  const response = await fetch(`${baseUrl}/invoice/preview-pricing`, {
+  const response = await fetch(getPreviewPricingUrl(), {
    method: 'POST',
-   headers: await getAuthHeaders(),
+   headers: await getInvoiceAuthHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`Preview pricing failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json() as Promise<PreviewPricingResponse>;
}
```

**Update `src/lib/invoiceOCR.ts`:**
```typescript
- import { logger } from './logger';
- import { supabase } from './supabase';
+ import { logger } from './logger';
+ import { getInvoiceAuthHeaders, getExtractUrl } from './invoiceApiShared';

export async function extractInvoiceData(
  file: File,
  onProgress?: (progress: number) => void
): Promise<InvoiceOCRResult> {
  ...
  
  // Get Supabase session token - authentication is now required
  let token: string | undefined;
  try {
-   const { data } = await supabase.auth.getSession();
-   token = data.session?.access_token;
+   token = await getInvoiceAuthHeaders();
+   // Note: getInvoiceAuthHeaders throws if no token
  } catch (error) {
    logger.error('Failed to get Supabase session', {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: 'Authentication required. Please sign in to process invoices.',
    };
  }
  
  if (!token) {
    logger.error('No Supabase session - authentication required', {
      fileName: file.name,
    });
    return {
      success: false,
      error: 'Authentication required. Please sign in to process invoices.',
    };
  }
  
- // Call FastAPI directly (no proxy)
- const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;
- const extractUrl = apiUrl
-   ? `${apiUrl.replace(/\/$/, '')}/extract`
-   : import.meta.env.DEV
-     ? 'http://localhost:8000/extract'
-     : '/api/extract-invoice';
+ // Call FastAPI directly (no proxy)
+ const extractUrl = getExtractUrl();
  
  // Send only Bearer token (no API keys in production)
- const headers: Record<string, string> = {
-   Authorization: `Bearer ${token}`,
- };
- 
- // Optional: Dev-only API key for local testing
- if (import.meta.env.DEV && import.meta.env.VITE_DEV_INVOICE_API_KEY) {
-   headers['X-API-Key'] = import.meta.env.VITE_DEV_INVOICE_API_KEY;
- }
+ const headers = await getInvoiceAuthHeaders();
  ...
}
```

**Pros:**
- ✅ Removes ~24 lines of duplicate code
- ✅ Single source of truth for invoice API logic
- ✅ Bug fixes only needed in one place
- ✅ Easier to maintain and test
- ✅ Clearer code with named functions
- ✅ Follows DRY principle
- ✅ Improves code organization

**Cons:**
- ❌ Adds new file (`invoiceApiShared.ts`)
- ❌ Requires updating 2 existing files

**Effort:** 2-3 hours (create utility + update both files + tests)
**Risk:** Low (standard refactoring pattern)

---

### Solution 2: Consolidate in invoiceOCR.ts Only ⚠️ NOT RECOMMENDED

**Approach:** Move all shared logic to `invoiceOCR.ts` and import from there.

**Implementation:**
- Move `getInvoiceApiBaseUrl()` to `invoiceOCR.ts`
- Move `getAuthHeaders()` to `invoiceOCR.ts`
- Update `invoiceImportApi.ts` to import from `invoiceOCR.ts`

**Pros:**
- ✅ Removes duplication
- ✅ No new file added

**Cons:**
- ❌ Tight coupling (`invoiceImportApi` depends on `invoiceOCR`)
- ❌ Unnatural dependency (pricing depends on OCR?)
- ❌ Violates separation of concerns
- ❌ Circular import risk if `invoiceOCR` needs `invoiceImportApi`

**Effort:** 1-2 hours
**Risk:** Medium (poor architecture)

---

### Solution 3: Leave Duplication ⚠️ NOT RECOMMENDED

**Approach:** Keep duplicate code as-is.

**Pros:**
- ✅ No refactoring effort

**Cons:**
- ❌ Violates DRY principle
- ❌ Bug fixes must be in 2 places
- ❌ Harder to maintain
- ❌ Increases technical debt

**Effort:** 0 hours
**Risk:** High (future bugs guaranteed)

## Recommended Action

**Choose Solution 1: Create Shared Invoice API Utility**

**Rationale:**
- Removes ~24 lines of duplicate code
- Single source of truth for invoice API logic
- Easier to maintain and test
- Follows DRY principle
- Clearer code organization
- Minimal effort for maximum benefit
- No architectural concerns (natural shared utility)

**Execution Plan:**
1. Create `src/lib/invoiceApiShared.ts` with shared functions
2. Write unit tests for shared utility:
   - URL construction with/without env var
   - Auth headers with valid token
   - Auth headers without token (throws)
   - Dev API key addition
3. Update `src/lib/invoiceImportApi.ts` to use shared utility
4. Update `src/lib/invoiceOCR.ts` to use shared utility
5. Run existing unit tests (should still pass)
6. Add integration tests for shared utility
7. Test locally with dev FastAPI
8. Deploy to staging
9. Deploy to production

**DO NOT CHOOSE** Solution 2 - Creates poor architectural coupling.

## Acceptance Criteria

- [ ] `src/lib/invoiceApiShared.ts` created
- [ ] `getInvoiceApiBaseUrl()` function implemented
- [ ] `getInvoiceAuthHeaders()` function implemented
- [ ] `getExtractUrl()` function implemented
- [ ] `getPreviewPricingUrl()` function implemented
- [ ] `src/lib/invoiceImportApi.ts` updated to import from shared utility
- [ ] `src/lib/invoiceOCR.ts` updated to import from shared utility
- [ ] Duplicate URL construction removed from both files
- [ ] Duplicate token retrieval removed from both files
- [ ] Duplicate dev API key logic removed from both files
- [ ] ~24 lines of duplicate code removed
- [ ] Unit tests written for shared utility
- [ ] Existing unit tests still pass
- [ ] Integration tests added for shared utility
- [ ] Local testing completed
- [ ] Staging testing completed
- [ ] Production deployment verified

## Work Log

### 2026-02-17 - Code Review Discovery

**By:** Claude Code (Code Simplicity Reviewer Agent)

**Actions:**
- Reviewed both files for duplicate code
- Identified 3 areas of duplication (URL, token, dev API key)
- Measured code duplication impact (~24 lines, 4%)
- Created shared utility implementation plan
- Designed function signatures for reusability

**Learnings:**
- DRY principle reduces bug risk
- Single source of truth easier to maintain
- Shared utilities improve code organization
- Duplicate code costs more in long run (bug fixes × 2 files)
- Refactoring now prevents future technical debt

**Next Steps:**
- Implement shared utility
- Update both files to use it
- Write comprehensive tests
- Verify existing tests still pass

## Technical Details

**Affected Files:**
- `src/lib/invoiceImportApi.ts:45-78` - Remove duplication
- `src/lib/invoiceOCR.ts:343-383` - Remove duplication
- `src/lib/invoiceApiShared.ts` - NEW FILE (shared utility)
- `tests/unit/lib/invoiceApiShared.test.ts` - NEW FILE (unit tests)

**Related Components:**
- Supabase SDK (`@supabase/supabase-js`) - Auth token management
- FastAPI service - API endpoints (no changes)

**Database Changes:**
- None

**API Changes:**
- None (client-side refactoring only)

## Resources

**Code Review Agents:**
- Code Simplicity Reviewer: Identified duplication and recommended shared utility
- Git History Analyzer: No previous shared utility pattern

**Related Issues:**
- Token refresh (Issue #029) - Will also use shared utility

**Refactoring Principles:**
- DRY: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
- Clean Code: https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882

---

## Notes

- **Test Coverage:** Must write tests for new shared utility
- **Backward Compatibility:** Ensure existing tests still pass
- **Future Extensions:** Shared utility makes it easy to add new invoice API functions
- **Code Organization:** Grouping invoice API logic together improves maintainability
