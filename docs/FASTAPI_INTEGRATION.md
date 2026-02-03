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

### Prerequisites

1. **FastAPI service running** (see [Local Development Setup](#local-development-setup))
2. **App running:** `pnpm dev`
3. **Environment configured:** See [Environment Configuration](#environment-configuration)

### Test 1: Upload PDF via App UI

1. **Open the app:** Navigate to http://localhost:5173
2. **Go to Inventory page**
3. **Click "Import from Invoice" button**
4. **Upload a PDF invoice:**
   - Click "Select Invoice File"
   - Choose a valid PDF invoice file
5. **Verify extraction:**
   - Preview table should appear with extracted products
   - Supplier name (if present)
   - Invoice number (if present)
   - Total amount should match invoice
6. **Review and edit:**
   - Check product names are correct
   - Verify quantities and prices
   - Add missing barcodes if needed
7. **Import products:**
   - Click "Import [N] Products"
   - Verify products are added to inventory
   - Check stock IN movements were created

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
3. Use a different PDF file if the current one is corrupted

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
