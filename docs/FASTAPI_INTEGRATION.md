# FastAPI Integration Guide

Complete guide for integrating and testing the FastAPI invoice extraction service with the inventory app.

**Estimated Time**: 10-15 minutes

---

## Table of Contents

1. [Overview](#overview)
2. [FastAPI Contract](#fastapi-contract)
3. [Environment Configuration](#environment-configuration)
4. [Local Development Setup](#local-development-setup)
5. [Production Setup](#production-setup)
6. [Manual Testing](#manual-testing)
7. [Common Errors & Troubleshooting](#common-errors--troubleshooting)
8. [API Reference](#api-reference)

---

## Overview

The inventory app uses a FastAPI service to extract product data from PDF invoices. This service replaces the previous Supabase Edge Functions approach with a direct, simpler API integration.

**Key Benefits:**
- **Simpler architecture**: Single API call instead of two-step OCR + parse
- **Better performance**: No need for intermediate base64 encoding/decoding
- **Easy testing**: Direct file upload via multipart/form-data
- **Cost-effective**: Uses local or hosted FastAPI instance

**Workflow:**
1. Upload PDF invoice → FastAPI /extract endpoint
2. FastAPI extracts text and products from PDF
3. Returns structured JSON with products, supplier, and totals
4. Review and import products into inventory

---

## FastAPI Contract

### Endpoint

```
POST {VITE_INVOICE_API_URL}/extract
```

### Request

**Method:** `POST`
**Content-Type:** `multipart/form-data`
**Fields:**
- `file`: PDF invoice file (required)

**Headers (Optional):**
- `X-API-Key`: API key for authentication (required when `VITE_INVOICE_API_REQUIRE_AUTH=true`)

### Response 200 (Success)

```json
{
  "products": [
    {
      "name": "Milk 1L",
      "quantity": 12,
      "unit_price": 1.35,
      "total_price": 16.2,
      "raw_code": "0123456789012"
    }
  ],
  "supplier": "Supplier Name",
  "invoice_number": "INV-123",
  "date": "2026-02-01",
  "total_amount": 123.45,
  "currency": "EUR",
  "confidence_score": 0.92
}
```

**Field Mapping to App:**
| FastAPI Field | App Field |
|---------------|------------|
| `date` | `invoiceDate` |
| `raw_code` | `barcode` |
| `unit_price` | `unitPrice` |
| `total_price` | `totalPrice` |
| `invoice_number` | `invoiceNumber` |
| `total_amount` | `totalAmount` |

**Ignored Fields:** `currency`, `confidence_score` (for future use)

### Error Responses

| Status | Description |
|---------|-------------|
| 401 | Invalid or missing API key |
| 400 | Invalid file (not a PDF) |
| 422 | Validation error (malformed PDF) |
| 500 | Internal server error |

---

## Environment Configuration

### Required Environment Variables

Create or update your `.env` file with the following variables:

```bash
# FastAPI Service URL
VITE_INVOICE_API_URL=http://localhost:8000

# API Key (required if VITE_INVOICE_API_REQUIRE_AUTH=true)
VITE_INVOICE_API_KEY=dev-key-12345

# Require Authentication (true for production, false for local dev)
VITE_INVOICE_API_REQUIRE_AUTH=false
```

### Variable Details

#### VITE_INVOICE_API_URL
- **Required:** Yes
- **Default:** `http://localhost:8000`
- **Description:** URL of the FastAPI service
- **Examples:**
  - Local: `http://localhost:8000`
  - Docker: `http://localhost:8000` (same, but running in container)
  - Production: `https://api.yourdomain.com`

#### VITE_INVOICE_API_KEY
- **Required:** Conditional (if `VITE_INVOICE_API_REQUIRE_AUTH=true`)
- **Default:** `dev-key-12345` (for local development)
- **Description:** API key for authentication
- **Security:** Sent via `X-API-Key` header (client-side)
- **Note:** For production, generate a secure random key

#### VITE_INVOICE_API_REQUIRE_AUTH
- **Required:** No (defaults to `false`)
- **Values:** `true` or `false`
- **Description:** Whether to enforce API key authentication
- **Local Development:** Set to `false` to skip authentication
- **Production:** Set to `true` to require API key

---

## Local Development Setup

### Option 1: Running FastAPI with Docker

**Prerequisites:** Docker and Docker Compose installed

1. **Navigate to FastAPI project directory:**
   ```bash
   cd /path/to/fastapi-service
   ```

2. **Start the service:**
   ```bash
   docker-compose up
   ```

3. **Verify it's running:**
   ```bash
   curl http://localhost:8000/health
   ```

4. **Stop when done:**
   ```bash
   docker-compose down
   ```

### Option 2: Running FastAPI with uvicorn

**Prerequisites:** Python 3.8+, pip, and FastAPI project dependencies

1. **Navigate to FastAPI project directory:**
   ```bash
   cd /path/to/fastapi-service
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the service:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

4. **Verify it's running:**
   ```bash
   curl http://localhost:8000/health
   ```

5. **Stop with:** `Ctrl+C`

---

## Production Setup

### Step 1: Deploy FastAPI Service

Deploy your FastAPI service to a production server:

**Options:**
- **Vercel:** Deploy as a serverless function
- **AWS Lambda:** Deploy as a Lambda function with API Gateway
- **Google Cloud Run:** Deploy as a containerized service
- **Heroku/Render/Railway:** Deploy as a web service
- **Your own VPS:** Deploy with Docker and nginx

### Step 2: Configure Environment Variables

In your production hosting platform:

1. Set `VITE_INVOICE_API_URL` to your production URL
   - Example: `https://api.yourdomain.com`

2. Set `VITE_INVOICE_API_KEY` to a secure random key
   - Generate with: `openssl rand -hex 32`
   - Example: `abc123def456ghi789jkl012mno345pqr678`

3. Set `VITE_INVOICE_API_REQUIRE_AUTH` to `true`

### Step 3: Update .env.example

Update `.env.example` with production values (don't include real keys):

```bash
VITE_INVOICE_API_URL=https://api.yourdomain.com
VITE_INVOICE_API_KEY=your-production-api-key-here
VITE_INVOICE_API_REQUIRE_AUTH=true
```

---

## Manual Testing

### Quick CLI Commands

#### Check Server Health
```bash
curl -i http://localhost:8000/health
# Expected: HTTP/1.1 200 OK
```

#### Test FastAPI Endpoint (No Auth)
```bash
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/invoice.pdf"
# Expected: JSON response with products array
```

#### Test FastAPI Endpoint (With Auth)
```bash
curl -X POST http://localhost:8000/extract \
  -H "X-API-Key: dev-key-12345" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/invoice.pdf"
# Expected: JSON response with products array
```

#### Test Frontend Server
```bash
curl -i http://localhost:5173
# Expected: HTML response from React app
```

#### Monitor Console in Browser
```javascript
// Paste in DevTools Console (F12)
// Monitor for errors during testing
window.addEventListener('error', (e) => {
  console.error('Error:', e);
});
// Filter Console by: error, warn
```

---

### Prerequisites Checklist

### Prerequisites Checklist ✅

Before starting manual testing, verify:

#### Environment Setup
- [ ] **FastAPI service running** - `curl http://localhost:8000/health`
- [ ] **Frontend app running** - `curl http://localhost:5173`
- [ ] **Environment variables configured** in `.env`:
  - [ ] `VITE_INVOICE_API_URL=http://localhost:8000`
  - [ ] `VITE_INVOICE_API_KEY=dev-key-12345`
  - [ ] `VITE_INVOICE_API_REQUIRE_AUTH=false`

#### Browser Tools
- [ ] **DevTools Console open** (F12 on Windows/Linux, Option+Cmd+J on Mac)
- [ ] **Network tab visible** for request monitoring
- [ ] **Errors filter enabled** in Console
- [ ] **Disable browser cache** for testing

#### Test Data Preparation
- [ ] **Sample invoice PDF ready** - Choose a test invoice with known products
- [ ] **Expected results documented** - Note product names, quantities, prices
- [ ] **Supplier info noted** - Know supplier name, invoice number, date (if present)

1. **FastAPI service running** (see [Local Development Setup](#local-development-setup))
2. **App running:** `pnpm dev`
3. **Environment configured:** See [Environment Configuration](#environment-configuration)

### Test 1: Upload PDF via App UI

1. **Open the app:** Navigate to http://localhost:5173
2. **Go to Inventory page**
3. **Click "Import from Invoice" button**

**Checkpoint:** ✅ Import dialog appears
**Expected UI State:**
```
┌───────────────────────────────────┐
│  Import from Invoice            │
├───────────────────────────────────┤
│  [Upload PDF Invoice Here]   │  ← Dialog
└───────────────────────────────────┘
```

4. **Upload a PDF invoice:**
   - Click "Select Invoice File"
   - Choose a valid PDF invoice file

**Checkpoint:** ✅ File selection completes
**Checkpoint:** ✅ Progress bar starts moving
**Expected UI State:**
```
┌───────────────────────────────────┐
│  Import from Invoice            │
├───────────────────────────────────┤
│  Processing...               │  ← Progress Bar
│  📊 30%                      │
└───────────────────────────────────┘
```

5. **Verify extraction:**
   - Preview table should appear with extracted products
   - Supplier name (if present)
   - Invoice number (if present)
   - Total amount should match invoice

**Checkpoint:** ✅ Preview table appears
**Checkpoint:** ✅ Product count matches invoice
**Checkpoint:** ✅ No console errors

**Expected UI State:**
```
┌─────────────────────────────────────────────────┐
│  ✅ Extraction Complete                  │
├──────────────────────────────────────────────┤
│  Product Name  | Qty  | Price  | Barcode  │
│  Milk 1L       | 12    | €1.35  | 0123...  │
│  Bread Whole    | 5     | €2.50  | 9876...  │
│  ...                              │
└───────────────────────────────────────────────┘
```

6. **Review and edit:**
   - Check product names are correct
   - Verify quantities and prices
   - Add missing barcodes if needed

**Checkpoint:** ✅ Edit mode activates
**Checkpoint:** ✅ Changes saved successfully

7. **Import products:**
   - Click "Import [N] Products"
   - Verify products are added to inventory
   - Check stock IN movements were created

**Checkpoint:** ✅ Import button enabled
**Checkpoint:** ✅ Import completes successfully
**Checkpoint:** ✅ Products visible in inventory

#### Expected Results

| Test Aspect | Expected Result | How to Verify |
|-------------|-----------------|----------------|
| **Products Extracted** | ✅ Count matches invoice line items | Count products in preview table |
| **Product Names** | ✅ Names match invoice text | Compare name by name |
| **Quantities** | ✅ Accurate to invoice | Verify qty column |
| **Prices** | ✅ Unit and total match | Check unit_price × qty = total_price |
| **Supplier Info** | ✅ Extracted if present | Check summary card at top |
| **Barcodes** | ✅ Extracted if on invoice | Look for codes in preview table |
| **Import Success** | ✅ Products appear in inventory | Navigate to inventory list, verify new items |
| **Stock Movements** | ✅ Stock IN created | Check product details for stock count |
| **Console Errors** | ❌ Zero errors | Check DevTools Console (F12) |
| **Network Status** | ✅ 200 OK response | Check Network tab in DevTools |

### Test 2: Test with curl

**Test authentication (with API key):**
```bash
curl -X POST \
  http://localhost:8000/extract \
  -H "X-API-Key: dev-key-12345" \
  -F "file=@/path/to/invoice.pdf"
```

**Test without authentication:**
```bash
curl -X POST \
  http://localhost:8000/extract \
  -F "file=@/path/to/invoice.pdf"
```

**Expected Output:** JSON response with extracted data (see [FastAPI Contract](#fastapi-contract))

### Quick Test Scenarios

#### Quick Test 1: Simple Invoice OCR (Sanity Check)

**Purpose:** Verify basic end-to-end flow works

**Steps:**
```bash
1. Upload any simple PDF invoice
2. Verify products extracted (expect > 0)
3. Import products
4. Check inventory list
```

**Expected:** ✅ Products appear in inventory within 30 seconds

---

#### Quick Test 2: Barcode Detection

**Purpose:** Verify OCR extracts barcodes correctly

**Steps:**
```bash
1. Upload invoice with known barcodes
2. Check preview table for barcode column
3. Verify codes match expected values
```

**Expected:** ✅ Barcodes displayed in preview (or "No barcode" if absent)

---

#### Quick Test 3: Error Handling

**Purpose:** Verify error messages are user-friendly

**Steps:**
```bash
1. Upload non-PDF file (try .jpg)
2. Verify error message appears
3. Try empty/corrupted PDF
4. Verify "Invalid PDF file" error
```

**Expected:** ✅ Clear, actionable error messages

---

### Test 2: Test with curl

### Test 3: Error Scenarios

**Test 401 Unauthorized:**
```bash
curl -X POST \
  http://localhost:8000/extract \
  -H "X-API-Key: invalid-key" \
  -F "file=@/path/to/invoice.pdf"
```
**Expected:** 401 status, error message about invalid API key

**Test 400 Invalid File:**
```bash
curl -X POST \
  http://localhost:8000/extract \
  -F "file=@/path/to/image.jpg"
```
**Expected:** 400 status, error message about invalid file type

**Test Empty/Invalid PDF:**
```bash
# Create empty PDF or corrupted PDF
touch empty.pdf
curl -X POST \
  http://localhost:8000/extract \
  -F "file=@empty.pdf"
```
**Expected:** 422 status, error message about invalid PDF

---

## Common Errors & Troubleshooting

### Troubleshooting Quick Reference

| Symptom | Likely Cause | Quick Fix | Reference |
|----------|---------------|------------|------------|
| "Network error while processing" | FastAPI server down | `curl http://localhost:8000/health` | Step 1 in guide |
| "Invalid or missing API key" | Env var missing or wrong | Check `.env` file values | Prerequisites |
| "Invalid file type" | Not a PDF | Verify file is `.pdf` format | Error 400 |
| "No products found" | Poor quality/handwritten invoice | Try cleaner invoice | Issue 422 |
| Progress stuck at 50% | Server timeout | Check FastAPI logs | Network tab |
| Products not importing | Backend mismatch | Verify Supabase connection | API docs |

### Error Resolution Flowchart

```text
┌─────────────────────────┐
│  Error Occurred?     │
└──────────┬────────────┘
           │
           ├─ Network Error?
           │  └─→ Check FastAPI server status
           │     └─→ Verify VITE_INVOICE_API_URL
           │
           ├─ Auth Error (401)?
           │  └─→ Check API key in .env
           │     └─→ Set VITE_INVOICE_API_REQUIRE_AUTH=false
           │
           ├─ Validation Error (400/422)?
           │  └─→ Check file is valid PDF
           │     └─→ Try different invoice
           │
           └─ Empty Products?
               └─→ Verify invoice has line items
```

### Error: "Network error while processing invoice"

**Cause:** FastAPI service not running or unreachable

**Solution:**
1. Verify FastAPI service is running:
   ```bash
   curl http://localhost:8000/health
   ```
2. Check `VITE_INVOICE_API_URL` in `.env`
3. Check network/firewall settings

### Error: "Invalid or missing API key"

**Cause:** Authentication required but key is missing or incorrect

**Solution:**
1. Set `VITE_INVOICE_API_KEY` in `.env`
2. Set `VITE_INVOICE_API_REQUIRE_AUTH=false` for local dev
3. Verify API key matches FastAPI service configuration

### Error: "Invalid file type. Please upload a PDF file."

**Cause:** Uploaded file is not a PDF

**Solution:**
1. Verify file extension is `.pdf`
2. Check file MIME type is `application/pdf`
3. Use a different PDF file if current one is corrupted

### Error: "No products found in invoice"

**Cause:** FastAPI couldn't extract any products from the PDF

**Solution:**
1. Ensure PDF is a valid invoice with product line items
2. Check PDF quality (not scanned as image without OCR)
3. Try a different PDF invoice file
4. Contact FastAPI service administrator if issue persists

### Error: "Invoice total amount not found in response"

**Cause:** FastAPI response missing `total_amount` field

**Solution:**
1. Verify FastAPI service is returning complete responses
2. Check FastAPI service logs for errors
3. Contact FastAPI service administrator

### Error: "Invalid response from invoice service"

**Cause:** FastAPI response is malformed or unexpected

**Solution:**
1. Test FastAPI service with curl to verify it returns valid JSON
2. Check FastAPI service logs for errors
3. Verify FastAPI service version compatibility

---

## API Reference

### Field Mappings

The app maps FastAPI response fields to internal data structures:

| FastAPI Field | Type | App Field | Required |
|---------------|-------|------------|----------|
| `products` | Array | `products` | Yes |
| `products[].name` | string | `name` | Yes |
| `products[].quantity` | number | `quantity` | Yes |
| `products[].unit_price` | number | `unitPrice` | Yes |
| `products[].total_price` | number | `totalPrice` | Yes |
| `products[].raw_code` | string (optional) | `barcode` | No |
| `supplier` | string (optional) | `supplier` | No |
| `invoice_number` | string (optional) | `invoiceNumber` | No |
| `date` | string (optional) | `invoiceDate` | No |
| `total_amount` | number (optional) | `totalAmount` | Yes |
| `currency` | string (optional) | (ignored) | No |
| `confidence_score` | number (optional) | (ignored) | No |

### File Validation Rules

| Rule | Requirement | Error Message |
|-------|-------------|----------------|
| MIME Type | `application/pdf` | "Invalid file type. Please upload a PDF file." |
| Extension | `.pdf` | "Invalid file extension. Please upload a PDF file." |
| Size | ≤ 10 MB | "File size exceeds 10MB limit. Please upload a smaller file." |

### HTTP Status Codes

| Code | Meaning | App Error Message |
|------|----------|-------------------|
| 200 | Success | N/A (products extracted) |
| 401 | Unauthorized | "Invalid or missing API key. Please check your API configuration." |
| 400 | Bad Request | "Invalid PDF file. Please ensure file is a valid PDF document." |
| 422 | Unprocessable Entity | "Invalid PDF file. Please ensure file is a valid PDF document." |
| 500 | Server Error | "Error processing invoice: 500 Internal Server Error" |

---

## Support

For issues with:
- **App integration:** Check this guide and app logs
- **FastAPI service:** Contact FastAPI service administrator
- **API contract:** Review [FastAPI Contract](#fastapi-contract) section
- **Testing:** See [Manual Testing](#manual-testing) section

## Success Criteria Checklist

### Environment Setup
- [ ] FastAPI server responding to health checks
- [ ] Frontend app loads without errors
- [ ] Environment variables loaded correctly
- [ ] No TypeScript or build errors in console

### Invoice Extraction
- [ ] PDF upload completes (no errors)
- [ ] Progress bar reaches 100%
- [ ] Preview table appears
- [ ] Product count matches expectation
- [ ] Supplier info extracted (if present)
- [ ] Invoice number extracted (if present)
- [ ] Total amount matches invoice

### Data Quality
- [ ] Product names accurate (95%+ match rate)
- [ ] Quantities correct (±0 tolerance)
- [ ] Unit prices correct (±€0.01 tolerance)
- [ ] Total prices calculated correctly (unit × qty)
- [ ] Barcodes extracted where present

### Import Process
- [ ] Products imported to inventory successfully
- [ ] Stock IN movements created
- [ ] Stock counts update correctly
- [ ] No duplicate products created

### Error Handling
- [ ] Invalid file types rejected gracefully
- [ ] Large files (>10MB) rejected
- [ ] Network errors show user-friendly messages
- [ ] Auth errors provide clear guidance
- [ ] Empty products handled correctly

### Console & Network
- [ ] Zero unhandled exceptions
- [ ] Zero console errors
- [ ] Zero console warnings (except dev-mode warnings)
- [ ] HTTP responses all 2xx (except expected 401/400/422)
- [ ] Response times < 5 seconds

### Overall
- [ ] All critical tests pass ✅
- [ ] Documentation completed and reviewed
- [ ] Ready to merge to main
