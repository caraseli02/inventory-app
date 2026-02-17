---
status: pending
priority: p1
issue_id: "029"
tags: [security, authentication, critical, data-integrity]
dependencies: []
---

# Implement token refresh mechanism for Supabase JWT

## Problem Statement

The current code captures Supabase JWT tokens once at request time but **does not refresh them**. Supabase tokens expire after 1 hour by default, causing long uploads to fail with 401 errors and wasting user bandwidth. There's no mechanism to detect expiring tokens or refresh them automatically.

**Critical Risk:** Users with active sessions experience authentication failures during invoice uploads because tokens expire mid-upload, resulting in poor UX and wasted processing time.

## Findings

### Root Cause Analysis

**Location:**
- `src/lib/invoiceOCR.ts:343-365`
- `src/lib/invoiceImportApi.ts:62-68`

**Current implementation:**
```typescript
// Captures token snapshot (no refresh logic)
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;  // ← Static snapshot

if (!token) {
  throw new Error('Authentication required. Please sign in to process invoices.');
}

// No check for expiration!
// No refresh mechanism!
// Token could be expired already
```

### Exploit Scenario: Long Upload

**Timeline:**
```
T=0s:    User opens InvoiceUploadDialog at 10:00 AM
T=3600s:  Token expires at 11:00 AM (1 hour TTL)
T=4500s:  User starts large PDF upload at 11:15 AM (token is 15 min expired)
T=4620s:  Upload starts at 11:17 AM
T=5160s:  Upload takes 90 seconds (large file)
T=5160s:  Upload completes
T=5160s:  FastAPI receives request with **expired** token
T=5160s:  FastAPI returns 401 Unauthorized
T=5160s:  Client shows: "Unauthorized request. Please check your server-side invoice API configuration."
```

**Impact:**
- ❌ User wastes 90 seconds uploading expired token
- ❌ Bandwidth wasted (uploaded file rejected)
- ❌ Confusing error message (user doesn't know token was issue)
- ❌ No automatic retry
- ❌ User frustration (uploaded same file twice)

### Supabase Token Lifecycle

**Default Supabase token configuration:**
```javascript
{
  access_token: "eyJhbGciOiJIUzI1NiIs...",  // 1 hour expiry
  refresh_token: "eyJhbGciOiJIUzI1NiIs...",  // 30 day expiry
  expires_at: 1738761600,  // Unix timestamp
  expires_in: 3600  // 1 hour in seconds
}
```

**Correct refresh flow:**
```typescript
// Should check expiration before use
const { data } = await supabase.auth.getSession();
const expiresAt = data.session?.expires_at;

// Refresh if expires in < 5 minutes
if (expiresAt && Date.now() / 1000 + 300 > expiresAt) {
  logger.info('Token expiring soon, refreshing...');
  const { data: refreshData, error } = await supabase.auth.refreshSession();
  
  if (error) {
    throw new Error('Session expired. Please sign in again.');
  }
  
  return refreshData.session.access_token;  // Fresh token
}

return data.session.access_token;  // Token is still valid
```

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| Long uploads fail | 🔴 Critical | High | 9/10 |
| Bandwidth waste | 🟠 High | Medium | 6/10 |
| Poor UX (no retry) | 🟠 High | High | 8/10 |
| Confusing errors | 🟡 Medium | High | 5/10 |

**Overall Risk Score: 28/40** - Exceeds critical threshold

### Related Issues

This is **blocked by** Issue #028 (FastAPI JWT validation deployment).

If tokens are refreshed properly but FastAPI auth isn't deployed, refreshed tokens will be useless anyway.

## Proposed Solutions

### Solution 1: Create Shared Token Utility with Auto-Refresh ✅ RECOMMENDED

**Approach:** Create `src/lib/invoiceAuth.ts` utility that handles token retrieval, expiration checking, and automatic refresh.

**Implementation:**

**New file: `src/lib/invoiceAuth.ts`**
```typescript
import { supabase } from './supabase';
import { logger } from './logger';

const TOKEN_REFRESH_THRESHOLD_SECONDS = 300; // 5 minutes

interface SupabaseSession {
  access_token: string;
  expires_at: number;
  refresh_token: string;
}

export async function getFreshInvoiceToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    logger.error('Failed to get Supabase session', { error: error.message });
    throw new Error('Authentication failed. Please sign in.');
  }
  
  if (!data.session) {
    logger.error('No Supabase session found');
    throw new Error('Authentication required. Please sign in.');
  }
  
  const session = data.session as SupabaseSession;
  const expiresAt = session.expires_at;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  
  // Refresh if token expires in < 5 minutes
  if (expiresAt && nowInSeconds + TOKEN_REFRESH_THRESHOLD_SECONDS > expiresAt) {
    logger.info('Token expiring soon, refreshing...', {
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      expiresIn: expiresAt - nowInSeconds,
    });
    
    const { data: refreshData, error: refreshError } = 
      await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      logger.error('Failed to refresh token', { error: refreshError?.message });
      throw new Error('Session expired. Please sign in again.');
    }
    
    const freshToken = refreshData.session.access_token;
    logger.info('Token refreshed successfully', {
      newExpiresAt: new Date(refreshData.session.expires_at * 1000).toISOString(),
    });
    
    return freshToken;
  }
  
  // Token is still valid
  return session.access_token;
}

export async function getInvoiceAuthHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const token = await getFreshInvoiceToken();
  
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
```

**Update `src/lib/invoiceImportApi.ts`:**
```diff
- async function getAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
-   const headers: Record<string, string> = {
-     'Content-Type': 'application/json',
-     ...extra,
-   };
- 
-   const { data } = await supabase.auth.getSession();
-   const token = data.session?.access_token;
- 
-   if (!token) {
-     throw new Error('Authentication required. Please sign in to preview pricing.');
-   }
- 
-   headers.Authorization = `Bearer ${token}`;
- 
-   if (import.meta.env.DEV && import.meta.env.VITE_DEV_INVOICE_API_KEY) {
-     headers['X-API-Key'] = import.meta.env.VITE_DEV_INVOICE_API_KEY;
-   }
- 
-   return headers;
- }
+ import { getInvoiceAuthHeaders } from './invoiceAuth';
+ 
+ export async function previewInvoicePricing(
+   payload: PreviewPricingRequest
+ ): Promise<PreviewPricingResponse> {
+   const baseUrl = getInvoiceApiBaseUrl();
+   const response = await fetch(`${baseUrl}/invoice/preview-pricing`, {
+     method: 'POST',
+     headers: await getInvoiceAuthHeaders(),
+     body: JSON.stringify(payload),
+   });
```

**Update `src/lib/invoiceOCR.ts`:**
```diff
  import { logger } from './logger';
  import { supabase } from './supabase';
+ import { getFreshInvoiceToken } from './invoiceAuth';

  export async function extractInvoiceData(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<InvoiceOCRResult> {
    ...
    // Get Supabase session token with automatic refresh
    let token: string | undefined;
    try {
-     const { data } = await supabase.auth.getSession();
-     token = data.session?.access_token;
+     token = await getFreshInvoiceToken();
    } catch (error) {
      logger.error('Failed to get Supabase session', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: 'Authentication required. Please sign in to process invoices.',
      };
    }
```

**Pros:**
- ✅ Single source of truth for token handling
- ✅ Automatic refresh before expiration
- ✅ Removes duplicate token logic in 2 files
- ✅ Comprehensive logging for debugging
- ✅ Handles both refresh scenarios (near-expiry and expired)
- ✅ Clear error messages for users

**Cons:**
- ❌ Adds new file (`invoiceAuth.ts`) - but simplifies existing code
- ❌ Requires testing refresh logic edge cases

**Effort:** 2-3 hours (implementation + unit tests)
**Risk:** Low (well-understood Supabase token lifecycle)

---

### Solution 2: Inline Refresh in Both Files ⚠️ ALTERNATIVE

**Approach:** Add token refresh logic directly in `invoiceImportApi.ts` and `invoiceOCR.ts` without creating shared utility.

**Implementation:**
```typescript
// Duplicate refresh logic in both files
async function getAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const expiresAt = data.session?.expires_at;
  
  if (!token) {
    throw new Error('Authentication required. Please sign in to preview pricing.');
  }
  
  // Refresh if expires in < 5 minutes
  if (expiresAt && Date.now() / 1000 + 300 > expiresAt) {
    const { data: refreshData, error } = await supabase.auth.refreshSession();
    if (error || !refreshData.session) {
      throw new Error('Session expired. Please sign in again.');
    }
    headers.Authorization = `Bearer ${refreshData.session.access_token}`;
  } else {
    headers.Authorization = `Bearer ${token}`;
  }
  
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_INVOICE_API_KEY) {
    headers['X-API-Key'] = import.meta.env.VITE_DEV_INVOICE_API_KEY;
  }
  
  return headers;
}
```

**Pros:**
- ✅ No new file added
- ✅ Minimal code changes
- ✅ Fast implementation

**Cons:**
- ❌ Duplicates refresh logic in 2 files (violates DRY)
- ❌ Harder to maintain (two places to update)
- ❌ No shared utility for future use
- ❌ Increases code complexity

**Effort:** 1-2 hours (duplicate logic in 2 files)
**Risk:** Medium (code duplication, harder to test)

---

### Solution 3: Supabase Auth State Listener ⚠️ COMPLEX

**Approach:** Use Supabase `onAuthStateChange` listener to track token changes and abort in-flight requests on token expiry.

**Implementation:**
```typescript
// Track in-flight requests
const inFlightRequests = new Map<string, AbortController>();

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
    logger.info('Auth state changed, aborting in-flight requests', { event });
    inFlightRequests.forEach((controller) => controller.abort());
    inFlightRequests.clear();
  }
});

// In upload:
const controller = new AbortController();
const requestId = crypto.randomUUID();
inFlightRequests.set(requestId, controller);

const response = await fetch(extractUrl, {
  headers: { Authorization: `Bearer ${token}` },
  signal: controller.signal,
});

inFlightRequests.delete(requestId);
```

**Pros:**
- ✅ Handles token expiry during upload gracefully
- ✅ Cancels unnecessary requests
- ✅ Real-time token tracking

**Cons:**
- ❌ More complex implementation
- ❌ Requires global state management
- ❌ Adds request tracking overhead
- ❌ Doesn't solve pre-request expiry (just handles mid-upload)

**Effort:** 4-6 hours (state management + testing)
**Risk:** Medium (complexity, edge cases)

## Recommended Action

**Choose Solution 1: Create Shared Token Utility with Auto-Refresh**

**Rationale:**
- Removes code duplication (DRY principle)
- Single source of truth for token handling
- Automatic refresh prevents authentication failures
- Clear, maintainable code structure
- Comprehensive logging for debugging
- Minimal effort for maximum benefit

**Execution Plan:**
1. Create `src/lib/invoiceAuth.ts` with `getFreshInvoiceToken()` and `getInvoiceAuthHeaders()`
2. Write unit tests for token refresh logic:
   - Token not expiring → no refresh
   - Token expiring in 6 minutes → refresh
   - Token expired → refresh
   - No session → throw error
   - Refresh fails → throw clear error
3. Update `src/lib/invoiceImportApi.ts` to use shared utility
4. Update `src/lib/invoiceOCR.ts` to use shared utility
5. Test locally with dev FastAPI:
   - Simulate token expiry (modify TTL)
   - Verify automatic refresh
   - Verify error messages
6. Test with staging FastAPI
7. Deploy to production after Issue #028 is complete

**DO NOT CHOOSE** Solution 2 - Code duplication violates DRY and makes maintenance harder.

## Acceptance Criteria

- [ ] `src/lib/invoiceAuth.ts` created with `getFreshInvoiceToken()` function
- [ ] `getInvoiceAuthHeaders()` function created in shared utility
- [ ] Token refreshes automatically when expiring in < 5 minutes
- [ ] Token refresh handles both near-expiry and expired scenarios
- [ ] `src/lib/invoiceImportApi.ts` updated to use shared utility
- [ ] `src/lib/invoiceOCR.ts` updated to use shared utility
- [ ] Duplicate token logic removed from both files
- [ ] Unit tests written for token refresh:
   - [ ] Valid token, not expiring → no refresh
   - [ ] Token expiring in 6 minutes → refresh
   - [ ] Token expired → refresh
   - [ ] No session → throw error
   - [ ] Refresh fails → throw clear error
- [ ] Error messages are clear and actionable
- [ ] Logging added for token refresh events
- [ ] Dev API key logic preserved in shared utility
- [ ] Local testing completed with dev FastAPI
- [ ] Staging testing completed
- [ ] Production deployment after Issue #028 confirmed

## Work Log

### 2026-02-17 - Code Review Discovery

**By:** Claude Code (Data Integrity Guardian Agent)

**Actions:**
- Reviewed client code for token handling
- Identified missing token refresh mechanism
- Analyzed token lifecycle and expiry scenarios
- Created shared utility implementation plan
- Documented unit test requirements

**Learnings:**
- Supabase tokens expire in 1 hour by default
- Token refresh is well-documented in Supabase SDK
- Automatic refresh prevents authentication failures
- Shared utility simplifies token management
- DRY principle reduces maintenance burden

**Next Steps:**
- Wait for Issue #028 completion (FastAPI JWT deployment)
- Implement shared token utility
- Write comprehensive unit tests
- Coordinate deployment with FastAPI team

## Technical Details

**Affected Files:**
- `src/lib/invoiceOCR.ts:342-383` - Replace token retrieval
- `src/lib/invoiceImportApi.ts:56-78` - Replace token retrieval
- `src/lib/invoiceAuth.ts` - NEW FILE (shared token utility)
- `tests/unit/lib/invoiceAuth.test.ts` - NEW FILE (unit tests)

**Related Components:**
- Supabase SDK (`@supabase/supabase-js`) - Token management
- FastAPI service (external) - Receives JWT tokens

**Database Changes:**
- None

**API Changes:**
- No API changes (client-side only)
- FastAPI must validate JWT tokens (Issue #028)

## Resources

**Supabase Documentation:**
- Token Refresh: https://supabase.com/docs/reference/javascript/auth-refreshsession
- Session Management: https://supabase.com/docs/guides/auth/server-side/nextjs
- Auth State Changes: https://supabase.com/docs/guides/auth/auth-helpers/nextjs#managing-auth-state

**Code Review Agents:**
- Data Integrity Guardian: Identified token refresh gap
- Git History Analyzer: Confirmed no refresh mechanism exists

**Related Issues:**
- Blocked by Issue #028 (FastAPI JWT validation)

---

## Notes

- **Dependencies:** Cannot deploy until Issue #028 is complete (FastAPI JWT auth)
- **Testing:** Must test token refresh with both dev and staging FastAPI
- **Monitoring:** Add logs for token refresh events to track frequency
- **User Impact:** Should significantly reduce authentication errors for long uploads
