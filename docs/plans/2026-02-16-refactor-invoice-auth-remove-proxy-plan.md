---
title: Remove Vercel proxy, implement Supabase JWT validation directly in FastAPI
type: refactor
date: 2026-02-16
---

# Refactor Invoice Auth: Remove Vercel Proxy, Use FastAPI Directly

## Overview

Simplify invoice extraction architecture by removing the Vercel proxy (`/api/extract-invoice`) and implementing Supabase JWT validation directly in FastAPI. This eliminates unnecessary infrastructure, reduces latency, and maintains security with proper JWT validation on the FastAPI side.

## Problem Statement

### Current Architecture

```
Browser (invoiceOCR.ts)
  ↓ Authorization: Bearer {JWT} + X-API-Key (dev)
Vercel Proxy (/api/extract-invoice)
  ↓ Validates JWT with supabase.auth.getUser(token)
  ↓ X-API-Key (server-side)
FastAPI External Service (/extract)
```

### Issues with Current Setup

1. **Unnecessary complexity:** Vercel proxy adds an extra hop and failure point
2. **Latency:** Proxy adds ~100-500ms cold start delay
3. **Maintenance burden:** Requires managing server-side env vars for proxy
4. **Debug difficulty:** Issues harder to trace through multiple layers

## Proposed Solution

### Target Architecture

```
Browser (invoiceOCR.ts, invoiceImportApi.ts)
  ↓ Authorization: Bearer {JWT}
FastAPI External Service (/extract, /invoice/preview-pricing)
  ↓ Validates JWT using Supabase SDK
  ↓ Process invoice
```

## Implementation

### 1. Client-Side Changes (inventory-app repo)

**Files:**
- `src/lib/invoiceOCR.ts` - Call FastAPI directly
- `src/lib/invoiceImportApi.ts` - Call FastAPI directly
- `.env.example` - Update env var documentation

**invoiceOCR.ts changes:**

```typescript
// Get Supabase session token with proper error handling
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;

if (!token) {
  logger.error('No Supabase session - authentication required', {
    fileName: file.name,
  });
  return {
    success: false,
    error: 'Authentication required. Please sign in to process invoices.',
  };
}

// Construct API URL with production fallback
const extractUrl = import.meta.env.VITE_INVOICE_API_URL
  ? `${import.meta.env.VITE_INVOICE_API_URL.replace(/\/$/, '')}/extract`
  : import.meta.env.DEV
    ? 'http://localhost:8000/extract'
    : '/api/extract-invoice'; // Keep as fallback during transition

// Send only Bearer token (no API keys in production)
const headers: Record<string, string> = {
  Authorization: `Bearer ${token}`,
};

// Optional: Dev-only API key for local testing
if (import.meta.env.DEV && import.meta.env.VITE_DEV_INVOICE_API_KEY) {
  headers['X-API-Key'] = import.meta.env.VITE_DEV_INVOICE_API_KEY;
}
```

**invoiceImportApi.ts changes:**

```typescript
function getInvoiceApiBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;

  if (apiUrl) {
    return apiUrl.replace(/\/$/, '');
  }

  // Development fallback to localhost FastAPI
  return import.meta.env.DEV ? 'http://localhost:8000' : '/api';
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Get Supabase token
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error('Authentication required. Please sign in to preview pricing.');
  }

  headers.Authorization = `Bearer ${token}`;

  // Optional: Dev-only API key for testing
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_INVOICE_API_KEY) {
    headers['X-API-Key'] = import.meta.env.VITE_DEV_INVOICE_API_KEY;
  }

  return headers;
}
```

**Environment Variables:**

```bash
# .env.example
# =============================================================================
# INVOICE OCR & DATA EXTRACTION
# =============================================================================

# FastAPI Service URL (production)
VITE_INVOICE_API_URL=https://your-fastapi-production.com

# Development only - API key for local testing
# VITE_DEV_INVOICE_API_KEY=dev-key-for-local-testing

# REMOVED (no longer needed):
# VITE_INVOICE_PROXY_URL=xxx
# VITE_INVOICE_API_KEY=xxx
```

### 2. Server-Side Changes (FastAPI external repo)

**Note:** FastAPI code is in a separate repo. This plan documents required changes for the FastAPI team.

**Implementation:** Use Supabase SDK for JWT validation (simpler than custom JWKS).

**auth.py (new file):**

```python
# auth.py - FastAPI Supabase JWT validation
from supabase import create_client
import os

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async def verify_supabase_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
) -> dict:
    """
    Verify Supabase JWT token using Supabase SDK.
    Returns user dict if valid, raises HTTPException if invalid.
    """
    token = credentials.credentials

    try:
        response = supabase_client.auth.get_user(token)

        if not response.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token"
            )

        return response.user.dict()

    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {str(e)}"
        )
```

**Update routes to use auth:**

```python
# main.py
from fastapi import FastAPI, Depends
from fastapi.security import HTTPBearer
from auth import verify_supabase_jwt

app = FastAPI()

# Protected route - requires authentication
@app.post("/extract")
async def extract_invoice(
    file: UploadFile,
    user: dict = Depends(verify_supabase_jwt)
):
    # user is guaranteed to be authenticated
    # Process invoice...
    return {"result": "success", "user_id": user["id"]}

# Pricing preview - requires authentication
@app.post("/invoice/preview-pricing")
async def preview_pricing(
    payload: PreviewRequest,
    user: dict = Depends(verify_supabase_jwt)
):
    # user is guaranteed to be authenticated
    # Process preview...
    return {"result": "success"}
```

**CORS Configuration:**

```python
# main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://lavio.vercel.app",  # Production
        "http://localhost:5173",       # Dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Environment Variables for FastAPI:**

```python
# .env for FastAPI
SUPABASE_URL=https://qjrwvsjigyzkfxbvdfoa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Requires: pip install supabase
```

### 3. Cleanup Changes

**Files to Remove:**
- `api/extract-invoice.ts` - Vercel proxy function

**Files to Update:**
- `docs/FASTAPI_INTEGRATION.md` - Remove proxy documentation
- `docs/FASTAPI_SECURITY_GUIDE.md` - Update to reflect direct auth
- `.env.example` - Remove proxy env vars

**Vercel Environment Variables to Remove:**
- `INVOICE_API_KEY`
- `INVOICE_API_URL`
- `INVOICE_PROXY_REQUIRE_AUTH`

## Technical Considerations

### Security

✅ **Improved:**
- JWT validation happens in FastAPI (closer to data)
- No API keys exposed in client bundle (already true with proxy)
- Supabase SDK handles all JWT validation edge cases

⚠️ **To verify:**
- FastAPI service_role key never exposed to client
- CORS origins are restricted in production
- Rate limiting on `/extract` endpoint (recommended)

### Performance

✅ **Improved:**
- No Vercel cold start delays (~100-500ms)
- Fewer network hops (client → FastAPI vs client → proxy → FastAPI)
- Supabase SDK handles JWKS caching automatically

📊 **Expected improvement:**
- Latency: -100-500ms (no proxy hop)
- Cold starts: Eliminated (no Vercel function)
- Throughput: Higher (no proxy bottleneck)

### Architecture

✅ **Simplified:**
- Single source of truth (FastAPI handles auth)
- Fewer moving parts to debug
- Direct error visibility from FastAPI

## Acceptance Criteria

- [ ] Client sends `Authorization: Bearer {JWT}` directly to FastAPI
- [ ] FastAPI validates JWT and returns 401 for invalid tokens
- [ ] Invoice extraction works with authenticated Supabase users
- [ ] Invoice pricing preview works with authentication
- [ ] No Vercel proxy function in deployment
- [ ] Invoice extraction latency reduced by >100ms (no proxy hop)
- [ ] No Vercel cold start delays
- [ ] CORS origins restricted to `https://lavio.vercel.app` and `http://localhost:5173`
- [ ] Test with expired token → 401 error
- [ ] Test with invalid token → 401 error
- [ ] Test with valid token → success
- [ ] Verify no API keys in client bundle (check build output)
- [ ] Verify proxy env vars removed from Vercel

## Dependencies & Risks

### Dependencies

**Inventory-app repo:**
- FastAPI auth implementation must be deployed first
- No code changes blocked on external teams

**FastAPI repo (external):**
- Requires: `supabase-py` SDK

### Risks

| Risk | Impact | Mitigation |
|-------|----------|-------------|
| FastAPI auth bugs break production | High | Test thoroughly with staging FastAPI first |
| CORS misconfiguration breaks access | High | Test CORS with production domain before deploying |
| Users without valid tokens blocked | Low | Provide clear error messages with refresh instructions |

### Rollback Plan

If issues arise in production:
1. Revert client code to use proxy URL temporarily
2. Remove FastAPI auth requirement temporarily
3. Investigate and fix auth issues
4. Re-deploy FastAPI with fixed auth

## Implementation Checklist

### FastAPI Changes (FastAPI team)

- [ ] Create `auth.py` with Supabase SDK validation
- [ ] Implement `verify_supabase_jwt` dependency
- [ ] Update `/extract` route to require auth
- [ ] Update `/invoice/preview-pricing` route to require auth
- [ ] Add CORS configuration
- [ ] Test with valid/invalid/expired tokens
- [ ] Deploy to staging FastAPI
- [ ] Deploy to production FastAPI

### Client Updates (inventory-app repo)

- [ ] Update `src/lib/invoiceOCR.ts` to call FastAPI directly
- [ ] Update `src/lib/invoiceImportApi.ts` to call FastAPI directly
- [ ] Add proper token retrieval with error handling
- [ ] Test locally with dev FastAPI
- [ ] Test with staging FastAPI
- [ ] Update `.env.example`
- [ ] Deploy to Vercel

### Cleanup (inventory-app repo)

- [ ] Delete `api/extract-invoice.ts`
- [ ] Remove proxy env vars from Vercel
- [ ] Update `FASTAPI_INTEGRATION.md`
- [ ] Update `FASTAPI_SECURITY_GUIDE.md`
- [ ] Test production end-to-end

## References & Research

### Internal References

- Current proxy implementation: `api/extract-invoice.ts:23-84`
- Client extraction code: `src/lib/invoiceOCR.ts:343-366`
- Client pricing code: `src/lib/invoiceImportApi.ts:55-73`
- Previous proxy security solution: `docs/solutions/integration-issues/invoice-proxy-security-hardening-InvoiceOCRProxy-20260210.md`

### External References

- Supabase Python SDK: https://supabase.com/docs/reference/python
- FastAPI Security Tutorial: https://fastapi.tiangolo.com/tutorial/security/
- FastAPI + Supabase Template: https://github.com/AtticusZeller/fastapi_supabase_template
