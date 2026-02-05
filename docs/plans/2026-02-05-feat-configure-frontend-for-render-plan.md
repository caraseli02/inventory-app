---
title: Frontend Configuration for FastAPI on Render
type: feat
date: 2026-02-05
---

# Frontend Configuration for FastAPI on Render

## Overview

Configure the frontend inventory app to work with FastAPI service deployed to Render.com free tier. This involves updating environment variables, improving cold start UX, and testing the end-to-end invoice upload flow.

**Scope**: Frontend changes only (this repo). FastAPI service deployment is in a separate repository.

## Problem Statement / Motivation

**Current State**:
- Frontend uses `VITE_INVOICE_API_URL=http://localhost:8000` for local development
- Invoice OCR feature only works when FastAPI service runs locally
- No production configuration for FastAPI service URL
- XMLHttpRequest timeout (60s minimum) insufficient for Render cold starts

**Why This Matters**:
- Enables production invoice OCR functionality (saves 90-95% manual data entry time)
- Users can upload invoices from deployed app (not just local development)
- Provides cloud-based OCR service (no local server required)

## Proposed Solution

Update frontend configuration to point to Render-deployed FastAPI service, then improve UX for Render's cold start limitations.

### Phase 1: Environment Variable Configuration
1. Update `VITE_INVOICE_API_URL` to Render service URL
2. Update `VITE_INVOICE_API_KEY` for production
3. Set `VITE_INVOICE_API_REQUIRE_AUTH=true` for production
4. Redeploy frontend with new environment variables

### Phase 2: Cold Start UX Improvements
1. Increase XMLHttpRequest timeout to 120s minimum (size-adaptive)
2. Update timeout error messages to mention cold start
3. Test end-to-end with Render service

## Technical Considerations

### Render Free Tier Impact on UX

**Cold Starts**:
- Service spins down after 15 minutes of inactivity
- Cold start takes 30-60 seconds
- First upload after idle period: **38-72s total** (30-60s cold start + 8-12s processing)

**Current Behavior**:
- XMLHttpRequest timeout: size-adaptive, minimum 60s
- Progress indicator: Upload (0-40%) → Processing (40-100%)
- Timeout error: "Upload timed out. Please try again with a smaller file or faster internet connection."

**Problem**:
- Progress stalls at 40% (upload complete) during cold start
- Timeout expires before cold start + processing completes
- Misleading error message (blames file size/connection, not cold start)

### Environment Variables to Update

**Current (Development)**:
```bash
VITE_INVOICE_API_URL=http://localhost:8000
VITE_INVOICE_API_KEY=dev-key-12345
VITE_INVOICE_API_REQUIRE_AUTH=false
```

**Production (to be set in Vercel)**:
```bash
VITE_INVOICE_API_URL=https://invoice-ocr-api.onrender.com
VITE_INVOICE_API_KEY=<production-api-key-from-fastapi-service>
VITE_INVOICE_API_REQUIRE_AUTH=true
```

**Note**: FastAPI service URL will be provided by FastAPI service owner after deployment.

### XMLHttpRequest Timeout Calculation

**Current Formula** (`src/lib/invoiceOCR.ts:122`):
```typescript
const timeoutMs = Math.max(60000, (file.size / (1024 * 1024)) * 1000);
// Example: 5MB file → 5 * 1000 = 5000ms (5s minimum)
// Example: 1MB file → 1 * 1000 = 1000ms (1s minimum)
// Minimum: 60s (for tiny files or cold start)
```

**Problem**:
- 60s timeout insufficient for cold start (30-60s) + processing (8-12s) = **38-72s total**

**Updated Formula** (add 60s cold start buffer):
```typescript
const timeoutMs = Math.max(120000, (file.size / (1024 * 1024)) * 1000 + 60000);
// Example: 1MB file → 1000 + 60000 = 61000ms (61s minimum)
// Example: 5MB file → 5000 + 60000 = 65000ms (65s minimum)
// Minimum: 120s (for cold start scenarios)
```

### Error Messages

**Current Timeout Error** (`src/lib/invoiceOCR.ts:246`):
```typescript
return {
  success: false,
  error: 'Upload timed out. Please try again with a smaller file or faster internet connection.',
};
```

**Problem**: Misleading - users may reduce file size when issue is cold start delay.

**Updated Timeout Error**:
```typescript
return {
  success: false,
  error: 'Service is warming up (first upload may take 30-60 seconds). Please wait and try again.',
};
```

**Note**: Keep network error message unchanged (actual connectivity issues need different guidance).

### CORS Considerations

**FastAPI Service Responsibility** (separate repo):
- Configure CORS middleware for production frontend URL
- Allow origins: `https://inventory-app.vercel.app` (production), `http://localhost:5173` (development)
- Allow methods: `POST`, `OPTIONS`
- Allow headers: `X-API-Key`, `Content-Type`

**Frontend Verification**:
- Check browser console for CORS errors on first upload
- Verify no "Access-Control-Allow-Origin" errors
- If CORS errors occur, contact FastAPI service owner

## Acceptance Criteria

### Phase 1: Environment Variable Configuration

- [ ] `VITE_INVOICE_API_URL` updated to Render service URL in Vercel
- [ ] `VITE_INVOICE_API_KEY` updated to production API key in Vercel
- [ ] `VITE_INVOICE_API_REQUIRE_AUTH` set to `true` in Vercel
- [ ] Frontend redeployed successfully to Vercel
- [ ] Environment variables visible in Vercel dashboard

### Phase 2: Cold Start UX Improvements

- [x] XMLHttpRequest timeout increased to 120s minimum (size-adaptive)
- [x] Timeout error message updated to mention cold start
- [x] Network error message unchanged (for actual connectivity issues)
- [x] Code changes committed to git
- [ ] Frontend redeployed with UX improvements

### Phase 3: End-to-End Testing

- [ ] Invoice upload dialog opens without CORS errors
- [ ] PDF upload completes successfully (no timeout errors)
- [ ] Extraction results displayed correctly (products, supplier, total amount)
- [ ] Products can be edited in preview
- [ ] Import to inventory works successfully
- [ ] No console errors during invoice upload flow
- [ ] First upload after idle period completes (38-72s expected)
- [ ] Subsequent uploads complete faster (8-12s, service warm)

### Phase 4: Documentation

- [x] Update `.env.example` with Render configuration comments
- [x] Document cold start behavior in `FASTAPI_INTEGRATION.md`
- [x] Add troubleshooting section for Render-specific issues
- [ ] Update deployment guide with environment variable setup

## Success Metrics

- **Environment Variables**: All 3 vars set correctly in Vercel (100%)
- **Deployment Success**: Frontend deploys within 2 minutes
- **Cold Start Success**: First upload after idle completes within 72s (95%+ success rate)
- **Warm Latency**: Subsequent uploads complete within 15s (95%+ success rate)
- **Error Rate**: <5% error rate for valid invoice uploads
- **CORS Errors**: Zero CORS errors in production (verified via browser console)
- **User Satisfaction**: No user complaints about timeout or cold start delays

## Dependencies & Risks

### Dependencies

- **FastAPI Service Deployment** (External repo):
  - Must be deployed to Render before frontend can point to it
  - Must provide production URL and API key
  - Must configure CORS for production frontend
  - **Risk**: FastAPI service not yet deployed

- **Vercel Deployment**:
  - Must be able to update environment variables in Vercel dashboard
  - Must redeploy frontend after environment changes
  - **Risk**: Deployment process unfamiliar to team

- **Production API Key**:
  - Must receive production API key from FastAPI service owner
  - **Risk**: API key not provided or incorrect

### Risks

**Risk 1: FastAPI Service Not Deployed** (HIGH)
- **Impact**: Cannot configure frontend, project blocked
- **Mitigation**: Confirm FastAPI deployment status before starting Phase 1
- **Probability**: Medium

**Risk 2: CORS Configuration Missing** (HIGH)
- **Impact**: All invoice uploads fail, feature completely broken
- **Mitigation**: Test CORS on first upload, contact FastAPI owner if errors
- **Probability**: Medium

**Risk 3: API Key Mismatch** (MEDIUM)
- **Impact**: All requests return 401 Unauthorized
- **Mitigation**: Verify API key matches FastAPI service configuration
- **Probability**: Low

**Risk 4: Cold Start Timeouts Still Occur** (MEDIUM)
- **Impact**: Users experience timeouts, think feature is broken
- **Mitigation**: Increased timeout to 120s, documented in error messages
- **Probability**: Low

**Risk 5: Network Errors Misdiagnosed as Cold Start** (LOW)
- **Impact**: Users see wrong error message for actual connectivity issues
- **Mitigation**: Only update timeout error, keep network error unchanged
- **Probability**: Low

## Implementation Steps

### Step 1: Verify FastAPI Service Status

**Prerequisites**:
- [ ] Contact FastAPI service owner
- [ ] Obtain production service URL (e.g., `https://invoice-ocr-api.onrender.com`)
- [ ] Obtain production API key

**Verification Tasks**:
1. **Test FastAPI `/health` endpoint**:
   ```bash
   curl https://invoice-ocr-api.onrender.com/health
   ```
   Expected: `{"status": "healthy", "service": "invoice-ocr-api", "timestamp": "..."}`

2. **Test FastAPI `/extract` endpoint**:
   ```bash
   curl -X POST https://invoice-ocr-api.onrender.com/extract \
     -H "X-API-Key: <production-key>" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@public/test-invoices/invoice-test.pdf"
   ```
   Expected: JSON response with `products` array

3. **Test CORS configuration**:
   ```bash
   curl -I -X OPTIONS https://invoice-ocr-api.onrender.com/extract \
     -H "Origin: https://inventory-app.vercel.app"
   ```
   Expected: `Access-Control-Allow-Origin: https://inventory-app.vercel.app`

**If Any Step Fails**:
- Contact FastAPI service owner
- Wait for FastAPI deployment to complete
- Do not proceed with frontend configuration until FastAPI is ready

### Step 2: Update Environment Variables in Vercel

**Prerequisites**:
- [ ] Vercel account access
- [ ] FastAPI service URL confirmed
- [ ] Production API key confirmed

**Tasks**:
1. **Go to Vercel Dashboard**:
   - Login to https://vercel.com
   - Select your inventory-app project
   - Go to Settings → Environment Variables

2. **Update/Add Environment Variables** (Production only):
   - **VITE_INVOICE_API_URL**:
     - Value: `https://invoice-ocr-api.onrender.com`
     - Environment: Production
     - Click Save

   - **VITE_INVOICE_API_KEY**:
     - Value: `<production-api-key-from-fastapi-service>`
     - Environment: Production
     - Click Save

   - **VITE_INVOICE_API_REQUIRE_AUTH**:
     - Value: `true`
     - Environment: Production
     - Click Save

3. **Verify Environment Variables**:
   - Check that all 3 variables are listed in "Environment Variables" section
   - Ensure "Production" column is checked for all 3 variables
   - Note: Values are hidden (•••••••) - this is normal

### Step 3: Redeploy Frontend

**Tasks**:
1. **Trigger Redeployment**:
   - Go to Vercel dashboard → project → Deployments
   - Click "Redeploy" button
   - Select "Production" environment
   - Click "Redeploy"

2. **Wait for Deployment**:
   - Deployment takes 1-2 minutes
   - Watch deployment logs for errors (click on deployment number)
   - Status changes: Building → Deployed

3. **Verify Deployment Success**:
   - Deployment status shows "Ready"
   - Green checkmark next to deployment
   - No errors in deployment logs

4. **Test Production URL**:
   - Visit production frontend URL (e.g., `https://inventory-app.vercel.app`)
   - App loads without errors
   - Invoice upload button visible

### Step 4: Improve Cold Start UX (Code Changes)

**Prerequisites**:
- [ ] Access to this repository
- [ ] Git branch ready for changes
- [ ] Development environment running (`pnpm dev`)

**Tasks**:

**Task 4.1: Update XMLHttpRequest Timeout**

**File**: `src/lib/invoiceOCR.ts`
**Line**: 122 (approximate)

**Current Code**:
```typescript
// Line 122
const timeoutMs = Math.max(60000, (file.size / (1024 * 1024)) * 1000);
```

**Updated Code**:
```typescript
// Line 122 - Add 60s cold start buffer
const timeoutMs = Math.max(120000, (file.size / (1024 * 1024)) * 1000 + 60000);
```

**Rationale**:
- Minimum timeout increased from 60s to 120s (accommodates cold start)
- Size-adaptive formula adds 60s buffer to all uploads
- Example: 1MB file → 1s + 60s = 61s minimum (was 1s)
- Example: 5MB file → 5s + 60s = 65s minimum (was 60s)
- Covers cold start (30-60s) + processing (8-12s) = 38-72s total

**Task 4.2: Update Timeout Error Message**

**File**: `src/lib/invoiceOCR.ts`
**Line**: 246 (approximate)

**Current Code**:
```typescript
// Lines 246-248 (inside catch block for timeout)
if (error instanceof Error && error.name === 'AbortError') {
  logger.error('Upload timed out', {
    fileName: file.name,
    fileSize: file.size,
    timeoutMs: Math.max(60000, (file.size / (1024 * 1024)) * 1000),
  });
  return {
    success: false,
    error: 'Upload timed out. Please try again with a smaller file or faster internet connection.',
  };
}
```

**Updated Code**:
```typescript
// Lines 246-253 - Updated error message for cold start
if (error instanceof Error && error.name === 'AbortError') {
  logger.error('Upload timed out', {
    fileName: file.name,
    fileSize: file.size,
    timeoutMs: Math.max(120000, (file.size / (1024 * 1024)) * 1000 + 60000),
  });
  return {
    success: false,
    error: 'Service is warming up (first upload may take 30-60 seconds). Please wait and try again.',
  };
}
```

**Note**: Keep network error message unchanged (lines 259-267 for `error.message === 'Upload timed out'`).

**Task 4.3: Test Code Changes Locally**

**Local Testing**:
```bash
# 1. Start development server
pnpm dev

# 2. Open browser to http://localhost:5173

# 3. Open DevTools Console (F12) to see logger output

# 4. Test invoice upload:
#    - Open invoice upload dialog
#    - Upload test invoice (public/test-invoices/invoice-test.pdf)
#    - Verify extraction results displayed
#    - Check console for timeoutMs calculation in logger output
#    - Verify new timeout value (should be >60s for cold start buffer)
```

**Task 4.4: Commit and Push Changes**

```bash
# 1. Stage changes
git add src/lib/invoiceOCR.ts

# 2. Commit changes
git commit -m "feat: Improve cold start UX for Render deployment

- Increase XMLHttpRequest timeout to 120s minimum (size-adaptive)
- Add 60s cold start buffer to timeout calculation
- Update timeout error message to mention cold start
- Network error message unchanged (for actual connectivity issues)

Related: FastAPI service deployed to Render.com free tier
"

# 3. Push to remote
git push origin <branch-name>
```

### Step 5: Final Deployment and Testing

**Prerequisites**:
- [ ] Code changes pushed to remote
- [ ] Code changes deployed to Vercel (or create new deployment)
- [ ] FastAPI service confirmed deployed and accessible

**Tasks**:

**Task 5.1: Deploy Code Changes to Production**

1. **Go to Vercel Dashboard**:
   - Navigate to project → Deployments
   - Click "New Deployment" (or wait for auto-deploy on git push)

2. **Wait for Deployment**:
   - Deployment takes 1-2 minutes
   - Verify status is "Ready"

3. **Verify Production URL**:
   - Visit `https://inventory-app.vercel.app`
   - App loads without errors

**Task 5.2: Test End-to-End Flow**

1. **Test First Upload (Cold Start Scenario)**:
   - Visit production frontend URL
   - Open invoice upload dialog
   - Upload test invoice PDF
   - **Expected behavior**:
     - Upload progress: 0-40% (fast)
     - Processing progress: 40-100% (slow, 30-60s cold start)
     - Total time: 38-72s
     - Extraction results displayed
     - No timeout errors

2. **Test Second Upload (Warm Service Scenario)**:
   - Immediately upload another invoice (service still warm)
   - **Expected behavior**:
     - Upload progress: 0-40% (fast)
     - Processing progress: 40-100% (fast, 8-12s)
     - Total time: 8-12s
     - Extraction results displayed
     - Much faster than first upload

3. **Test Product Import**:
   - Edit products in preview (optional)
   - Click "Import [N] Products" button
   - Navigate to inventory list
   - Verify imported products appear
   - Verify stock IN movements created

4. **Check for Errors**:
   - Open DevTools Console (F12)
   - Verify no CORS errors
   - Verify no timeout errors
   - Verify no network errors
   - Check logger output for timeoutMs calculation (should show >60s)

**Task 5.3: Test Error Scenarios**

1. **Test Invalid File Type**:
   - Upload .jpg file (rename to .pdf)
   - **Expected**: "Invalid file extension. Please upload a PDF file."

2. **Test File Too Large**:
   - Upload 11MB PDF (if available)
   - **Expected**: "File size exceeds 10MB limit. Please upload a smaller file."

3. **Test Network Error**:
   - Disconnect internet
   - Upload invoice
   - **Expected**: "Network error while processing invoice. Please check your internet connection and try again."

4. **Verify CORS Configuration** (if errors occur):
   - Open DevTools → Network tab
   - Check OPTIONS request before POST /extract
   - Verify response headers include:
     - `Access-Control-Allow-Origin: https://inventory-app.vercel.app`
     - `Access-Control-Allow-Methods: POST, OPTIONS`
     - `Access-Control-Allow-Headers: X-API-Key, Content-Type`
   - If missing, contact FastAPI service owner

### Step 6: Update Documentation

**Tasks**:

**Task 6.1: Update `.env.example`**

**File**: `.env.example`

**Add Comments for Render Deployment**:
```bash
# =============================================================================
# INVOICE OCR & DATA EXTRACTION (Optional - for automatic invoice import)
# =============================================================================
# Feature: Upload invoice PDFs and automatically extract product data
# Saves 90-95% of manual data entry time (15-40 min → 1-2 min per invoice)
#
# How it works:
# 1. FastAPI service extracts text and data from PDF invoice
# 2. Returns structured product data with names, quantities, and prices
# 3. Review and edit products before importing
#
# Architecture: FastAPI /extract endpoint
# - Accepts PDF uploads via multipart/form-data
# - Returns JSON with products, supplier, invoice number, and total amount
# - Supports API key authentication (optional for local dev, required for production)
#
# Setup Guide: docs/FASTAPI_INTEGRATION.md
#
# --- FastAPI Service Configuration ---
# Local Development:
# VITE_INVOICE_API_URL=http://localhost:8000
# VITE_INVOICE_API_KEY=dev-key-12345
# VITE_INVOICE_API_REQUIRE_AUTH=false
#
# Production (Render.com):
# VITE_INVOICE_API_URL=https://invoice-ocr-api.onrender.com
# VITE_INVOICE_API_KEY=<production-api-key-from-fastapi-service>
# VITE_INVOICE_API_REQUIRE_AUTH=true
#
# Notes:
# - API key is sent via X-API-Key header
# - Set VITE_INVOICE_API_REQUIRE_AUTH=true to enforce authentication
# - For local development, you can set VITE_INVOICE_API_REQUIRE_AUTH=false
# - Production API key provided by FastAPI service owner
# - Cold start behavior: First upload after idle period (15min+) may take 30-60s
```

**Task 6.2: Update `FASTAPI_INTEGRATION.md`** (if exists)

**Add Render Deployment Section**:
```markdown
## Render Deployment

### Production Setup

#### FastAPI Service (Separate Repository)

The FastAPI invoice OCR service is deployed to Render.com free tier as a separate web service.

**Service URL**: https://invoice-ocr-api.onrender.com (provided by FastAPI service owner)

**Health Check**: https://invoice-ocr-api.onrender.com/health

**Environment Variables** (Set in Render dashboard, not in frontend):
- `OPENAI_API_KEY`: OpenAI API key (for GPT-4o mini parsing)
- `GOOGLE_CLOUD_API_KEY`: Google Cloud Vision API key (for OCR)
- `API_KEYS`: Production API key for frontend authentication
- `RATE_LIMIT_PER_MINUTE`: Request rate limit (default: 60)
- `MAX_FILE_SIZE`: Maximum file size in bytes (default: 10485760 = 10MB)

#### Frontend Configuration (This Repository)

Update environment variables in Vercel dashboard:

```bash
VITE_INVOICE_API_URL=https://invoice-ocr-api.onrender.com
VITE_INVOICE_API_KEY=<production-api-key-from-fastapi-service>
VITE_INVOICE_API_REQUIRE_AUTH=true
```

### Cold Start Behavior

**Render Free Tier Limitation**:
- Service spins down after 15 minutes of inactivity
- Cold start takes 30-60 seconds
- First upload after idle period: 38-72s total (30-60s cold start + 8-12s processing)

**User Experience**:
- Progress indicator stalls at 40% (upload complete) during cold start
- XMLHttpRequest timeout: 120s minimum (size-adaptive, includes 60s cold start buffer)
- Timeout error message: "Service is warming up (first upload may take 30-60 seconds). Please wait and try again."

**Best Practices**:
- Wait and retry on first upload timeout (service is warming up)
- Subsequent uploads are faster (8-12s, service warm)
- Monitor Render logs for error patterns
```

**Task 6.3: Create Troubleshooting Section**

**Add to `FASTAPI_INTEGRATION.md`**:
```markdown
## Troubleshooting

### CORS Errors

**Symptom**: Browser console shows "Access-Control-Allow-Origin" error

**Cause**: FastAPI CORS middleware not configured for production frontend URL

**Solution**:
1. Contact FastAPI service owner
2. Verify CORS `allow_origins` includes production URL (`https://inventory-app.vercel.app`)
3. Test CORS with curl:
   ```bash
   curl -I -X OPTIONS https://invoice-ocr-api.onrender.com/extract \
     -H "Origin: https://inventory-app.vercel.app"
   ```
4. Redeploy FastAPI service if needed

### 401 Unauthorized Errors

**Symptom**: All upload requests return 401 error

**Cause**: API key mismatch or missing authentication

**Solution**:
1. Verify `VITE_INVOICE_API_KEY` in Vercel matches FastAPI `API_KEYS`
2. Verify `VITE_INVOICE_API_REQUIRE_AUTH=true` in Vercel
3. Test API key with curl:
   ```bash
   curl -X POST https://invoice-ocr-api.onrender.com/extract \
     -H "X-API-Key: <your-key>" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@/path/to/test-invoice.pdf"
   ```
4. Contact FastAPI service owner if key is incorrect

### Timeout Errors

**Symptom**: Upload times out after 60+ seconds

**Cause**: Render cold start (service waking up after 15+ minutes idle)

**Solution**:
1. Wait 30-60 seconds and retry upload
2. Verify error message mentions "Service is warming up"
3. If timeout persists, contact FastAPI service owner (service may be down)
4. Check Render service logs: https://dashboard.render.com → invoice-ocr-api → Logs

### Network Errors

**Symptom**: "Network error while processing invoice"

**Cause**: Actual internet connectivity issue, not cold start

**Solution**:
1. Check internet connection
2. Try uploading smaller file
3. Retry upload after network stabilizes
4. If issue persists, contact support

### Empty Products or Invalid Data

**Symptom**: Extraction succeeds but returns empty products array or invalid data

**Cause**: OCR failed to extract line items from invoice

**Solution**:
1. Verify invoice PDF is legible (not scanned image)
2. Try different invoice (simpler layout)
3. Contact support if issue persists

### Render Service Unavailable (502/503)

**Symptom**: HTTP error 502 Bad Gateway or 503 Service Unavailable

**Cause**: FastAPI service crashed, restarting, or overloaded

**Solution**:
1. Wait 1-2 minutes and retry (service may be restarting)
2. Check Render status page: https://status.render.com
3. Check Render service logs for errors
4. Contact FastAPI service owner if issue persists
```

**Task 6.4: Update Deployment Documentation**

**Add to `LAUNCH_CHECKLIST.md`** (if exists):
```markdown
## Invoice OCR Configuration

If using invoice OCR feature with FastAPI service deployed to Render:

- [ ] FastAPI service deployed to Render (contact FastAPI owner for URL)
- [ ] `VITE_INVOICE_API_URL` set in Vercel (e.g., https://invoice-ocr-api.onrender.com)
- [ ] `VITE_INVOICE_API_KEY` set in Vercel (provided by FastAPI owner)
- [ ] `VITE_INVOICE_API_REQUIRE_AUTH=true` in Vercel
- [ ] Frontend redeployed with new environment variables
- [ ] Test invoice upload in production
- [ ] Verify no CORS errors in browser console
- [ ] Test cold start behavior (first upload after 15+ minutes idle)
- [ ] Document cold start timeout (30-60s) for users
```

## References & Research

### Internal References

- **Invoice OCR Integration**: FastAPI service integration code
  - Location: `src/lib/invoiceOCR.ts` (452 lines)
  - Key functions: `extractInvoiceData()`, `uploadWithProgress()`
  - XMLHttpRequest timeout: Line 122
  - Timeout error handling: Line 246

- **Environment Variables**: Environment variable configuration
  - Location: `.env.example` (125 lines)
  - Invoice OCR vars: `VITE_INVOICE_API_URL`, `VITE_INVOICE_API_KEY`, `VITE_INVOICE_API_REQUIRE_AUTH`

- **ADR-0005**: Invoice OCR Architecture Evolution
  - Location: `docs/adrs/ADR-0005-invoice-ocr-architecture-evolution.md`
  - Security concerns: Client-side API key exposure
  - Mitigations: CORS, rate limiting, monitoring

### External References

- **Render Free Tier Limitations**: https://docs.render.com/free
  - 750 instance hours/month
  - 15-minute idle timeout
  - Cold start behavior

- **Vercel Environment Variables**: https://vercel.com/docs/projects/environment-variables
  - How to set environment variables in Vercel dashboard
  - Environment-specific configuration (Production vs Preview)

- **Browser Network Requests**: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/timeout
  - XMLHttpRequest timeout behavior
  - Size-adaptive timeout calculation

## Testing Checklist

### Pre-Deployment Testing (Local)

- [ ] Development server running (`pnpm dev`)
- [ ] Invoice upload dialog opens
- [ ] Upload test invoice PDF succeeds (local FastAPI)
- [ ] Extraction results displayed correctly
- [ ] Check console for timeoutMs calculation (should show new formula)
- [ ] Verify timeout value >60s for cold start buffer
- [ ] Test invalid file type (.jpg renamed to .pdf)
- [ ] Test file too large (if test file available)
- [ ] Test network error (disconnect internet)

### Post-Deployment Testing (Production)

- [ ] Production frontend accessible (https://inventory-app.vercel.app)
- [ ] Invoice upload dialog opens
- [ ] Environment variables verified in Vercel dashboard
- [ ] First upload (cold start) completes (38-72s)
- [ ] Extraction results displayed after cold start
- [ ] Second upload (warm service) completes faster (8-12s)
- [ ] Products can be edited in preview
- [ ] Import to inventory works successfully
- [ ] No CORS errors in browser console
- [ ] No timeout errors (except expected cold start delay)
- [ ] No 401 errors (authentication working)
- [ ] No network errors (unless actual connectivity issue)
- [ ] Console logger shows timeoutMs >60s (cold start buffer working)

### Error Scenario Testing

- [ ] Invalid file type returns error message
- [ ] File too large returns error message
- [ ] Network error returns error message
- [ ] Timeout error mentions cold start
- [ ] Empty products returns error message
- [ ] Invalid PDF returns error message

## Post-Deployment Actions

### Immediate (First 24 Hours)

- [ ] Monitor Vercel deployment logs for errors
- [ ] Test invoice upload from production frontend
- [ ] Verify cold start behavior (first upload slow, subsequent fast)
- [ ] Check browser console for CORS errors
- [ ] Verify API key authentication working (no 401 errors)
- [ ] Monitor timeoutMs calculation in console logs

### Ongoing (Weekly)

- [ ] Monitor Vercel Analytics for error rates
- [ ] Review console logs for timeout errors
- [ ] Check for CORS errors in production
- [ ] Monitor user feedback on cold start delays
- [ ] Update documentation if issues found

### Monthly

- [ ] Review Render service status (if accessible)
- [ ] Verify API key still valid (no rotation required)
- [ ] Audit environment variables in Vercel
- [ ] Update documentation based on user feedback

## Rollback Plan

### Scenarios Requiring Rollback

1. **Environment Variables Misconfigured**: All uploads fail with 401 or CORS errors
2. **Code Changes Break Upload**: Timeout calculation errors, regression bugs
3. **FastAPI Service Down**: All uploads fail with 502/503 errors

### Rollback Procedure

**Step 1: Rollback Environment Variables** (if misconfigured)
1. Go to Vercel dashboard → project → Settings → Environment Variables
2. Update values back to previous (or comment out new vars)
3. Redeploy frontend
4. Test invoice upload

**Step 2: Rollback Code Changes** (if bugs introduced)
1. Go to Vercel dashboard → project → Deployments
2. Find last successful deployment before code changes
3. Click "Rollback" on that deployment
4. Wait 1-2 minutes for rollback to complete
5. Test invoice upload

**Step 3: Rollback Both** (if both env vars and code changes fail)
1. First rollback code changes (Step 2 above)
2. Then rollback environment variables (Step 1 above)
3. Test end-to-end flow

### Rollback Time Estimate

- Environment variables: 1-2 minutes
- Code changes: 1-2 minutes
- Testing: 5 minutes
- **Total: 7-9 minutes**

## Known Issues & Limitations

### Render Free Tier Limitations

1. **Cold Starts**: 30-60s delay after 15 minutes of inactivity
   - Impact: First upload after idle period is slow
   - Mitigation: Increased timeout to 120s, documented in error messages

2. **No Control Over FastAPI Service**: FastAPI deployment is in separate repo
   - Impact: Cannot fix CORS, rate limiting, or server issues
   - Mitigation: Contact FastAPI service owner, document issues

### Security Limitations

1. **Client-Side API Key**: API key embedded in production bundle
   - Impact: Anyone can extract key via DevTools (from ADR-0005)
   - Mitigation: CORS restrictions, rate limiting (FastAPI responsibility), monitoring

### UX Limitations

1. **No Cold Start Indicator**: Progress stalls at 40% during cold start
   - Impact: Users may think upload failed
   - Mitigation: Increased timeout, improved error messages, documentation

2. **No Automatic Retry**: Transient failures require manual retry
   - Impact: Poor UX on cold start timeouts
   - Mitigation: Documented in error messages, user instructed to wait and retry

## Future Improvements

### Short-Term (Next Sprint)

- [ ] Add cold start indicator to UI (show "Warming up service..." after upload)
- [ ] Implement automatic retry logic (exponential backoff, max 3 attempts)
- [ ] Add more detailed error messages (specific guidance for each error type)
- [ ] Track cold start occurrences in Vercel Analytics

### Medium-Term (Next Quarter)

- [ ] Implement Vercel Edge Function proxy (ADR-0005 Alternative 2)
  - Benefits: Hide API key server-side, add user authentication
  - Complexity: Requires 1-2 hours setup

- [ ] Add user authentication (Supabase auth)
  - Benefits: Restrict OCR to authenticated users
  - Complexity: Requires Supabase auth integration

- [ ] Add usage metrics dashboard
  - Benefits: Monitor uploads per day, error rates, cold start frequency
  - Complexity: Requires Vercel Analytics integration

### Long-Term (Next 6 Months)

- [ ] Implement smart caching (warm service periodically)
  - Benefits: Reduce cold starts for frequent uploads
  - Complexity: Requires scheduled tasks or keepalive endpoint

- [ ] Add upload queue management
  - Benefits: Handle concurrent uploads gracefully
  - Complexity: Requires state management on backend

## Conclusion

This frontend configuration plan provides a focused approach to connecting the inventory app with FastAPI service deployed to Render.com. The plan addresses:

- **Environment Variables**: Update to point to Render service URL and production API key
- **UX Improvements**: Increased timeout (120s minimum), better error messages for cold start
- **Testing**: Comprehensive end-to-end testing with cold start scenarios
- **Documentation**: Updated environment variable documentation, troubleshooting guide

**Scope**: Frontend changes only (this repo). FastAPI service deployment is in separate repository.

**Estimated Timeline**:
- Step 1 (Verify FastAPI): 30 minutes
- Step 2 (Update env vars): 15 minutes
- Step 3 (Redeploy): 5 minutes
- Step 4 (Code changes): 1 hour
- Step 5 (Final deploy & test): 1 hour
- Step 6 (Documentation): 1 hour
- **Total: 4 hours (0.5 days)**

**Risk Level**: LOW
- FastAPI service deployment verified before starting
- Simple environment variable changes
- Tested code changes locally first
- Easy rollback procedure

**Ready to Proceed**: Yes, after FastAPI service deployment is confirmed
