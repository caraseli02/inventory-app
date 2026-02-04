# ADR-0005: Invoice OCR Architecture Evolution

- **Status**: Accepted
- **Date**: 2026-02-04
- **Deciders**: Product Engineering Team
- **Related ADRs**: [ADR-0001](./ADR-0001-airtable-proxy.md)

---

## Context

The invoice OCR feature has evolved through **3 architectural iterations** in 48 days:

### Phase 1: Initial Implementation (Dec 17, 2025)
- **Approach**: Direct client-side APIs (Google Vision + GPT-4o mini)
- **Architecture**: Client → Google Vision API & OpenAI API
- **Duration**: 1 day

**Issues**:
- ⚠️ **Security**: API keys embedded in production JavaScript bundle
- ⚠️ **Authentication**: No authentication mechanism

**Resolution**: Security migration (Phase 2) - **1 day later**

---

### Phase 2: Supabase Edge Functions (Dec 18, 2025)
- **Approach**: Supabase Edge Functions proxy
- **Architecture**: Client → Supabase Edge Functions (invoice-ocr + invoice-parse) → Google Vision + GPT-4o
- **Duration**: 1.5 months

**Benefits**:
- ✅ **Security**: API keys stored server-side in Supabase secrets
- ✅ **Row-Level Security**: RLS policies possible
- ✅ **Audit Logging**: Supabase provides structured logging
- ✅ **Rate Limiting**: Server-side enforcement possible

**Issues**:
- ⚠️ **Operational Complexity**: Two async steps (OCR → Parse)
- ⚠️ **Deployment**: Requires `supabase functions deploy`
- ⚠️ **Latency**: Cold start on Edge Functions
- ⚠️ **Debugging**: Distributed system harder to debug

**Resolution**: Architectural simplification (Phase 3) - **1.5 months later**

---

### Phase 3: FastAPI Direct Integration (Feb 3, 2026 - PR #91)
- **Approach**: Direct client-side calls to FastAPI `/extract` endpoint
- **Architecture**: Client → FastAPI /extract → Google Vision + GPT-4o
- **Duration**: Current

**Benefits**:
- ✅ **Simplified Architecture**: Single API call (no orchestration)
- ✅ **Operational Simplicity**: Docker-based deployment (local development)
- ✅ **Faster Development Cycle**: No Supabase deployment steps
- ✅ **Type Safety**: Comprehensive test coverage (490 lines)
- ✅ **Documentation**: Production-ready integration guide (693 lines)

**Issues**:
- 🔴 **Security**: API key embedded in production JavaScript bundle (`VITE_INVOICE_API_KEY`)
- ⚠️ **Authentication**: Client-side header (`X-API-Key`)
- ⚠️ **Network**: No timeout handling, fake progress reporting
- ⚠️ **Breaking Change**: PDF-only support (previously JPG/PNG/PDF)

---

## Decision

**Implement FastAPI direct integration for invoice OCR with client-side API key authentication, accepting the security trade-offs for operational simplicity and reduced deployment complexity.**

**Rationale**:
1. **Operational Reality**: After 1.5 months of production use, Supabase Edge Functions proved too complex for daily operations
2. **Developer Experience**: Supabase CLI deployment and cold starts added friction to development workflow
3. **User Requirements**: PDF is the dominant invoice format (90%+ of B2B invoicing)
4. **Testing Maturity**: Team now prioritizes test coverage (Phase 3: 490 lines vs Phase 1-2: 0 lines)
5. **Fast API**: Single endpoint reduces latency vs two-step Edge Function approach

---

## Consequences

### Positive Consequences

- **Simplified Operations**: Single Docker deployment vs Supabase Edge Functions
- **Faster Development**: No deployment steps, local development with hot reload
- **Better UX**: Single API call (half the latency of two-step process)
- **Comprehensive Testing**: 490 lines of unit tests ensure confidence in refactoring
- **Production-Ready Documentation**: 693-line integration guide with troubleshooting

### Negative Consequences

- **Security Trade-off**: `VITE_INVOICE_API_KEY` exposed in production JavaScript bundle
  - Anyone can extract API key via DevTools Network tab
  - Attacker can use extracted key to abuse OCR service indefinitely
  - **Risk Assessment**: High likelihood, critical impact (authentication bypass, financial damage, privacy violation)

- **No Rate Limiting**: Client cannot enforce throttling
  - API can be abused by extracting key and calling from multiple sources
  - **Risk Assessment**: Medium likelihood, high impact (service abuse, cost increase)

- **Missing Server-Side Validation**: File validation happens client-side only
  - Attacker can bypass validation by crafting custom requests
  - **Risk Assessment**: Medium likelihood, high impact (malicious file upload, data corruption)

- **Breaking Change**: PDF-only support (removed JPG/PNG support)
  - Users with image-based invoices must convert to PDF
  - **Risk Assessment**: Low likelihood, medium impact (user friction, migration required)

- **Authentication Surface**: No user authentication required for OCR
  - Anyone with app access can extract invoices
  - **Risk Assessment**: Medium likelihood, medium impact (privacy exposure if FastAPI doesn't validate)

---

## Alternatives Considered

### Alternative 1: Maintain Supabase Edge Functions
**Description**: Continue with Phase 2 architecture (server-side proxy)

**Pros**:
- ✅ Server-side security (API keys secure)
- ✅ Row-Level Security (RLS) policies possible
- ✅ Server-side validation
- ✅ Rate limiting possible
- ✅ Audit logging via Supabase

**Cons**:
- ❌ Operational complexity (two async steps)
- ❌ Deployment friction (Supabase CLI required)
- ❌ Cold start latency on Edge Functions
- ❌ Harder debugging (distributed system)

**Decision**: **Rejected** - Operational complexity outweighs security benefits for this use case

**Evidence**: 1.5 months of production experience showed complexity issues

---

### Alternative 2: Vercel Edge Function Proxy
**Description**: Create Vercel Edge Function as proxy to FastAPI, moving API key server-side

**Architecture**:
```
Client → Vercel Edge Function (/api/extract-invoice)
  → Validates user (Supabase auth session)
  → Forwards request to FastAPI (/extract)
  → Stores API key server-side (Vercel env vars)
```

**Pros**:
- ✅ Server-side security (API key secure)
- ✅ User authentication (Supabase auth enforcement)
- ✅ Rate limiting possible (at Vercel layer)
- ✅ Single API call UX maintained
- ✅ Audit logging via Supabase + Vercel
- ✅ Minimal deployment (automatic with Vercel)
- ✅ Defense-in-depth (client + server validation)

**Cons**:
- ⚠️ Additional hop in request path (minimal latency impact)
- ⚠️ Requires Vercel deployment (1-2 hours setup)
- ⚠️ New endpoint to maintain (/api/extract-invoice)

**Decision**: **Not Adopted** (Phase 3) - Time constraints and existing FastAPI service availability

**Future Consideration**: Recommended for production if security requirements tighten

---

### Alternative 3: Accept Risk with Mitigations
**Description**: Proceed with client-side API key but implement security mitigations

**Mitigations**:
- IP whitelist on FastAPI service (restrict to production IPs)
- Per-user API key rotation (weekly/monthly)
- Aggressive rate limiting on FastAPI (100 requests/day/user)
- Monitoring and alerts for unusual usage patterns
- CORS domain validation (only allow production origin)

**Pros**:
- ✅ No additional development effort
- ✅ Preserves current architecture
- ✅ Fast implementation

**Cons**:
- ⚠️ API key still exposed (just harder to abuse)
- ⚠️ Requires external service coordination (FastAPI changes)
- ⚠️ Mitigations add operational overhead
- ⚠️ Still violates security best practices

**Decision**: **Not Adopted** (Phase 3) - Mitigations insufficient for production security

**Future Consideration**: Acceptable for pre-production/staging environments only

---

## Implementation Notes

### Current Implementation (Phase 3)

**File**: `src/lib/invoiceOCR.ts`
**Key Components**:
- `extractInvoiceData()` - Main extraction function
- `uploadWithProgress()` - XMLHttpRequest with progress tracking
- `validateProduct()` - Runtime type validation
- `isValidNumber()` - Number validation helper

**Configuration**:
```typescript
// Environment variables
VITE_INVOICE_API_URL - FastAPI service URL (defaults to http://localhost:8000)
VITE_INVOICE_API_KEY - API key for authentication (embedded in bundle)
VITE_INVOICE_API_REQUIRE_AUTH - Toggle for auth requirement (true/false)
```

**Security Concerns**:
1. API key in `VITE_` prefixed environment variable → compiled into production bundle
2. Client-side `X-API-Key` header exposes key in Network tab
3. No user authentication before OCR requests
4. Client-side file validation only (bypassable by custom requests)

### Security Posture

**Current Posture**: **Acceptable for Pre-Production**
**Reasoning**:
- FastAPI service manages Google Vision/OpenAI keys (not app's concern)
- Invoice data is non-critical (B2B operational data, not PII)
- Risk-based security acceptable for this use case

**Not Acceptable for Production Without Mitigations**
- Requires one of the following before Phase 3 can go to production:
  - Vercel Edge Function proxy (Alternative 2) OR
  - Strong mitigations with IP whitelist, rate limiting, monitoring (Alternative 3)

---

## Lessons Learned

### Architecture Evolution Pattern
1. **Prototype → Secure → Simplify**: Three-phase evolution from initial implementation to production-mature solution
2. **Learn by Doing**: Each iteration was based on production experience, not upfront planning
3. **Testing Investment Follows Maturity**: Phase 3 added 490 lines of tests after operational experience

### Security vs Operations Trade-off
1. **Security Purity vs Pragmatic Simplicity**: Supabase Edge Functions were architecturally pure but operationally complex
2. **Context Matters**: For non-critical data paths, operational simplicity can outweigh theoretical security concerns
3. **Mitigation is Possible**: Risk-based security acceptable with proper mitigations (IP whitelist, rate limiting)

### Documentation Importance
1. **ADR Documentation Critical**: Without ADR-0001, future developers wouldn't understand why Phase 3 was chosen over Phase 2
2. **Decision Recording**: This ADR provides explicit rationale for architectural choices

---

## References

- **Related Issues/PRs**: PR #91 (feat/invoice): Replace Supabase Edge Functions with FastAPI /extract endpoint
- **Related ADRs**: [ADR-0001](./ADR-0001-airtable-proxy.md) - Airtable backend proxy decision
- **Related Documentation**:
  - [docs/FASTAPI_INTEGRATION.md](../FASTAPI_INTEGRATION.md) - Integration guide
  - [tests/unit/lib/invoiceOCR.test.ts](../tests/unit/lib/invoiceOCR.test.ts) - Test suite (490 lines)
  - [docs/SUPABASE_EDGE_FUNCTIONS.md](../SUPABASE_EDGE_FUNCTIONS.md) - Previous architecture

---

## Sign-off

- **Approved By**: Product Engineering Team
- **Implementation Date**: 2026-02-04
- **Review Date**: 2026-02-04 (Code Review)
- **Next Review**: 2026-05-01 (Post-production security audit)
