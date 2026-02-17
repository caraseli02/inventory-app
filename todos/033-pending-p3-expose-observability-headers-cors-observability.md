---
status: pending
priority: p3
issue_id: "033"
tags: [performance, observability, cors, code-review]
dependencies: ["028"]
---

# Expose observability headers in CORS configuration

## Problem Statement

Client code tries to read observability headers (`x-extract-cache`, `x-instance-id`, `x-process-id`) from FastAPI responses for debugging and monitoring, but **CORS blocks access to these headers** in direct browser mode.

**Low Risk:** Reduced observability makes debugging performance issues and cache behavior more difficult.

## Findings

### Root Cause Analysis

**Location:** `src/lib/invoiceOCR.ts:457-481`

**Client code (attempts to read headers):**
```typescript
// Cache/debug observability headers (if backend supports them).
// Useful to diagnose "no speedup" reports (cache disabled, misses, or multi-worker).
try {
  const extractCache = response.headers.get('x-extract-cache') || undefined;
  const instanceId = response.headers.get('x-instance-id') || undefined;
  const processId = response.headers.get('x-process-id') || undefined;
  // Treat file hash as sensitive debug-only metadata. Do not log by default.
  const debugHeadersEnabled =
    import.meta.env.DEV ||
    String(import.meta.env.VITE_INVOICE_DEBUG_HEADERS || '')
      .trim()
      .toLowerCase() === 'true';
  const fileHash = debugHeadersEnabled ? response.headers.get('x-extract-file-hash') || undefined : undefined;

  if (extractCache || instanceId || processId || fileHash) {
    logger.info('Invoice extract observability', {
      url: extractUrl,
      status: response.status,
      extractCache,
      instanceId,
      processId,
      ...(fileHash ? { fileHash } : {}),
    });
  }
} catch {
  // If CORS blocks header access in direct-dev mode, ignore.
}
```

**Issue:** CORS blocks custom headers by default. Browser cannot read `x-extract-cache`, `x-instance-id`, `x-process-id` unless explicitly exposed.

### Current CORS Configuration (from Plan)

**FastAPI CORS (expected):**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://lavio.vercel.app",  # Production
        "http://localhost:5173",     # Dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Missing:** `expose_headers` parameter!

### CORS Behavior

**CORS restrictions for custom headers:**
```
Browser can read: ✅
- Content-Type
- Content-Length
- Cache-Control
- Expires
- Last-Modified
- ETag
- Authorization (response)
- WWW-Authenticate

Browser CANNOT read: ❌
- x-extract-cache (custom)
- x-instance-id (custom)
- x-process-id (custom)
- x-extract-file-hash (custom)
```

**Unless** `expose_headers` is configured:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://lavio.vercel.app", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-extract-cache", "x-instance-id", "x-process-id"]  # ← ADD THIS
)
```

### Impact Assessment

| Impact | Severity | Likelihood |
|--------|----------|------------|
| Harder debugging | 🟢 Low | Medium |
| Can't track cache behavior | 🟢 Low | Medium |
| Can't identify instance/process | 🟢 Low | Medium |
| Reduced observability | 🟢 Low | Medium |

**Overall Risk:** Low - Nice-to-have improvement, not blocking

### Why This Matters

**Observability headers provide:**
- `x-extract-cache`: Whether OCR result was cached (cache hit/miss/none)
- `x-instance-id`: Which FastAPI instance processed request (useful for scaling issues)
- `x-process-id`: Unique request ID (trace distributed systems)
- `x-extract-file-hash`: File content hash (detect duplicate uploads)

**Debugging scenarios:**
1. **Cache issues:** "Why is extraction slow?" → Check `x-extract-cache`
2. **Scaling issues:** "Which instance is slow?" → Check `x-instance-id`
3. **Request tracing:** "Where did the request fail?" → Check `x-process-id`
4. **Duplicate detection:** "Did we process this file before?" → Check `x-extract-file-hash`

## Proposed Solutions

### Solution 1: Add `expose_headers` to FastAPI CORS ✅ RECOMMENDED

**Approach:** Update FastAPI CORS middleware to expose observability headers.

**Implementation:**

**FastAPI `main.py` (external repo):**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://lavio.vercel.app",  # Production
        "http://localhost:5173",     # Dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "x-extract-cache",     # Cache hit/miss/none
        "x-instance-id",        # Processing instance ID
        "x-process-id",        # Request tracing ID
        "x-extract-file-hash"  # File content hash (debug only)
    ]
)
```

**Update client code (remove try-catch):**
```typescript
// src/lib/invoiceOCR.ts:457-481

// Before (with try-catch for CORS blocking):
try {
  const extractCache = response.headers.get('x-extract-cache') || undefined;
  const instanceId = response.headers.get('x-instance-id') || undefined;
  const processId = response.headers.get('x-process-id') || undefined;
  const debugHeadersEnabled = ...;
  const fileHash = debugHeadersEnabled ? response.headers.get('x-extract-file-hash') : undefined;

  if (extractCache || instanceId || processId || fileHash) {
    logger.info('Invoice extract observability', { ... });
  }
} catch {
  // If CORS blocks header access in direct-dev mode, ignore.
}

// After (no try-catch needed):
const extractCache = response.headers.get('x-extract-cache') || undefined;
const instanceId = response.headers.get('x-instance-id') || undefined;
const processId = response.headers.get('x-process-id') || undefined;
const debugHeadersEnabled =
  import.meta.env.DEV ||
  String(import.meta.env.VITE_INVOICE_DEBUG_HEADERS || '')
    .trim()
    .toLowerCase() === 'true';
const fileHash = debugHeadersEnabled ? response.headers.get('x-extract-file-hash') : undefined;

if (extractCache || instanceId || processId || fileHash) {
  logger.info('Invoice extract observability', {
    url: extractUrl,
    status: response.status,
    extractCache,
    instanceId,
    processId,
    ...(fileHash ? { fileHash } : {}),
  });
}
```

**Pros:**
- ✅ Enables observability in production
- ✅ Easier debugging of performance issues
- ✅ Can track cache behavior
- ✅ Can trace requests across systems
- ✅ Removes try-catch (simpler code)
- ✅ Minimal FastAPI change

**Cons:**
- ❌ Requires FastAPI team changes (external repo)

**Effort:** 15 minutes (FastAPI side)
**Risk:** Low (standard CORS configuration)

---

### Solution 2: Use Query Parameters for Observability ⚠️ ALTERNATIVE

**Approach:** Return observability data in JSON response body instead of headers.

**Implementation:**

**FastAPI response:**
```python
# Instead of headers:
return {
    "result": "success",
    "data": extracted_data,
    "observability": {  # ← Add to response body
        "cache": "hit",
        "instance_id": "instance-123",
        "process_id": "proc-456"
    }
}
```

**Client code:**
```typescript
// Read from response body instead of headers
const responseData = await response.json();
const { extractCache, instanceId, processId } = responseData.observability || {};

logger.info('Invoice extract observability', {
  extractCache,
  instanceId,
  processId,
});
```

**Pros:**
- ✅ No CORS issues (in response body)
- ✅ More structured data
- ✅ Easier to type-check

**Cons:**
- ❌ Changes API response structure (breaking change)
- ❌ Requires FastAPI and client updates
- ❌ Mixes business logic with observability data
- ❌ Harder to read from DevTools (headers vs JSON)

**Effort:** 1-2 hours (FastAPI + client)
**Risk:** Medium (API contract change)

---

### Solution 3: Remove Observability Headers Entirely ⚠️ NOT RECOMMENDED

**Approach:** Remove client code that tries to read observability headers.

**Implementation:**
```typescript
// src/lib/invoiceOCR.ts:457-481

// Delete all observability header reading code
// Replace with simple log:
logger.info('Invoice extraction completed', {
  url: extractUrl,
  status: response.status,
});
```

**Pros:**
- ✅ No CORS issues
- ✅ Simpler code
- ✅ No external dependencies

**Cons:**
- ❌ Loses observability data
- ❌ Harder to debug issues
- ❌ Can't track cache behavior
- ❌ Can't trace requests

**Effort:** 5 minutes (delete code)
**Risk:** Low (loses debugging capability)

## Recommended Action

**Choose Solution 1: Add `expose_headers` to FastAPI CORS**

**Rationale:**
- Minimal effort (15 minutes FastAPI change)
- Enables full observability in production
- No API contract changes (headers already sent)
- Standard CORS configuration
- Removes try-catch from client (simpler code)
- Critical for debugging production issues

**Execution Plan:**
1. Coordinate with FastAPI team on CORS update
2. Update FastAPI `main.py` with `expose_headers`:
   - Add `x-extract-cache`
   - Add `x-instance-id`
   - Add `x-process-id`
   - Add `x-extract-file-hash`
3. Deploy to staging FastAPI
4. Test staging: Verify headers are readable in browser
5. Deploy to production FastAPI
6. Update client code (remove try-catch)
7. Test production: Verify observability logs contain header values
8. Update `docs/FASTAPI_INTEGRATION.md` with CORS documentation

**DO NOT CHOOSE** Solution 2 - Breaking API change for observability is disproportionate.

## Acceptance Criteria

- [ ] FastAPI CORS `expose_headers` includes `x-extract-cache`
- [ ] FastAPI CORS `expose_headers` includes `x-instance-id`
- [ ] FastAPI CORS `expose_headers` includes `x-process-id`
- [ ] FastAPI CORS `expose_headers` includes `x-extract-file-hash`
- [ ] Staging deployment tested: Headers readable in browser
- [ ] Production deployment tested: Headers readable in browser
- [ ] Client logs show observability header values
- [ ] Try-catch removed from `invoiceOCR.ts:457-481`
- [ ] `docs/FASTAPI_INTEGRATION.md` updated with CORS documentation
- [ ] Browser DevTools confirms headers are present

## Work Log

### 2026-02-17 - Code Review Discovery

**By:** Claude Code (Architecture Strategist + Performance Oracle Agents)

**Actions:**
- Reviewed client code for observability header reading
- Identified CORS blocking custom headers
- Analyzed FastAPI CORS configuration
- Documented `expose_headers` solution
- Evaluated alternative approaches (query params, removal)

**Learnings:**
- CORS blocks custom headers by default
- `expose_headers` is standard FastAPI CORS parameter
- Observability headers valuable for debugging
- Headers preferred over response body (separation of concerns)
- Minimal effort for significant debugging improvement

**Next Steps:**
- Coordinate with FastAPI team
- Implement CORS `expose_headers`
- Verify headers are readable in browser
- Update client code

## Technical Details

**Affected Files:**
- `src/lib/invoiceOCR.ts:457-481` - Remove try-catch
- FastAPI `main.py` (external repo) - Add `expose_headers`
- `docs/FASTAPI_INTEGRATION.md` - Update CORS documentation

**Related Components:**
- FastAPI service - CORS middleware
- Browser DevTools - Headers panel (for verification)

**Database Changes:**
- None

**API Changes:**
- FastAPI CORS: Add `expose_headers` parameter

## Resources

**FastAPI Documentation:**
- CORSMiddleware: https://fastapi.tiangolo.com/tutorial/cors/
- `expose_headers`: https://fastapi.tiangolo.com/api-reference/?mod=fastapi.middleware.cors

**Code Review Agents:**
- Architecture Strategist: Identified observability header issue
- Performance Oracle: Confirmed headers not readable in direct mode

**Related Issues:**
- Blocked by Issue #028 (FastAPI JWT deployment required first)

---

## Notes

- **External Dependency:** Requires FastAPI team to update CORS config
- **Browser Testing:** Use DevTools → Network tab → Headers to verify
- **Monitoring:** Add alerts for unusual observability values (e.g., all misses)
- **Documentation:** Update `docs/FASTAPI_INTEGRATION.md` with CORS `expose_headers` list
