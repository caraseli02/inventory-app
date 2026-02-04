---
status: complete
priority: p1
issue_id: "001"
tags: [security, code-review, critical]
dependencies: []
---

# Problem Statement

API key is exposed in production JavaScript bundle, completely compromising the authentication model for the FastAPI invoice extraction service.

**Critical Risk:** Anyone can extract the API key by inspecting network requests or viewing the production bundle, allowing them to abuse the OCR service indefinitely.

## Findings

### Root Cause Analysis

**Location:** `src/lib/invoiceOCR.ts:131-146`

```typescript
const apiKey = import.meta.env.VITE_INVOICE_API_KEY;  // ← BUNDLED INTO JS!
if (requireAuth || apiKey) {
  headers['X-API-Key'] = apiKey || '';
}
```

**Why it's exposed:**
- `VITE_` prefix → Environment variable is embedded in production bundle at build time
- API key sent in clear-text `X-API-Key` header
- Anyone can inspect DevTools → Network tab → Copy API key
- No server-side proxy or intermediary to protect credentials

### Exploit Scenario

1. Attacker visits production application
2. Opens Chrome DevTools → Network tab
3. Uploads an invoice (any PDF)
4. Inspects the `extract` request → Copies `X-API-Key` header value
5. Uses API key from curl/Postman to abuse service indefinitely:
   ```bash
   curl -X POST http://fastapi-service/extract \
     -H "X-API-Key: stolen-key-abc123" \
     -F "file=@malicious.pdf"
   ```
6. Can now:
   - Abuse OCR service without limits
   - Extract other users' invoice data (if server doesn't authenticate requests)
   - Cause financial damage (if paid OCR service)
   - DDoS the service

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| Complete authentication bypass | 🔴 Critical | High | 10/10 |
| Financial damage (abuse) | 🔴 Critical | High | 10/10 |
| Privacy violation (data exposure) | 🟠 High | Medium | 6/10 |
| Compliance violation (GDPR) | 🟠 High | Low | 3/10 |

**Overall Risk Score: 29/40** - Exceeds critical threshold

### Comparison with Previous Architecture

**Before (Phase 2 - Supabase Edge Functions):**
```typescript
// API keys stored server-side in Supabase secrets
const { data, error } = await supabase.functions.invoke('invoice-ocr', {
  body: { imageBase64 },
});
```
- ✅ API keys never exposed to client
- ✅ Server-side rate limiting possible
- ✅ Audit logging via Supabase
- ✅ Row-level security (RLS) policies

**After (Phase 3 - PR #91 - Current):**
```typescript
// API key embedded in client bundle
const apiKey = import.meta.env.VITE_INVOICE_API_KEY;
headers['X-API-Key'] = apiKey;
```
- ❌ API key exposed in bundle
- ❌ No rate limiting on client
- ❌ Easy to abuse service
- ❌ No audit capability

### Counter-Argument Check

**Claim:** "API key is only for FastAPI service, not Google Vision/OpenAI directly, so it's okay."

**Analysis:**
- True: Google Vision and OpenAI keys are still secure (managed by FastAPI service)
- But: FastAPI service itself can now be abused without authentication
- Net effect: Security regression for the application

**Verdict:** Insufficient mitigation. The application's authentication boundary is now vulnerable.

## Proposed Solutions

### Solution 1: Revert PR #91 - Keep Supabase Edge Functions ✅ RECOMMENDED

**Approach:** Revert to Phase 2 architecture with Supabase Edge Functions.

**Pros:**
- ✅ Immediate security fix (5 minutes)
- ✅ Proven production-ready architecture
- ✅ API keys secure server-side
- ✅ No code changes needed (just revert)
- ✅ Already has operational documentation

**Cons:**
- ❌ 2-step async process (slightly slower)
- ❌ Operational complexity (Supabase CLI deployment)
- ❌ Requires Supabase Edge Functions runtime

**Effort:** 5 minutes
**Risk:** None (returning to known-good state)

---

### Solution 2: Backend Proxy (Vercel Edge Function) ✅ RECOMMENDED

**Approach:** Create Vercel Edge Function that proxies requests to FastAPI, authenticating users server-side.

**Implementation:**
```typescript
// api/extract-invoice.ts (Vercel Edge Function)
export default async function handler(req: NextRequest) {
  // 1. Validate user (e.g., Supabase auth session)
  const user = await validateSupabaseSession(req);
  if (!user) return new Response('Unauthorized', { status: 401 });

  // 2. Get API key from server-side env (not client)
  const apiKey = process.env.INVOICE_API_KEY;  // Secure!

  // 3. Forward request to FastAPI
  const formData = await req.formData();
  const response = await fetch('http://fastapi/extract', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: formData,
  });

  return response;
}
```

**Client code:**
```typescript
// Remove VITE_INVOICE_API_KEY
const response = await fetch('/api/extract-invoice', {
  method: 'POST',
  body: formData,
});
```

**Pros:**
- ✅ API key secure server-side
- ✅ User authentication enforced
- ✅ Rate limiting possible
- ✅ Audit logging via Supabase
- ✅ Single API call (same UX)
- ✅ No deployment to external service (Vercel auto-deploys)

**Cons:**
- ⚠️ Requires Vercel Edge Function setup (1-2 hours)
- ⚠️ Adds one more hop in request path (negligible latency)

**Effort:** 1-2 hours
**Risk:** Low (standard Vercel pattern)

---

### Solution 3: Accept Risk with Mitigations ⚠️ LAST RESORT

**Approach:** Keep current implementation but add mitigations to reduce risk.

**Mitigations:**
1. IP whitelist in FastAPI service
2. Per-user API key rotation
3. Aggressive rate limiting on FastAPI
4. Monitoring and alerts for unusual usage
5. API key limited to specific domain (CORS)

**Pros:**
- ✅ No code changes
- ✅ Fast implementation

**Cons:**
- ❌ API key still exposed (just harder to abuse)
- ❌ Security through obscurity (defense-in-depth violation)
- ❌ Requires external service configuration changes
- ❌ Violates project's security-first principles

**Effort:** 2-4 hours (mostly configuration)
**Risk:** High (relying on external mitigations)

## Recommended Action

**Choose Solution 2: Backend Proxy (Vercel Edge Function)**

**Rationale:**
- Maintains single-call UX benefit of PR #91
- Secures API key server-side (fixes critical vulnerability)
- Follows project's existing patterns (already using Vercel)
- Adds user authentication (enforced via Supabase)
- Low effort (1-2 hours) with high security benefit

**Alternative:** If Vercel Edge Function is not viable, use Solution 1 (Revert PR #91).

**DO NOT CHOOSE** Solution 3 - Security through obscurity is insufficient.

## Acceptance Criteria

- [ ] API key is NOT present in client bundle (verify with `grep VITE_INVOICE_API_KEY dist/`)
- [ ] Authentication enforced server-side (no client-side `X-API-Key` header)
- [ ] User validation before proxying to FastAPI (e.g., Supabase session check)
- [ ] Unit tests verify API key is not sent from client
- [ ] Security review confirms fix
- [ ] Deployment tested (staging environment)
- [ ] Documentation updated (FASTAPI_INTEGRATION.md, .env.example)
- [ ] Breaking changes communicated (release notes, changelog)

## Work Log

### 2026-02-04 - Initial Finding

**By:** Security Sentinel Agent

**Actions:**
- Reviewed PR #91 code for security vulnerabilities
- Identified API key exposure in `src/lib/invoiceOCR.ts:131-146`
- Analyzed exploit scenarios and impact
- Compared with previous Supabase Edge Functions architecture
- Proposed 3 solutions with effort/risk assessment

**Learnings:**
- VITE_ prefixed env vars are ALWAYS embedded in production bundle
- Client-side API keys are NEVER acceptable for production
- Backend proxy pattern is standard security practice for external API integrations
- Previous architecture (Phase 2) had correct security model

**Next Steps:**
- Awaiting triage decision
- If approved, implement Solution 2 (Backend Proxy)
- Update .env.example to remove VITE_INVOICE_API_KEY
- Add INVOICE_API_KEY to Vercel environment variables

---

## Technical Details

**Affected Files:**
- `src/lib/invoiceOCR.ts:131-146` - API key handling code
- `.env.example:97-99` - Environment variable documentation
- `docs/FASTAPI_INTEGRATION.md` - Integration guide (needs update)

**Related Components:**
- `InvoiceUploadDialog.tsx` - Calls `extractInvoiceData()` (no changes needed)
- FastAPI service (external) - Needs configuration update for IP whitelist/rate limiting

**Database Changes:**
- None

**API Changes:**
- New endpoint needed: Vercel Edge Function `/api/extract-invoice`
- Existing FastAPI `/extract` endpoint: No changes needed (unless adding IP whitelist)

## Resources

**Related PR:**
- PR #91: feat(invoice): Replace Supabase Edge Functions with FastAPI /extract endpoint
- Branch: feat/fastapi-invoice-extraction

**Documentation:**
- Current: docs/FASTAPI_INTEGRATION.md
- Reference: docs/SUPABASE_EDGE_FUNCTIONS.md (Phase 2 architecture)

**Security References:**
- OWASP Client-Side Secrets: https://owasp.org/www-community/attacks/Cleartext_transmission_of_sensitive_information
- Vercel Edge Functions Authentication: https://vercel.com/docs/concepts/functions/edge-functions/middleware
- Best Practices for API Key Management: https://cloud.google.com/docs/api-management/best-practices-for-managing-api-keys

**Related Issues:**
- Git history shows previous security migration: commit 484e401 (Dec 18, 2025)
