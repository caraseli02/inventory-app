# Invoice Authentication Decision: Anonymous Access for MVP

**Date:** 2026-02-17
**Decision:** Remove authentication requirement from invoice feature for MVP

## Context

The invoice feature was refactored to use Supabase JWT authentication (`Authorization: Bearer {token}`) when calling FastAPI endpoints. However, the application lacks a sign-in/authentication flow, making the invoice feature completely non-functional.

## Decision

**Skip authentication setup entirely** for now. Invoice feature will work with **anonymous access** (no auth required).

## Rationale

### Speed to Ship

- **No auth UI needed:** No sign-in page, sign-up page, or auth provider required
- **Simpler code:** Removes all auth checks and error handling
- **Easier to test:** No need to manage sign-in flows during testing
- **Faster iteration:** Focus on invoice extraction quality, not auth UX

### MVP Focus

- **Core functionality:** Invoice OCR, data extraction, product import
- **Validation first:** Ensure invoice extraction works reliably
- **Iterate quickly:** Add auth later if/when needed
- **User tracking:** Can be added as enhancement (optional)

### Tradeoffs

| Aspect | With Auth | Without Auth (MVP) | Assessment |
|---------|-----------|-------------------|-----------|
| **Security** | High | Low | Acceptable for MVP |
| **User Tracking** | Yes | No | Add later |
| **Rate Limiting** | Per-user | None | Add later |
| **Abuse Prevention** | High | Low | Monitor in production |
| **Development Speed** | Slow (weeks) | Fast (days) | ✅ Better |
| **Testing Complexity** | High | Low | ✅ Better |
| **Code Complexity** | High | Low | ✅ Better |

## Implementation

### Client Changes

**Files Modified:**
- `src/lib/invoiceOCR.ts` - Removed auth imports, token checks, auth headers
- `src/lib/invoiceImportApi.ts` - Removed auth imports, token checks, async headers
- `src/components/invoice/InvoiceUploadDialog.tsx` - Remove auth state checks (optional)

**Key Changes:**

**invoiceOCR.ts:**
```typescript
// REMOVED: import { supabase } from './supabase';

// REMOVED: Auth token retrieval and validation
// const { data } = await supabase.auth.getSession();
// if (!token) { return error... }

// REMOVED: Authorization header
// headers.Authorization = `Bearer ${token}`;

// ADDED: Anonymous headers
const headers: Record<string, string> = {
  'Content-Type': 'multipart/form-data',
};
```

**invoiceImportApi.ts:**
```typescript
// REMOVED: import { supabase } from './supabase';

// REMOVED: Async getAuthHeaders function
// REMOVED: Token checks and errors

// SIMPLIFIED: Sync headers function
function getInvoiceApiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}
```

### FastAPI Changes (External Repo)

**Required Changes:**

**main.py:**
```python
# BEFORE: JWT required
@app.post("/extract")
async def extract_invoice(
    file: UploadFile = File(..., max_size=10 * 1024 * 1024),
    user: dict = Depends(verify_supabase_jwt)  # ← REMOVE
):
    # Process invoice...

# AFTER: Anonymous access
@app.post("/extract")
async def extract_invoice(
    file: UploadFile = File(..., max_size=10 * 1024 * 1024)  # ← No auth
):
    """
    Extract invoice data from PDF upload.
    
    Args:
        file: PDF file (max 10MB)
        user: Not required
    
    Returns:
        Extracted invoice data (products, supplier, etc.)
    """
    # Process invoice (OCR + GPT-4o)...
    return {"result": "success", "data": extracted_data}

@app.post("/invoice/preview-pricing")  # ← No auth
async def preview_pricing(
    payload: PreviewRequest
):
    """
    Preview pricing for imported products.
    
    Args:
        payload: Invoice import data
        user: Not required
    
    Returns:
        Pricing tiers (50%, 70%, 100%)
    """
    # Calculate pricing...
    return {"result": "success", "data": pricing_data}
```

**auth.py:**
- Remove file entirely or comment out all code

## Testing Checklist

### Client Testing

- [ ] Open app without signing in
- [ ] Navigate to Invoice tab
- [ ] Upload PDF file
- [ ] Verify extraction succeeds (no auth errors)
- [ ] Verify products are returned
- [ ] Test preview pricing works
- [ ] Browser console: No "supabase is not defined" errors
- [ ] No auth-related error messages shown

### FastAPI Testing

- [ ] `/extract` endpoint accepts requests without Authorization header
- [ ] `/invoice/preview-pricing` accepts requests without Authorization header
- [ ] File size validation still works (10MB max)
- [ ] File type validation still works (PDF only)
- [ ] OCR processing works correctly
- [ ] Pricing calculation works correctly

## Future Enhancements (Optional)

If authentication is needed later, can add:

1. **Sign-In Page:** Email/password form
2. **Sign-Up Page:** New account creation
3. **Auth Provider:** Global auth state management
4. **Protected Routes:** Wrap invoice feature with auth guard
5. **User Tracking:** Log who uploaded what invoices
6. **Per-User Rate Limiting:** 5 uploads per minute
7. **Audit Logging:** Track API usage per user
8. **Session Persistence:** Keep users signed in across refreshes

## Documentation Updates

**Files to Update:**

1. **`.env.example`:**
   - Remove auth-related env vars
   - Keep only: `VITE_INVOICE_API_URL`
   - Add note: "Invoice feature works anonymously (no auth required)"

2. **`README.md`:**
   - Document that invoice feature requires no authentication
   - Update feature list to reflect this

3. **`docs/INTEGRATION.md`:**
   - Update to mention anonymous access
   - Remove auth requirements from integration guide

## Related Issues

**Marked as Not Applicable/Deferred:**

- **#035** (Add Supabase sign-in flow) - DEFERRED (not needed for MVP)
- **#028** (FastAPI JWT validation) - NOT APPLICABLE (auth removed)
- **#029** (Token refresh mechanism) - NOT APPLICABLE (auth removed)

**Active Issues (Related to Invoice):**

- #001 (API key exposure) - Already resolved by removing auth
- #030 (Server-side rate limiting) - Still applicable (IP-based or global)

## Rollback Plan

If decision is reversed and authentication is needed:

1. **Restore client auth code:**
   ```bash
   git checkout HEAD~ -- src/lib/invoiceOCR.ts
   git checkout HEAD~ -- src/lib/invoiceImportApi.ts
   ```

2. **Restore FastAPI JWT validation:**
   ```python
   # Restore auth.py file
   # Add Depends(verify_supabase_jwt) to endpoints
   ```

3. **Update plan document:**
   - Reverse decision in this file
   - Update implementation checklist

## Conclusion

**Decision:** Invoice feature will work anonymously for MVP

**Benefits:**
- ✅ Simpler code (no auth complexity)
- ✅ Faster development (no auth UI to build)
- ✅ Easier to test (no sign-in flow)
- ✅ Ship faster (MVP approach)

**Tradeoffs:**
- ⚠️ No user tracking (who uploaded what)
- ⚠️ No per-user rate limiting (add later)
- ⚠️ Potential abuse (monitor in production)

**Next Steps:**
1. Test anonymous invoice upload end-to-end
2. Deploy to production
3. Monitor usage patterns
4. Consider auth as future enhancement if abuse or tracking needed

---

**Document Status:** Active
**Reviewed By:** Claude Code + User Decision
**Last Updated:** 2026-02-17
