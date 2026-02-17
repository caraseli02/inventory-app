---
status: pending
priority: p1
issue_id: "028"
tags: [security, deployment, critical, code-review]
dependencies: []
---

# FastAPI JWT validation must be deployed before client changes

## Problem Statement

The client code now sends `Authorization: Bearer {JWT}` tokens directly to FastAPI, but the FastAPI JWT validation implementation is **not yet deployed**. This creates a critical security vulnerability where the invoice extraction endpoint could be accessed anonymously if deployed without proper authentication.

**Critical Risk:** If client changes are deployed before FastAPI JWT validation is confirmed working, **anyone can call the `/extract` endpoint anonymously** - completely bypassing authentication and exposing the service to unlimited abuse.

## Findings

### Root Cause Analysis

**Location:** 
- `src/lib/invoiceOCR.ts:377-378`
- `src/lib/invoiceImportApi.ts:70`

**Client code assumes FastAPI validates JWT:**
```typescript
// Sends token, but FastAPI validation doesn't exist yet!
const headers: Record<string, string> = {
  Authorization: `Bearer ${token}`,
};
```

**Plan documentation states:**
> "Implementation: Use Supabase SDK for JWT validation (simpler than custom JWKS)."
> "Note: FastAPI code is in a separate repo. This plan documents required changes for the FastAPI team."

**Deployment sequence from plan:**
```markdown
### FastAPI Changes (FastAPI team)
- [ ] Create `auth.py` with Supabase SDK validation
- [ ] Implement `verify_supabase_jwt` dependency
- [ ] Update `/extract` route to require auth
- [ ] Update `/invoice/preview-pricing` route to require auth
- [ ] Test with valid/invalid/expired tokens
- [ ] Deploy to staging FastAPI
- [ ] Deploy to production FastAPI

### Client Updates (inventory-app repo)
- [ ] Update `src/lib/invoiceOCR.ts` to call FastAPI directly ✅ DONE
- [ ] Update `src/lib/invoiceImportApi.ts` to call FastAPI directly ✅ DONE
- [ ] Test locally with dev FastAPI
- [ ] Test with staging FastAPI
- [ ] Deploy to Vercel  ← MUST WAIT FOR FASTAPI
```

### Exploit Scenario (If Client Deployed First)

1. **Day 1:** Client deployed to production with JWT auth code
2. **Day 2:** FastAPI JWT validation **not yet deployed** (still old version)
3. **Day 3:** Attacker visits `lavio.vercel.app`
4. **Day 3:** Attacker uploads invoice PDF
5. **Day 3:** Client sends `Authorization: Bearer {JWT}` header
6. **Day 3:** FastAPI **ignores** JWT header (old endpoint)
7. **Day 3:** FastAPI processes invoice **anonymously** (no auth check)
8. **Day 3:** Attacker can now:
   - Abuse OCR service indefinitely (no rate limiting)
   - Extract any PDFs (unlimited)
   - Cause financial damage (if paid OCR service)
   - DDoS the service

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| Complete authentication bypass | 🔴 Critical | High | 10/10 |
| Financial damage (abuse) | 🔴 Critical | High | 10/10 |
| Service availability (DoS) | 🔴 Critical | Medium | 6/10 |
| Privacy violation | 🟠 High | Low | 3/10 |

**Overall Risk Score: 29/40** - Exceeds critical threshold

### Dependency Chain

This is a **blocking dependency** for the entire refactor:

```
FastAPI JWT Implementation
        ↓
FastAPI Staging Deploy
        ↓
FastAPI Production Deploy
        ↓
Client Deploy to Vercel  ← BLOCKED until above steps complete
```

## Proposed Solutions

### Solution 1: Strict Deployment Order ✅ RECOMMENDED

**Approach:** Enforce that FastAPI JWT validation is deployed **before** client changes go to production.

**Implementation Steps:**
1. **Create deployment checklist** with strict ordering:
   ```markdown
   ## Invoice Auth Refactor Deployment Checklist
   
   ### Phase 1: FastAPI (External Repo)
   - [ ] Create `auth.py` with Supabase SDK validation
   - [ ] Implement `verify_supabase_jwt` dependency
   - [ ] Update `/extract` route: `user: dict = Depends(verify_supabase_jwt)`
   - [ ] Update `/invoice/preview-pricing` route: `user: dict = Depends(verify_supabase_jwt)`
   - [ ] Test with valid JWT → 200 OK
   - [ ] Test with expired JWT → 401 Unauthorized
   - [ ] Test with invalid JWT → 401 Unauthorized
   - [ ] Deploy to staging FastAPI
   - [ ] Test staging end-to-end from `lavio.vercel.app`
   - [ ] **BLOCK CLIENT DEPLOY UNTIL THIS IS PRODUCTION**
   
   ### Phase 2: Client (inventory-app repo)
   - [ ] Deploy client to Vercel (only after FastAPI production confirmed)
   - [ ] Set `VITE_INVOICE_API_URL` to production FastAPI URL
   - [ ] Monitor for 401 errors (auth working indicator)
   - [ ] Monitor for anonymous access (should be zero)
   
   ### Phase 3: Post-Deployment
   - [ ] Verify FastAPI logs show JWT tokens being validated
   - [ ] Verify CORS logs show only allowed origins
   - [ ] Monitor for 401 errors (expected if user not signed in)
   ```

2. **Add pre-deploy validation**:
   ```bash
   # .github/workflows/deploy-client.yml
   - name: Verify FastAPI Auth is Deployed
     run: |
       # Test FastAPI endpoint rejects anonymous requests
       curl -X POST https://$FASTAPI_URL/extract \
         -F "file=@test.pdf" \
         --max-time 10 \
         --fail-with-body
       
       # Should return 401, not 200
       if [ $? -eq 0 ]; then
         echo "ERROR: FastAPI endpoint accepts anonymous requests!"
         echo "Client deployment BLOCKED. FastAPI JWT validation must be deployed first."
         exit 1
       fi
       
       echo "✅ FastAPI auth is deployed. Proceeding with client deployment."
   ```

3. **Manual verification**:
   ```bash
   # Before deploying client, manually test FastAPI auth
   curl -X POST https://your-fastapi-production.com/extract \
     -F "file=@test.pdf" \
     -v 2>&1 | grep "HTTP/1.1 401"
   
   # If 401 returned → FastAPI auth is working → Deploy client
   # If 200 returned → FastAPI auth NOT working → DO NOT DEPLOY CLIENT
   ```

**Pros:**
- ✅ Prevents critical security vulnerability
- ✅ Clear, documented deployment order
- ✅ Automated verification prevents human error
- ✅ Rollback plan exists if issues arise

**Cons:**
- ❌ Blocks client deployment until FastAPI is ready (could delay feature)
- ❌ Requires coordination with FastAPI team

**Effort:** 1-2 hours (deployment checklist + CI/CD validation)
**Risk:** Low (just enforces correct deployment order)

---

### Solution 2: Deploy Client First with Temporary Proxy Fallback ⚠️ NOT RECOMMENDED

**Approach:** Deploy client changes but keep Vercel proxy as fallback until FastAPI auth is ready.

**Implementation:**
```typescript
// invoiceOCR.ts - Add proxy fallback
const apiUrl = import.meta.env.VITE_INVOICE_API_URL;
const extractUrl = apiUrl
  ? `${apiUrl}/extract`
  : '/api/extract-invoice'; // ← Keep proxy until FastAPI auth ready

// Check if FastAPI auth is working
const response = await fetch(extractUrl, { ... });
if (response.status === 401 && apiUrl) {
  // FastAPI auth not working, retry with proxy
  logger.warn('FastAPI auth failed, falling back to proxy');
  const proxyResponse = await fetch('/api/extract-invoice', { ... });
  return proxyResponse;
}
```

**Pros:**
- ✅ Allows client deployment without waiting
- ✅ Progressive migration (canary release)
- ✅ Fallback to known-good proxy

**Cons:**
- ❌ Increases complexity (dual code paths)
- ❌ Proxy has security issues (but better than no auth)
- ❌ Hard to test (which path will be used?)
- ❌ Technical debt (must remove fallback later)

**Effort:** 4-6 hours (implement fallback + testing)
**Risk:** Medium (adds complexity, temporary solution)

---

### Solution 3: Delay Client Deployment ⚠️ ALTERNATIVE TO SOLUTION 1

**Approach:** Don't deploy client changes until FastAPI team confirms JWT auth is production-ready.

**Implementation:**
1. Create draft PR for client changes
2. Mark as "BLOCKED - Waiting for FastAPI JWT auth"
3. Do not merge until FastAPI team confirms:
   - JWT auth deployed to staging
   - JWT auth deployed to production
   - CORS configured with production origin
   - Tests passed (valid/expired/invalid tokens)
4. Merge and deploy client after confirmation

**Pros:**
- ✅ Clear communication of blocker
- ✅ Prevents premature deployment
- ✅ Git history shows dependency

**Cons:**
- ❌ No automated verification
- ❌ Relies on manual coordination
- ❌ Could cause merge conflicts (feature branch ages)

**Effort:** 30 minutes (create draft PR, add blocker label)
**Risk:** Medium (manual process, no automation)

## Recommended Action

**Choose Solution 1: Strict Deployment Order**

**Rationale:**
- Directly addresses the root cause (deployment order)
- Provides automated verification (CI/CD check)
- Documents clear dependency chain
- Aligns with security-first principles
- Minimal effort for maximum protection

**Execution Plan:**
1. Create deployment checklist in `docs/DEPLOYMENT_CHECKLIST.md`
2. Add pre-deploy CI/CD validation to `.github/workflows/deploy-client.yml`
3. Document rollback procedure (if FastAPI auth has bugs)
4. Coordinate with FastAPI team for staging deployment
5. Test staging end-to-end
6. Confirm FastAPI production deployment
7. Deploy client to Vercel
8. Monitor production for 24 hours
9. Verify auth logs show JWT validation

**DO NOT CHOOSE** Solution 2 - Temporary fallback adds complexity without solving the root problem.

## Acceptance Criteria

- [ ] FastAPI JWT validation deployed to **staging** and confirmed working
- [ ] FastAPI JWT validation deployed to **production** and confirmed working
- [ ] Test with valid JWT → 200 OK response
- [ ] Test with expired JWT → 401 Unauthorized response
- [ ] Test with invalid JWT → 401 Unauthorized response
- [ ] Test with no JWT → 401 Unauthorized response
- [ ] CORS configured with `https://lavio.vercel.app` origin
- [ ] Deployment checklist created in `docs/DEPLOYMENT_CHECKLIST.md`
- [ ] Pre-deploy CI/CD validation added to `.github/workflows/deploy-client.yml`
- [ ] Manual verification completed before client deployment
- [ ] Client deployed to production only after FastAPI auth confirmed
- [ ] Production logs show JWT tokens being validated
- [ ] No anonymous access in FastAPI logs
- [ ] Rollback procedure documented

## Work Log

### 2026-02-17 - Code Review Discovery

**By:** Claude Code (Security Sentinel + Architecture Strategist Agents)

**Actions:**
- Reviewed client code changes for invoice auth refactor
- Identified that FastAPI JWT validation is not yet implemented
- Analyzed exploit scenario if client deployed before FastAPI auth
- Created deployment checklist strategy
- Documented CI/CD pre-deploy verification approach

**Learnings:**
- Client-side JWT authentication is only secure if server validates it
- Deployment order is critical for distributed architecture changes
- Automated verification prevents human error in deployment
- Rollback plan essential for new authentication mechanisms

**Next Steps:**
- Present findings to team
- Coordinate with FastAPI team on implementation timeline
- Implement deployment checklist
- Add CI/CD pre-deploy validation

## Technical Details

**Affected Files:**
- `src/lib/invoiceOCR.ts:342-383` - JWT token handling
- `src/lib/invoiceImportApi.ts:56-78` - JWT token handling
- `.github/workflows/deploy-client.yml` - Pre-deploy validation (NEW)

**Related Components:**
- FastAPI service (external repo) - Needs `auth.py` implementation
- Vercel proxy (`api/extract-invoice.ts`) - DELETED (removed from codebase)

**Database Changes:**
- None

**API Changes:**
- FastAPI `/extract` endpoint: Add `Depends(verify_supabase_jwt)`
- FastAPI `/invoice/preview-pricing` endpoint: Add `Depends(verify_supabase_jwt)`
- New FastAPI route: `/auth/verify` (for CI/CD health check)

## Resources

**Plan Document:**
- `docs/plans/2026-02-16-refactor-invoice-auth-remove-proxy-plan.md`

**Code Review Agents:**
- Security Sentinel: Identified critical vulnerability
- Architecture Strategist: Recommended deployment strategy

**Documentation References:**
- Supabase Python SDK: https://supabase.com/docs/reference/python
- FastAPI Security: https://fastapi.tiangolo.com/tutorial/security/

**Related Issues:**
- Previous security fix: Issue #001 (API key exposure - solved with Vercel proxy)
- Rollback commit: `130fc98` - "fix(security): move invoice OCR auth to server-side proxy"

---

## Notes

- **CRITICAL:** Do not deploy client changes until FastAPI auth is confirmed in production
- **Rollback Plan:** If FastAPI auth has bugs, revert client to commit `130fc98` (proxy-based)
- **Monitoring:** Add alerts for 401 errors (expected) vs anonymous access (should be zero)
- **Timeline:** Coordinate with FastAPI team for 1-2 week implementation timeline
