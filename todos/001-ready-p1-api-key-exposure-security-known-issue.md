---
status: complete
priority: p1
issue_id: "001"
tags: [security, code-review, critical, known-issue, architectural-decision]
dependencies: []
---

# Problem Statement

API key is exposed in production JavaScript bundle via `VITE_INVOICE_API_KEY` environment variable, allowing anyone to extract it and abuse the FastAPI OCR service.

## Findings

### Root Cause

**Location**: `src/lib/invoiceOCR.ts:131-146`

```typescript
const apiKey = import.meta.env.VITE_INVOICE_API_KEY;  // ← BUNDLED INTO JS!
if (requireAuth || apiKey) {
  headers['X-API-Key'] = apiKey || '';
}
```

**Why it's exposed:**
- `VITE_` prefix → Environment variable embedded in production bundle at build time
- API key sent in clear-text `X-API-Key` header
- Anyone can inspect DevTools → Network tab → Copy API key
- No server-side proxy or authentication layer

### Attack Scenario

1. Attacker visits production application
2. Opens Chrome DevTools → Network tab
3. Uploads an invoice (any PDF)
4. Inspects `extract` request → Copies `X-API-Key` header value
5. Uses extracted key to call FastAPI `/extract` indefinitely from curl/Postman
6. Can now:
   - Abuse OCR service without limits
   - Process other users' invoice data (if FastAPI doesn't validate)
   - Cause financial damage (if paid OCR service)
   - Violate data privacy

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| Complete authentication bypass | 🔴 Critical | High | 10/10 |
| API service abuse | 🔴 Critical | High | 9/10 |
| Financial damage | 🟠 High | Medium | 6/10 |
| Privacy violation | 🟠 High | Low | 4/10 |
| Regulatory compliance (GDPR) | 🟠 High | Low | 3/10 |

**Overall Risk Score**: 32/40** - **Exceeds critical threshold (25+)**

## Proposed Solutions

### Solution 1: Revert PR #91 (Keep Supabase Edge Functions) ✅ RECOMMENDED

**Approach:** Revert to Phase 2 architecture with Supabase Edge Functions.

**Pros:**
- ✅ Immediate security fix (5 minutes)
- ✅ Proven production-ready architecture
- ✅ API keys secure server-side
- ✅ Server-side rate limiting possible
- ✅ Audit logging via Supabase
- ✅ No code changes needed (just revert)

**Cons:**
- ❌ 2-step async process (slightly slower)
- ❌ Operational complexity (Supabase CLI deployment)
- ❌ Cold start latency on Edge Functions

**Effort:** 5 minutes
**Risk:** None (returning to known-good state)

**Recommendation:** **STRONGLY RECOMMENDED** for production security

---

### Solution 2: Backend Proxy (Vercel Edge Function) ✅ RECOMMENDED

**Approach:** Create Vercel Edge Function as proxy to FastAPI, moving API key server-side.

**Architecture**:
```
Client → Vercel Edge Function (/api/extract-invoice)
  → Validates Supabase user session
  → Forwards request to FastAPI (/extract)
  → Stores API key server-side (Vercel env var)
  → Returns result to client
```

**Pros:**
- ✅ API key never exposed to client
- ✅ User authentication enforced
- ✅ Server-side rate limiting
- ✅ Audit logging via Supabase + Vercel
- ✅ Defense-in-depth (client + server validation)
- ✅ Single API call UX maintained

**Cons:**
- ⚠️ Additional hop in request path (minimal latency impact)
- ⚠️ Requires Vercel deployment (1-2 hours setup)
- ⚠️ New endpoint to maintain (/api/extract-invoice)

**Effort:** 1-2 hours
**Risk:** Low (standard Vercel pattern)

**Recommendation:** **RECOMMENDED for production** - Best balance of security and simplicity

**Documentation:** See `docs/FASTAPI_SECURITY_GUIDE.md` for full implementation details

---

### Solution 3: Accept Risk with Mitigations ⚠️ LAST RESORT

**Approach:** Proceed with client-side API key but implement security mitigations.

**Mitigations:**
1. IP whitelist on FastAPI service (restrict to production IPs only)
2. Per-user API key rotation (weekly/monthly)
3. Aggressive rate limiting on FastAPI (100 requests/day/user)
4. Monitoring and alerts for unusual usage patterns
5. CORS domain validation (only allow production origin)
6. Request validation on FastAPI (file type, size, sanitization)

**Pros:**
- ✅ No additional development effort
- ✅ Preserves current architecture
- ✅ Fast implementation

**Cons:**
- ❌ API key still exposed (just harder to abuse)
- ❌ Requires external service coordination (FastAPI changes)
- ❌ Mitigations add operational overhead
- ❌ Still violates security best practices

**Effort:** 2-4 hours (mostly configuration)
**Risk:** Medium (acceptable for pre-production only)

**Recommendation:** Only acceptable for pre-production environments, NOT for production

---

### Solution 4: Document and Accept Risk

**Approach:** Document the security trade-off in ADR and security guide, accept the risk as calculated business decision.

**What This Means:**
- Acknowledge the API key exposure is a deliberate architectural choice
- Document rationale (operational simplicity > security)
- Document mitigations that make it acceptable
- Require sign-off from security team
- Create incident response plan
- Commit to monitoring and periodic reviews

**Pros:**
- ✅ Clear documentation of decision rationale
- ✅ Known issue tracked with mitigations
- ✅ Team alignment on security posture
- ✅ Posture can be reviewed and updated

**Cons:**
- ⚠️ Security risk not eliminated
- ⚠️ Requires ongoing vigilance and monitoring
- ⚠️ May limit future architectural flexibility

**Effort:** 30-60 minutes (documentation already created in this todo)
**Risk:** Medium (depends on mitigations implemented)

---

## Recommended Action

**Implement Solution 2 (Backend Proxy with Vercel Edge Function)**

**Rationale:**
1. Best balance of security and operational simplicity
2. Addresses critical API key exposure vulnerability
3. Follows industry best practices for client-side API integrations
4. Low effort (1-2 hours) compared to re-architecting
5. Maintains current FastAPI service (no changes needed)

**Implementation Path:**
1. Create Vercel Edge Function at `api/extract-invoice/index.ts`
2. Deploy to Vercel (automatic with git push)
3. Set `INVOICE_API_KEY` in Vercel environment variables
4. Update client code to use `/api/extract-invoice` endpoint
5. Add Supabase auth validation in Edge Function
6. Remove `VITE_INVOICE_API_KEY` from client code
7. Update `docs/FASTAPI_INTEGRATION.md` with proxy instructions

**Alternative If Vercel Not Available:**
- Implement Solution 3 (Mitigations) if proxy cannot be used
- Consider reverting to Supabase Edge Functions (Solution 1)

**Next Steps:**
1. Create PR for Vercel Edge Function implementation
2. Security review before production deployment
3. Load testing with proxy
4. Monitor for 6 weeks post-deployment
5. Update ADR-0005 with proxy implementation decision

## Acceptance Criteria

### For Solution 2 (Vercel Proxy - Recommended)
- [ ] Vercel Edge Function created at `api/extract-invoice/index.ts`
- [ ] Edge Function validates Supabase user session before proxying
- [ ] API key stored in Vercel environment variables (not in client bundle)
- [ ] Client code updated to use `/api/extract-invoice` endpoint
- [ ] `VITE_INVOICE_API_KEY` removed from client code and `.env.example`
- [ ] Integration tests pass (unit + e2e with proxy)
- [ ] Load testing completed (simulated traffic)
- [ ] Security review completed and approved
- [ ] Production deployed successfully
- [ ] Monitoring operational for 6+ weeks
- [ ] No API key exposure in production bundle
- [ ] Documentation updated (FASTAPI_INTEGRATION.md, security guide)

### For Current Implementation (Interim)
- [ ] Security guide reviewed by team
- [ ] Incident response plan created
- [ ] ADR-0005 documenting decision rationale
- [ ] Mitigations documented (IP whitelist, rate limiting, monitoring)
- [ ] Monitoring tools selected and configured
- [ ] API key rotation schedule established
- [ ] Team trained on security posture

## Documentation References

**Decision Record:** [ADR-0005](docs/adrs/ADR-0005-invoice-ocr-architecture-evolution.md)
- Documents security trade-off and rationale
- Provides context for future developers

**Security Guide:** [FASTAPI_SECURITY_GUIDE.md](docs/FASTAPI_SECURITY_GUIDE.md)
- Complete mitigation strategies
- Deployment modes (local, pre-production, production)
- Monitoring and alerting configuration
- Incident response plan

**Integration Guide:** [FASTAPI_INTEGRATION.md](docs/FASTAPI_INTEGRATION.md)
- Will be updated with proxy implementation details
- Currently documents direct client-side API approach

## Work Log

### 2026-02-04 - Initial Documentation

**By:** Claude Code

**Actions:**
- Created ADR-0005 documenting FastAPI architecture evolution and security trade-offs
- Created comprehensive security guide with mitigations and best practices
- Marked todo as `ready` (documented, awaiting decision)
- Analyzed 4 solution approaches with effort/risk assessment

**Learnings:**
- Security through obscurity is not security
- Documentation is critical for architectural decisions
- Multiple valid paths exist (revert, proxy, mitigate)
- Team should choose based on production requirements and timeline

**Next Steps:**
- Awaiting triage decision from product team
- If Solution 2 (Vercel proxy) chosen: Implement and test
- If Solution 3 (mitigations) chosen: Configure FastAPI with mitigations
- If Solution 1 (revert) chosen: Revert PR #91

**Status:** Ready for triage - All solutions documented with clear pros/cons
