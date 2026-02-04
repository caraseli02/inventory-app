# FastAPI Invoice OCR Security Guide

**Last Updated**: 2026-02-04
**Applies To**: Phase 3 Invoice OCR Implementation (PR #91)

---

## Executive Summary

The FastAPI invoice OCR integration uses client-side API key authentication. This document provides security best practices, deployment guidance, and mitigation strategies for production deployments.

**🔴 Critical Risk**: API key is exposed in production JavaScript bundle

**⚠️ Acceptable For**: Pre-production environments with proper mitigations

**❌ Not Acceptable For**: Production without Vercel Edge Function proxy or strong mitigations

---

## Security Risk Assessment

### Primary Vulnerability: Client-Side API Key Exposure

**Location**: `src/lib/invoiceOCR.ts:131-146`

```typescript
const apiKey = import.meta.env.VITE_INVOICE_API_KEY;  // ← Embedded in bundle!
if (requireAuth || apiKey) {
  headers['X-API-Key'] = apiKey || '';
}
```

**Impact**:
- **Attack Surface**: Anyone with production app access can extract API key
- **Exploit Scenario**:
  1. Attacker opens DevTools → Network tab
  2. Uploads any invoice
  3. Inspects `X-API-Key` header
  4. Uses extracted key to call FastAPI `/extract` indefinitely
  5. Can process other users' invoice data (if FastAPI doesn't validate)

**Risk Score**: 8/10 (Critical)

---

## Deployment Modes

### Mode 1: Local Development (Acceptable ✅)

**Environment**: `localhost:8000` (default)

**Security Posture**: **Low Risk**

**Why Acceptable**:
- API key not exposed to internet (localhost only)
- Development data, no production impact
- Rapid iteration enabled

**Requirements**:
- None required beyond local FastAPI service

---

### Mode 2: Pre-Production/Staging (Acceptable with Mitigations ⚠️)

**Environment**: Production or staging URLs

**Security Posture**: **Medium Risk** (mitigations required)

**Required Mitigations**:
1. ✅ IP Whitelist on FastAPI service
   - Restrict `/extract` endpoint to production server IPs only
   - Block requests from unknown IPs
   - Implementation: Configure FastAPI `ALLOWED_IPS` env var

2. ✅ Rate Limiting on FastAPI
   - Enforce 100 requests/day per API key
   - Implement exponential backoff for rate limit violations
   - Implementation: Configure FastAPI `RATE_LIMIT_PER_DAY=100`

3. ✅ API Key Rotation
   - Rotate keys weekly/monthly
   - Implement key expiration (TTL 7 days)
   - Revocation procedure for lost keys
   - Implementation: Deploy cron job to regenerate keys

4. ✅ Monitoring and Alerts
   - Log all API requests with correlation IDs
   - Alert on unusual patterns (sudden traffic spikes)
   - Set up Prometheus/Grafana or cloud provider monitoring
   - Implement: Add request logging to FastAPI

5. ✅ CORS Domain Validation
   - Restrict CORS to production domains only
   - Validate `Origin` header on FastAPI
   - Block requests from unauthorized origins
   - Implementation: Configure FastAPI `ALLOWED_ORIGINS`

6. ✅ Request Validation on FastAPI
   - Validate file type server-side (PDF magic bytes)
   - Reject malformed requests
   - Validate file size (10MB max)
   - Sanitize extracted data (remove XSS payloads)
   - Implementation: Add Pydantic models to FastAPI

**Deployment Checklist for Pre-Production**:
```bash
# FastAPI Service Configuration
ALLOWED_IPS=["app.production.com", "load-balancer.production.com"]
RATE_LIMIT_PER_DAY=100
ALLOWED_ORIGINS=["https://app.inventory-app.com"]
REQUEST_VALIDATION=true
LOG_LEVEL=INFO
CORS_ENABLED=true

# App Configuration
VITE_INVOICE_API_URL=https://fastapi.production.com/extract
VITE_INVOICE_API_KEY=prod-key-xxx-xxx  # Rotatable
VITE_INVOICE_API_REQUIRE_AUTH=true
```

---

### Mode 3: Production with Vercel Edge Function Proxy (Recommended ✅)

**Architecture**:
```
Client → Vercel Edge Function (/api/extract-invoice)
  → Validates Supabase user session
  → Forwards request to FastAPI (/extract)
  → Stores API key server-side (Vercel env var)
  → Returns result to client
```

**Security Posture**: **Low Risk**

**Benefits**:
- ✅ API key never exposed to client
- ✅ User authentication enforced
- ✅ Server-side rate limiting
- ✅ Audit logging via Supabase + Vercel
- ✅ Defense-in-depth (client + server validation)

**Implementation**: See [ADR-0005](../adrs/ADR-0005-invoice-ocr-architecture-evolution.md) for full details

---

## Environment Variables

### Current Configuration

```bash
# FastAPI Integration
VITE_INVOICE_API_URL=https://fastapi-service.com/extract
VITE_INVOICE_API_KEY=your-api-key-here
VITE_INVOICE_API_REQUIRE_AUTH=true  # If true, require auth header
```

### Security Considerations

**DO NOT**:
```bash
# ❌ NEVER DO THIS
VITE_INVOICE_API_KEY=secret-key-prod-xxx  # Production key in client bundle

# ❌ NEVER DO THIS
VITE_INVOICE_API_KEY=${FASTAPI_SERVICE_ADMIN_KEY} # Service admin key in app
```

**ALWAYS DO**:
```bash
# ✅ Production deployments must use Vercel Edge Function proxy
# ✅ Pre-production must have all mitigations (Mode 2)
# ✅ Local development only: VITE_INVOICE_API_URL=http://localhost:8000
# ✅ Use unique, rotated keys per environment
```

---

## Mitigation Implementation

### IP Whitelist on FastAPI

**Purpose**: Restrict API access to production infrastructure only

**Implementation**:
```python
# FastAPI service (Python)
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import os

ALLOWED_IPS = os.getenv("ALLOWED_IPS", "").split(",")

app = FastAPI()

# IP whitelist middleware
@app.middleware("http")
async def ip_whitelist_middleware(request: Request, call_next):
    client_ip = request.client.host
    
    # Check if client IP is in whitelist
    if client_ip not in ALLOWED_IPS:
        return JSONResponse(
            status_code=403,
            content={"error": "Forbidden - IP not whitelisted"}
        )
    
    await call_next(request)

# Or use trusted proxy (Cloudflare, AWS ALB)
```

**Configuration**:
```bash
# .env
ALLOWED_IPS=app.server.com,load-balancer.app.com
```

---

### Rate Limiting on FastAPI

**Purpose**: Prevent API abuse by enforcing request limits

**Implementation**:
```python
# FastAPI service
from fastapi import FastAPI, Request, HTTPException
from slowapi import Limiter, RateLimiter
from datetime import timedelta

# Redis or in-memory rate limiter
limiter = Limiter(
    key="invoice_extract",
    rate_limit=100,  # 100 requests per day
    expiry=timedelta(days=1)  # Reset daily
)

@app.post("/extract")
@limiter.limit("invoice_extract")
async def extract_invoice(request: Request, file: UploadFile):
    # Check rate limit
    try:
        limiter.hit("invoice_extract")
    except RateLimiterExceeded:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 100 requests per day."
        )
    
    # Process extraction
    # ...
```

**Configuration**:
```bash
# .env
RATE_LIMIT_PER_DAY=100
RATE_LIMIT_WINDOW=86400  # 24 hours in seconds
```

---

### Request Correlation and Audit Logging

**Purpose**: Track API requests for security monitoring and debugging

**Implementation**:
```python
# FastAPI service
import uuid
from fastapi import Request
import logging

logger = logging.getLogger("invoice_api")

@app.post("/extract")
async def extract_invoice(request: Request, file: UploadFile):
    # Generate correlation ID
    correlation_id = str(uuid.uuid4())
    
    # Log request with correlation ID
    logger.info(
        f"Invoice extraction request",
        extra={
            "correlation_id": correlation_id,
            "client_ip": request.client.host,
            "user_agent": request.headers.get("user-agent"),
            "file_name": file.filename,
            "file_size": file.size,
        }
    )
    
    # Add correlation ID to response
    result = process_invoice(file)
    result["correlation_id"] = correlation_id
    
    return result
```

**Benefits**:
- Trace requests across client → proxy → FastAPI
- Detect abuse patterns (high-frequency requests)
- Debug issues with correlation IDs
- Monitor API health and performance

---

## Monitoring and Alerting

### Required Metrics

1. **Request Volume**
   - Requests per minute/hour/day
   - Errors per minute/hour/day
   - Average response time

2. **Security Events**
   - Rate limit violations
   - IP whitelist failures
   - Suspicious activity patterns
   - CORS violations

3. **Business Metrics**
   - Successful extractions
   - Products extracted per invoice
   - Average products per invoice

### Monitoring Stack Options

**Option 1: Cloud Provider (Recommended)**
```yaml
# Vercel Analytics (built-in)
# FastAPI built-in metrics
# DataDog or New Relic (third-party)
```

**Option 2: Self-Hosted**
```yaml
# Prometheus + Grafana
# Loki + Tempo
# Elastic Stack (ELK + Kibana)
```

### Alert Configuration

```yaml
# Prometheus AlertManager
groups:
  - name: security
    rules:
      - alert if rate_limit_violations > 10 in 5m
      - alert if ip_whitelist_failures > 5 in 10m
      
  - name: availability
    rules:
      - alert if error_rate > 5% in 5m
      - alert if avg_response_time > 30s
```

---

## Incident Response Plan

### Security Incident Types

1. **API Key Exposure**
   - **Detection**: Unusual traffic from unknown IPs
   - **Response**: Rotate API key immediately, investigate source
   - **Recovery**: Generate new key, update environment

2. **Rate Limit Violations**
   - **Detection**: Single IP exceeding limits
   - **Response**: Block IP temporarily, investigate
   - **Recovery**: Add to permanent blocklist if abuse confirmed

3. **Data Corruption Attempts**
   - **Detection**: Malicious file uploads, invalid data
   - **Response**: Block requests, log details
   - **Recovery**: No action (attack prevented)

### Incident Response Checklist

```markdown
## Security Incident Response

### Detection
- [ ] Incident detected (source, time, affected users)
- [ ] Impact assessed (severity, scope)
- [ ] Root cause identified

### Containment
- [ ] Attack vector blocked (IP throttled, key rotated, etc.)
- [ ] Prevent spread to other systems
- [ ] Temporary mitigation deployed

### Eradication
- [ ] Root cause fixed (code patch, config update)
- [ ] Verify fix (testing, monitoring)
- [ ] Permanent solution deployed
- [ ] Post-incident review (lessons learned)

### Recovery
- [ ] Affected systems restored
- [ ] Data integrity verified
- [ ] Monitoring confirms normal operation
- [ ] Incident closed (document in ADR/lessons/)
```

---

## Deployment Checklist

### Pre-Production Deployment (Required Before Production)

**Security:**
- [ ] FastAPI IP whitelist configured
- [ ] Rate limiting enabled (100 req/day)
- [ ] Request correlation logging enabled
- [ ] Monitoring and alerting configured
- [ ] CORS domain validation enabled
- [ ] Request validation enabled (file type, size)
- [ ] API key rotation schedule established

**Application:**
- [ ] VITE_INVOICE_API_URL set to production domain
- [ ] VITE_INVOICE_API_KEY configured (unique, rotated)
- [ ] VITE_INVOICE_API_REQUIRE_AUTH=true
- [ ] All tests passing (unit + integration)
- [ ] Load testing performed (simulate high traffic)

**Infrastructure:**
- [ ] FastAPI service deployed (Docker/Kubernetes)
- [ ] Database deployed (if using one)
- [ ] Load balancer configured
- [ ] CDN configured (if needed)
- [ ] SSL/TLS certificates valid
- [ ] Firewall rules configured
- [ ] Monitoring stack operational

**Documentation:**
- [ ] This security guide reviewed
- [ ] ADR-0005 approved
- [ ] Incident response plan created
- [ ] Runbook documented
- [ ] Support team trained

### Production Deployment (Blocked Without Mitigations)

**🚫 DO NOT DEPLOY TO PRODUCTION WITHOUT**:

- [ ] Vercel Edge Function proxy implemented
- [ ] OR all Mode 2 mitigations implemented
- [ ] Security review completed
- [ ] Incident response plan tested

**Reason**: Client-side API key exposure is a critical security vulnerability. Production deployment requires server-side API key protection.

---

## Best Practices

### Development

✅ **DO**:
- Use `VITE_INVOICE_API_URL=http://localhost:8000` for local development
- Use mock/stub FastAPI for unit tests
- Never commit production keys to code

❌ **DO NOT**:
- Use production API keys in local `.env`
- Commit `VITE_INVOICE_API_KEY` values to repository
- Test with real production data in local development

---

### Deployment

✅ **DO**:
- Use environment-specific API keys (dev, staging, prod)
- Rotate keys before deployment
- Use secrets management (Vercel env vars, AWS Secrets Manager)
- Enable all mitigations before production
- Monitor for security events post-deployment

❌ **DO NOT**:
- Use same API key across all environments
- Commit secrets to code
- Deploy without security review
- Disable monitoring in production

---

### Operations

✅ **DO**:
- Review security logs weekly
- Respond to alerts within 1 hour (critical), 4 hours (high)
- Perform quarterly security audits
- Rotate API keys quarterly
- Update threat models based on incidents

❌ **DO NOT**:
- Ignore security alerts
- Rotate keys reactively (only after incidents)
- Deploy changes without security review
- Disable monitoring due to cost

---

## References

**Internal Documentation:**
- [ADR-0005: Invoice OCR Architecture Evolution](./adrs/ADR-0005-invoice-ocr-architecture-evolution.md)
- [FASTAPI_INTEGRATION.md](./FASTAPI_INTEGRATION.md)
- [Security Posture](./SECURITY_POSTURE.md)

**External Resources:**
- [OWASP API Security Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security Best Practices](https://fastapi.tiangolo.com/tutorial/security/)
- [Vercel Edge Functions Security](https://vercel.com/docs/concepts/functions/edge-functions/security)

---

## Appendices

### Appendix A: Sample FastAPI Security Configuration

```python
# FastAPI main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, RateLimiter
from slowapi.security import HTTPException, HTTPAuthorizationCredentials
import os

app = FastAPI()

# Security headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "*"
    response.headers["X-Content-Type"] = "application/json"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# CORS (configure for production only)
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
app.add_middleware(
    CORSMiddleware(
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["POST"],
        allow_headers=["X-API-Key", "Content-Type"],
        max_age=600,
    )
)

# Rate limiting
limiter = Limiter(
    key="invoice_extract",
    rate_limit=100,
    expiry=timedelta(days=1),
)

# API key authentication
@app.post("/extract")
@limiter.limit("invoice_extract")
async def extract_invoice(
    request: Request,
    file: UploadFile,
    api_key: str = HTTPAuthorizationCredentials(scheme="Bearer", credentials=os.getenv("API_KEY"))
):
    # Validate API key
    if api_key.credentials != os.getenv("API_KEY"):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key"
        )
    
    # Process extraction
    # ...
```

---

### Appendix B: Incident Response Runbook

**Template**: [INCIDENT_RUNBOOK_TEMPLATE.md](./INCIDENT_RUNBOOK_TEMPLATE.md)

**Incident Types**:
- **SEC001**: API Key Compromise
- **SEC002**: Rate Limit Violation
- **SEC003**: Data Corruption Attempt
- **SEC004**: Unauthorized Access Attempt
- **SEC005**: Malicious File Upload

**Escalation Matrix**:
```
Severity | Escalation | Response Time
----------|-----------|--------------
Low      | Team Lead    | 4 hours
Medium   | Engineering  | 2 hours
High      | CTO        | 1 hour
Critical  | CTO + Security | 30 minutes
```

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|---------|---------|
| 1.0 | 2026-02-04 | Claude Code | Initial creation |
