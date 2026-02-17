---
status: pending
priority: p2
issue_id: "036"
tags: [authentication, mvp, feature-complete]
dependencies: []
---

# Remove authentication requirement from invoice feature - use anonymous access

## Problem Statement

Invoice feature currently requires Supabase JWT authentication (`Authorization: Bearer {token}`), blocking all users without authentication. For MVP, we want to **remove authentication requirement entirely** and allow anonymous invoice uploads.

**Decision:** Skip auth setup for now, make invoice work anonymously.

## Findings

### Current Auth Requirements

**Client Side (to be removed):**

`src/lib/invoiceOCR.ts` (lines 342-365):
```typescript
// Auth check - TO BE REMOVED
const { data } = await supabase.auth.getSession();
token = data.session?.access_token;

if (!token) {
  return {
    success: false,
    error: 'Authentication required. Please sign in to process invoices.',
  };
}

// Send Bearer token - TO BE REMOVED
headers.Authorization = `Bearer ${token}`;
```

`src/lib/invoiceImportApi.ts` (lines 56-78):
```typescript
// Auth check - TO BE REMOVED
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;

if (!token) {
  throw new Error('Authentication required. Please sign in to preview pricing.');
}

// Send Bearer token - TO BE REMOVED
headers.Authorization = `Bearer ${token}`;
```

**Server Side (to be updated):**

FastAPI endpoints require JWT:
- `/extract` - Has `Depends(verify_supabase_jwt)` 
- `/invoice/preview-pricing` - Has `Depends(verify_supabase_jwt)`

### Impact Assessment

| Impact | Severity | Likelihood |
|--------|----------|------------|
| Users can't use invoice | 🔴 Critical | Certain (100%) |
| MVP blocked on auth | 🔴 Critical | Certain (100%) |

**Current State:** Feature is **completely non-functional** due to auth requirement.

## Proposed Solutions

### Solution 1: Remove Auth from Client + FastAPI ✅ RECOMMENDED

**Approach:** Remove all authentication checks from client and make FastAPI endpoints accept anonymous requests.

**Client Changes:**

**Update `src/lib/invoiceOCR.ts`:**
```diff
- import { logger } from './logger';
- import { supabase } from './supabase';
+ import { logger } from './logger';

  export async function extractInvoiceData(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<InvoiceOCRResult> {
    logger.info('Starting invoice extraction', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    safeProgress(10);

    // Validate file type (PDF only)
    if (!(VALID_INVOICE_TYPES as readonly string[]).includes(file.type)) {
      logger.warn('Invalid file type rejected', {
        fileName: file.name,
        fileType: file.type,
        validTypes: Array.from(VALID_INVOICE_TYPES),
      });
      return {
        success: false,
        error: 'Invalid file type. Please upload a PDF file.',
      };
    }

    // Validate file extension
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const validExtensions = VALID_INVOICE_EXTENSIONS as readonly string[];
    if (!validExtensions.includes(fileExt)) {
      logger.warn('Invalid file extension rejected', {
        fileName: file.name,
        fileExtension: fileExt,
        validExtensions: Array.from(VALID_INVOICE_EXTENSIONS),
      });
      return {
        success: false,
        error: 'Invalid file extension. Please upload a PDF file.',
      };
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      logger.warn('File size exceeds limit', {
        fileName: file.name,
        fileSize: file.size,
        maxSize,
      });
      return {
        success: false,
        error: 'File size exceeds 10MB limit. Please upload a smaller file.',
      };
    }

    safeProgress(30);

-   // Get Supabase session token - authentication is now required
-   let token: string | undefined;
-   try {
-     const { data } = await supabase.auth.getSession();
-     token = data.session?.access_token;
-   } catch (error) {
-     logger.error('Failed to get Supabase session', {
-       errorMessage: error instanceof Error ? error.message : String(error),
-     });
-     return {
-       success: false,
-       error: 'Authentication required. Please sign in to process invoices.',
-     };
-   }

-   if (!token) {
-     logger.error('No Supabase session - authentication required', {
-       fileName: file.name,
-     });
-     return {
-       success: false,
-       error: 'Authentication required. Please sign in to process invoices.',
-     };
-   }

    // Call FastAPI directly (no proxy)
    const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;
    const extractUrl = apiUrl
      ? `${apiUrl.replace(/\/$/, '')}/extract`
      : import.meta.env.DEV
        ? 'http://localhost:8000/extract'
        : '/api/extract-invoice';

    // Send only Bearer token (no API keys in production)
    const headers: Record<string, string> = {
-     Authorization: `Bearer ${token}`,
+     'Content-Type': 'multipart/form-data',
    };

-   // Optional: Dev-only API key for local testing
-   if (import.meta.env.DEV && import.meta.env.VITE_DEV_INVOICE_API_KEY) {
-     headers['X-API-Key'] = import.meta.env.VITE_DEV_INVOICE_API_KEY;
-   }
```

**Update `src/lib/invoiceImportApi.ts`:**
```diff
- import { supabase } from './supabase';

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

- async function getAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
-   const headers: Record<string, string> = {
-     'Content-Type': 'application/json',
-     ...extra,
-   };
- 
-   // Get Supabase token
-   const { data } = await supabase.auth.getSession();
-   const token = data.session?.access_token;
- 
-   if (!token) {
-     throw new Error('Authentication required. Please sign in to preview pricing.');
-   }
-   
-   headers.Authorization = `Bearer ${token}`;
-   
-   // Optional: Dev-only API key for testing
-   if (import.meta.env.DEV && import.meta.env.VITE_DEV_INVOICE_API_KEY) {
-     headers['X-API-Key'] = import.meta.env.VITE_DEV_INVOICE_API_KEY;
-   }
-   
-   return headers;
+ export async function getInvoiceApiHeaders(
+   extra: Record<string, string> = {}
+ ): Promise<Record<string, string>> {
+   const headers: Record<string, string> = {
+     'Content-Type': 'application/json',
+     ...extra,
+   };
+   
+   // No authentication required - anonymous access
+   return headers;
  }
```

**FastAPI Changes (external repo):**

Update FastAPI `main.py`:
```python
# BEFORE: JWT required
@app.post("/extract")
async def extract_invoice(
    file: UploadFile = File(..., max_size=10 * 1024 * 1024),
    user: dict = Depends(verify_supabase_jwt)  # ← Remove this
):
    # Process invoice...

# AFTER: Anonymous access
@app.post("/extract")  # ← No auth dependency
async def extract_invoice(
    file: UploadFile = File(..., max_size=10 * 1024 * 1024)  # ← No auth check
):
    """
    Extract invoice data from PDF upload.
    
    Args:
        file: PDF file (max 10MB)
        user: No longer required
    
    Returns:
        Extracted invoice data (products, supplier, etc.)
    """
    # Process invoice (OCR + GPT-4o)...
    return {"result": "success", "data": extracted_data}

@app.post("/invoice/preview-pricing")  # ← No auth dependency
async def preview_pricing(
    payload: PreviewRequest,
    # user: dict = Depends(verify_supabase_jwt)  # ← Remove this
):
    """
    Preview pricing for imported products.
    
    Args:
        payload: Invoice import data
        user: No longer required
    
    Returns:
        Pricing tiers (50%, 70%, 100%)
    """
    # Calculate pricing...
    return {"result": "success", "data": pricing_data}
```

Remove `auth.py` file entirely (or comment out):
```python
# from auth import verify_supabase_jwt  # ← Remove this import
```

**Pros:**
- ✅ Invoice feature works without authentication
- ✅ No auth setup needed
- ✅ Simpler code (less complexity)
- ✅ Faster development (no auth to manage)
- ✅ Easier to test (no sign-in flow needed)
- ✅ MVP approach (ship faster)

**Cons:**
- ❌ No user tracking (who uploaded what?)
- ❌ No rate limiting per user
- ❌ Potential abuse (anyone can use API)
- ❌ No security boundary (MVP tradeoff)

**Effort:** 30 minutes (client code) + 1 hour (FastAPI changes)
**Risk:** Low (simpler code, clear tradeoff)

---

### Solution 2: Optional Auth (Auth or No Auth) ⚠️ MORE COMPLEX

**Approach:** Make authentication optional - works with or without it.

**Implementation:**

Client changes:
```typescript
// Try to get token, but don't fail if missing
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;

// Send token if available, otherwise anonymous
const headers: Record<string, string> = {
  'Content-Type': 'multipart/form-data',
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

// FastAPI accepts both authenticated and anonymous
```

FastAPI changes:
```python
@app.post("/extract")
async def extract_invoice(
    file: UploadFile = File(..., max_size=10 * 1024 * 1024),
    user: Optional[dict] = Depends(optional_verify_supabase_jwt)  # ← Optional
):
    if user:
        # Rate limit per user
        if await is_rate_limited(user['id']):
            raise HTTPException(status_code=429, detail="Too many requests")
    
    # Process invoice...
    return {"result": "success", "data": extracted_data}
```

**Pros:**
- ✅ Works without auth (MVP)
- ✅ Supports auth later (future)
- ✅ User tracking when authenticated
- ✅ Rate limiting per user when signed in
- ✅ More flexible

**Cons:**
- ❌ More complex (optional parameters)
- ❌ Harder to test (two code paths)
- ❌ Still requires some auth logic

**Effort:** 1-2 hours
**Risk:** Medium (more complexity)

---

### Solution 3: Keep Auth Requirement (Status Quo) ⚠️ NOT RECOMMENDED

**Approach:** Keep authentication requirement, document as "auth setup not implemented yet".

**Implementation:**
- Add big warning banner: "Invoice feature requires authentication - sign in to use"
- Show sign-in prompt when trying to upload
- Document in README: "Auth feature coming soon"

**Pros:**
- ✅ No code changes
- ✅ Documents expected state

**Cons:**
- ❌ Feature doesn't work at all
- ❌ Users can't test invoice
- ❌ Wastes existing invoice code
- ❌ Doesn't solve problem

**Effort:** 0 hours
**Risk:** High (feature remains broken)

## Recommended Action

**Choose Solution 1: Remove Auth Entirely**

**Rationale:**
- MVP approach: Ship invoice feature without auth
- Simpler code: No auth complexity
- Faster development: No auth setup needed
- Easier testing: No sign-in flow required
- Clear tradeoff: Security vs speed
- Can add auth later as enhancement

**Execution Plan:**
1. Update `src/lib/invoiceOCR.ts` to remove auth checks
2. Update `src/lib/invoiceImportApi.ts` to remove auth checks
3. Update `InvoiceUploadDialog.tsx` to remove auth guard
4. Test locally: Upload invoice should work without signing in
5. Update FastAPI to remove `Depends(verify_supabase_jwt)` from endpoints
6. Remove or comment out `auth.py` file in FastAPI repo
7. Test end-to-end: Anonymous upload should work
8. Document decision in `docs/INVOICE_AUTH_DECISION.md`
9. Add to `.env.example`: No auth required
10. Remove auth-related todos (#035, #028, #029) or mark as deferred

**DO NOT CHOOSE** Solution 2 or 3 - Either keep auth broken or add unnecessary complexity.

## Acceptance Criteria

### Client Changes
- [ ] `invoiceOCR.ts` removes `supabase` import
- [ ] `invoiceOCR.ts` removes all auth token checks
- [ ] `invoiceOCR.ts` removes auth error returns
- [ ] `invoiceOCR.ts` headers only include `Content-Type: multipart/form-data`
- [ ] `invoiceImportApi.ts` removes `supabase` import
- [ ] `invoiceImportApi.ts` removes all auth checks
- [ ] `invoiceImportApi.ts` `getInvoiceApiHeaders()` no longer async
- [ ] `InvoiceUploadDialog.tsx` removes auth state check
- [ ] No auth error messages shown to users

### FastAPI Changes
- [ ] `/extract` endpoint removes `Depends(verify_supabase_jwt)`
- [ ] `/invoice/preview-pricing` endpoint removes `Depends(verify_supabase_jwt)`
- [ ] `auth.py` file removed or commented out
- [ ] `verify_supabase_jwt` import removed from `main.py`
- [ ] Endpoints accept anonymous requests

### Testing
- [ ] Local test: Upload invoice without signing in → success
- [ ] Local test: Upload PDF → products extracted
- [ ] Local test: Preview pricing → works
- [ ] No auth errors shown
- [ ] Browser console: No "supabase is not defined" errors

### Documentation
- [ ] `docs/INVOICE_AUTH_DECISION.md` created documenting decision
- [ ] `.env.example` updated: No auth required
- [ ] README.md updated: Invoice feature works anonymously
- [ ] Auth-related todos marked as deferred or removed

### Cleanup
- [ ] Todo #035 (Add Supabase sign-in flow) marked as deferred
- [ ] Todo #028 (FastAPI JWT validation) marked as not applicable
- [ ] Todo #029 (Token refresh) marked as not applicable
- [ ] Or delete these todos entirely

## Work Log

### 2026-02-17 - Decision to Skip Auth

**By:** User Request + Claude Code

**Actions:**
- User decided to skip authentication setup entirely
- Reviewed current auth requirements in client code
- Reviewed current auth requirements in FastAPI plan
- Designed approach to remove all auth checks
- Created 3 solution options with tradeoffs

**Learnings:**
- MVP approach prioritizes speed over security
- Anonymous access is simpler but has tradeoffs
- Can add auth later as enhancement
- Current invoice code is tightly coupled to auth
- Removing auth simplifies code significantly

**Rationale for Skipping Auth:**
- Faster to ship (no auth UI to build)
- Easier to test (no sign-in flow)
- MVP validation (is invoice feature core requirement?)
- Can iterate: Add auth later if needed
- Focus on invoice extraction quality first

**Next Steps:**
- Implement auth removal from client
- Implement auth removal from FastAPI
- Test anonymous invoice upload
- Document decision
- Deploy to production

## Technical Details

### Affected Files (Client)
- `src/lib/invoiceOCR.ts` - Remove auth imports, token checks, auth headers
- `src/lib/invoiceImportApi.ts` - Remove auth imports, token checks, async getAuthHeaders
- `src/components/invoice/InvoiceUploadDialog.tsx` - Remove auth state checks

### Affected Files (FastAPI - External)
- FastAPI `main.py` - Remove `Depends(verify_supabase_jwt)` from endpoints
- FastAPI `auth.py` - Remove or comment out entire file

### Related Components
- Supabase SDK (`@supabase/supabase-js`) - No longer used by invoice
- InvoiceUploadDialog - Simplifies auth logic

### Database Changes
- None

### API Changes
- FastAPI `/extract`: Remove auth requirement
- FastAPI `/invoice/preview-pricing`: Remove auth requirement

## Resources

**Decision Documentation:**
- Create `docs/INVOICE_AUTH_DECISION.md` - Document why auth was skipped
- Tradeoffs: Security vs Speed
- Future: How to add auth back if needed

**Related Issues:**
- **DEFERRED**: #035 (Add Supabase sign-in flow) - Not needed for MVP
- **NOT APPLICABLE**: #028 (FastAPI JWT validation) - Auth removed
- **NOT APPLICABLE**: #029 (Token refresh) - Auth removed

---

## Notes

- **MVP Decision**: Invoice feature works anonymously for faster iteration
- **Security Tradeoff**: Anyone can use invoice API, but acceptable for MVP
- **Future Enhancement**: Can add per-user rate limiting, auth tracking later
- **Testing Focus**: Focus on invoice extraction quality, not auth flows
- **Documentation**: Clearly document decision and tradeoffs
