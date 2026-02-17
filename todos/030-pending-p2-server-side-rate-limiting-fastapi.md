---
status: pending
priority: p2
issue_id: "030"
tags: [security, performance, rate-limiting, code-review]
dependencies: ["028"]
---

# Add server-side rate limiting to FastAPI invoice extraction

## Problem Statement

The deleted Vercel proxy had server-side file size validation (10MB limit), but now only **client-side validation** exists. Client validation can be bypassed via curl, Postman, or browser DevTools, allowing attackers to upload massive files to cause DoS or exhaust FastAPI resources.

**Medium Risk:** Attackers can bypass 10MB limit, upload arbitrary file sizes, and abuse the service without rate limits.

## Findings

### Root Cause Analysis

**Location:**
- `src/lib/invoiceOCR.ts:326-338` (client-side validation only)
- `api/extract-invoice.ts` (DELETED - had server-side validation)

**Client-side validation (current):**
```typescript
// Validates file size before upload
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

// Uploads to FastAPI
const response = await fetch(`${apiUrl}/extract`, { ... });
```

**Why this is insufficient:**
- ❌ Validation runs in **browser** (user can bypass)
- ❌ Attackers can use curl/Postman to skip validation
- ❌ No server-side enforcement of 10MB limit
- ❌ No rate limiting per user
- ❌ No upload frequency limits

### Exploit Scenario: Large File DoS

**Bypassing client validation:**
```bash
# Attacker uses curl (bypasses client 10MB check)
curl -X POST https://your-fastapi-production.com/extract \
  -H "Authorization: Bearer <stolen-jwt>" \
  -F "file=@huge-500mb-file.pdf" \
  --max-time 300

# FastAPI receives 500MB file (no server-side limit!)
# Causes:
# - Disk exhaustion on server
# - Memory exhaustion during OCR processing
# - OCR service timeout/failure
# - DDoS for legitimate users
```

**Attack consequences:**
- ❌ Upload 500MB file (50x intended limit)
- ❌ Exhaust FastAPI server resources (CPU, memory, disk)
- ❌ Cause OCR service to timeout or crash
- ❌ Denial of service for legitimate users
- ❌ Financial damage (if paid OCR/GPT-4o costs)

### Exploit Scenario: Unlimited Upload Rate

```bash
# Attacker uploads repeatedly (no rate limiting)
for i in {1..100}; do
  curl -X POST https://your-fastapi-production.com/extract \
    -H "Authorization: Bearer <stolen-jwt>" \
    -F "file=@invoice-$i.pdf" &
done

# 100 concurrent uploads:
# - Exhaust FastAPI worker pool
# - Exhaust OCR API rate limits
# - Exhaust GPT-4o token quota
# - Cost spike for API owner
# - DDoS legitimate users
```

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| Large file DoS | 🟠 High | Medium | 6/10 |
| Unlimited upload abuse | 🟠 High | Medium | 6/10 |
| Financial damage (API costs) | 🟠 High | Medium | 6/10 |
| Service degradation | 🟡 Medium | Medium | 5/10 |

**Overall Risk Score: 23/40** - High risk

### Comparison: Proxy vs Direct

**Vercel Proxy (DELETED):**
```typescript
// api/extract-invoice.ts (lines 45-60)
export default async function handler(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  
  // Server-side validation (CANNOT be bypassed)
  if (file.size > 10 * 1024 * 1024) {
    return new Response('File too large', { status: 413 });
  }
  
  // Rate limiting at proxy level
  const userIp = req.headers.get('x-forwarded-for');
  if (await isRateLimited(userIp)) {
    return new Response('Too many requests', { status: 429 });
  }
  
  // Forward to FastAPI
  const response = await fetch(`${process.env.INVOICE_API_URL}/extract`, {
    method: 'POST',
    body: formData,
  });
  
  return response;
}
```

**Direct FastAPI (CURRENT - No server-side validation):**
```typescript
// Client validation (EASILY bypassed)
if (file.size > maxSize) {
  return { error: 'File size exceeds 10MB limit' };
}

// No server-side check!
// No rate limiting!
// Direct call to FastAPI → No protection
```

## Proposed Solutions

### Solution 1: Add Server-Side Validation to FastAPI ✅ RECOMMENDED

**Approach:** Implement file size validation, rate limiting, and upload frequency limits in FastAPI backend.

**Implementation:**

**FastAPI `main.py` (external repo):**
```python
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from auth import verify_supabase_jwt
import os

app = FastAPI()

# Rate limiting (5 requests per minute per user)
limiter = Limiter(key_func=get_user_id_from_token)

@app.post("/extract")
@limiter.limit("5/minute")  # 5 uploads per minute per user
async def extract_invoice(
    file: UploadFile = File(..., max_size=10 * 1024 * 1024),
    user: dict = Depends(verify_supabase_jwt)
):
    """
    Extract invoice data from PDF upload.
    
    Args:
        file: PDF file (max 10MB)
        user: Authenticated user from JWT
    """
    
    # Additional validation (defense in depth)
    if file.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds 10MB limit"
        )
    
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only PDF files are allowed."
        )
    
    # Process invoice (OCR + GPT-4o)
    # ... existing processing logic ...
    
    return {"result": "success", "data": extracted_data}

def get_user_id_from_token(request) -> str:
    """Extract user_id from JWT for rate limiting."""
    try:
        auth_header = request.headers.get("Authorization")
        token = auth_header.replace("Bearer ", "")
        user = supabase_client.auth.get_user(token)
        return user.user.id  # Unique per user
    except:
        return request.client.host  # Fallback to IP if token invalid
```

**Error handling:**
```python
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )
```

**Pros:**
- ✅ Server-side validation (cannot be bypassed)
- ✅ Per-user rate limiting (prevents abuse)
- ✅ File size enforcement (10MB hard limit)
- ✅ Defense in depth (client + server validation)
- ✅ Clear error messages (413, 429)
- ✅ Leverages existing JWT auth (user_id for limits)

**Cons:**
- ❌ Requires FastAPI team changes (external repo)
- ❌ Adds dependency on `slowapi` library

**Effort:** 2-3 hours (FastAPI side)
**Risk:** Low (standard rate limiting pattern)

---

### Solution 2: Reintroduce Vercel Proxy with Validation ⚠️ NOT RECOMMENDED

**Approach:** Restore `api/extract-invoice.ts` proxy with server-side validation and rate limiting.

**Implementation:**
- Restore Vercel proxy function with:
  - File size validation (10MB)
  - IP-based rate limiting (10 req/min)
  - Upload frequency limits
  - JWT validation (as planned)
- Client calls `/api/extract-invoice` (not directly to FastAPI)

**Pros:**
- ✅ Server-side validation added back
- ✅ Rate limiting at proxy layer
- ✅ Client doesn't need changes

**Cons:**
- ❌ Reintroduces proxy layer (was trying to remove!)
- ❌ Adds 100-500ms latency back
- ❌ Defeats purpose of refactor (eliminate proxy)
- ❌ More infrastructure to maintain

**Effort:** 3-4 hours (restore proxy + add rate limiting)
**Risk:** Medium (undoes architectural improvement)

---

### Solution 3: Client-Side Request Deduplication ⚠️ PARTIAL MITIGATION

**Approach:** Add client-side deduplication to prevent rapid repeated uploads.

**Implementation:**
```typescript
// Track recent uploads in localStorage
const RECENT_UPLOADS_KEY = 'recent_invoice_uploads';
const DEDUP_WINDOW_MS = 60 * 1000; // 1 minute

async function extractInvoiceData(
  file: File,
  onProgress?: (progress: number) => void
): Promise<InvoiceOCRResult> {
  // Check for recent duplicate uploads
  const recentUploads = JSON.parse(
    localStorage.getItem(RECENT_UPLOADS_KEY) || '[]'
  ) as Array<{ fileHash: string; timestamp: number }>;
  
  const now = Date.now();
  const fileHash = await hashFile(file);
  
  // Reject if uploaded in last minute
  if (recentUploads.some(
    u => u.fileHash === fileHash && now - u.timestamp < DEDUP_WINDOW_MS
  )) {
    logger.warn('Duplicate upload rejected', { fileHash });
    return {
      success: false,
      error: 'Please wait 1 minute before uploading this file again.',
    };
  }
  
  // ... proceed with upload ...
  
  // Record upload
  recentUploads.push({ fileHash, timestamp: now });
  localStorage.setItem(RECENT_UPLOADS_KEY, JSON.stringify(recentUploads));
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
```

**Pros:**
- ✅ Prevents rapid duplicate uploads
- ✅ Client-side protection (works immediately)
- ✅ No server changes needed

**Cons:**
- ❌ Attackers can bypass (clear localStorage, use curl)
- ❌ Doesn't solve large file DoS
- ❌ Doesn't solve per-user rate limiting
- ❌ Adds complexity

**Effort:** 2-3 hours
**Risk:** High (attackers easily bypass)

## Recommended Action

**Choose Solution 1: Add Server-Side Validation to FastAPI**

**Rationale:**
- Server-side validation cannot be bypassed
- Per-user rate limiting prevents abuse
- Aligns with architecture (FastAPI handles auth, should handle validation too)
- Low effort for high security benefit
- Doesn't reintroduce proxy (maintains latency improvement)

**Execution Plan:**
1. Coordinate with FastAPI team on implementation
2. Add `slowapi` dependency to FastAPI (`pip install slowapi`)
3. Implement `get_user_id_from_token()` helper
4. Add rate limiting decorator to `/extract` endpoint: `@limiter.limit("5/minute")`
5. Add file size validation: `file.size > 10 * 1024 * 1024` → 413
6. Add file type validation: `content_type != "application/pdf"` → 400
7. Test with valid/invalid files:
   - 5MB file → success
   - 11MB file → 413 error
   - 100MB file (curl) → 413 error
   - 6 rapid uploads → 429 error on 6th
8. Deploy to staging FastAPI
9. Test staging with curl/Postman (bypass client validation)
10. Deploy to production FastAPI
11. Monitor for 413/429 errors (validate limits working)
12. Document rate limits in `docs/FASTAPI_INTEGRATION.md`

**DO NOT CHOOSE** Solution 2 - Reintroducing proxy defeats the purpose of this refactor.

## Acceptance Criteria

- [ ] FastAPI implements `get_user_id_from_token()` helper
- [ ] `slowapi` library added to FastAPI dependencies
- [ ] `/extract` endpoint has `@limiter.limit("5/minute")` decorator
- [ ] File size validation added (10MB limit, returns 413)
- [ ] File type validation added (PDF only, returns 400)
- [ ] Rate limiting works per user (based on JWT user_id)
- [ ] Large file (11MB) via curl → 413 error
- [ ] 6 rapid uploads → 429 error on 6th request
- [ ] Valid upload (5MB) → success
- [ ] Error messages are clear and actionable
- [ ] Staging deployment tested with curl/Postman
- [ ] Production deployment completed
- [ ] `docs/FASTAPI_INTEGRATION.md` updated with rate limits
- [ ] Monitoring shows 413/429 errors (validating limits)

## Work Log

### 2026-02-17 - Code Review Discovery

**By:** Claude Code (Security Sentinel Agent)

**Actions:**
- Reviewed client-side validation in `invoiceOCR.ts`
- Identified that server-side validation was removed with proxy
- Analyzed exploit scenarios for large file DoS and rate abuse
- Documented server-side validation requirements for FastAPI
- Created rate limiting implementation plan

**Learnings:**
- Client-side validation can always be bypassed
- Server-side validation is required for security
- Rate limiting prevents service abuse
- Per-user limits (based on JWT) are more effective than IP-based limits
- FastAPI already has JWT auth, adding validation is straightforward

**Next Steps:**
- Coordinate with FastAPI team
- Provide implementation requirements
- Test server-side validation with curl/Postman
- Update documentation

## Technical Details

**Affected Files:**
- `src/lib/invoiceOCR.ts:326-338` - Client-side validation (keep as defense in depth)
- FastAPI `main.py` (external repo) - Add server-side validation
- FastAPI `requirements.txt` (external repo) - Add `slowapi` dependency
- `docs/FASTAPI_INTEGRATION.md` - Document rate limits

**Related Components:**
- FastAPI service (external repo) - Requires validation implementation
- Vercel proxy (`api/extract-invoice.ts`) - DELETED (had server-side validation)

**Database Changes:**
- None (optional: track rate limit violations in database)

**API Changes:**
- FastAPI `/extract` endpoint: Add rate limiting decorator
- FastAPI `/extract` endpoint: Add file size/type validation
- FastAPI error responses: Return 413 (Payload Too Large), 429 (Too Many Requests)

## Resources

**FastAPI Documentation:**
- UploadFile: https://fastapi.tiangolo.com/tutorial/request-files/
- Exception Handlers: https://fastapi.tiangolo.com/tutorial/handling-errors/
- Rate Limiting: https://slowapi.readthedocs.io/

**Security References:**
- OWASP Input Validation: https://owasp.org/www-community/controls/Input_Validation_Cheat_Sheet
- Rate Limiting Best Practices: https://cheatsheetseries.owasp.org/cheatsheets/Unrestricted_Resource_Sending_Cheat_Sheet.html

**Code Review Agents:**
- Security Sentinel: Identified missing server-side validation
- Git History Analyzer: Confirmed proxy had validation

**Related Issues:**
- Depends on Issue #028 (FastAPI JWT auth required for user-based rate limiting)

---

## Notes

- **External Dependency:** Requires FastAPI team implementation
- **Coordination:** Must coordinate with FastAPI team on timeline
- **Testing:** Use curl/Postman to test bypassing client validation
- **Monitoring:** Track 413/429 errors to validate limits working
- **Documentation:** Update `docs/FASTAPI_INTEGRATION.md` with rate limit documentation
