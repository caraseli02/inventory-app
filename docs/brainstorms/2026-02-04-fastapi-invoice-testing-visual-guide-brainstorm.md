---
date: 2026-02-04
topic: fastapi-invoice-testing-visual-guide
---

# FastAPI Invoice Testing - Visual Testing Guide Enhancement

## What We're Building

Improve the manual testing experience for FastAPI invoice integration by transforming `FASTAPI_INTEGRATION.md` from a text-heavy guide into a visual, interactive document with checklists, tables, and clear success criteria. This reduces friction and makes testing faster and more reliable.

## Why This Approach

**Approaches considered:**
- Approach A (Test Fixtures): Create sample invoice PDFs - deferred (requires time to acquire/create real invoices)
- Approach B (Validation Script): Create bash automation script - good, but not highest value right now
- Approach C (Enhanced Guide): Improve documentation with visual aids and checklists - **CHOSEN**

**Rationale for Approach C:**
1. **Fastest value** - Pure documentation improvement, no code changes, immediate impact
2. **Low risk** - Doesn't introduce new scripts or files to maintain
3. **Fits existing patterns** - Matches SUPABASE_SETUP.md style with emojis, tables, step-by-step format
4. **YAGNI principle** - Start simple with visual aids before investing in automation or test fixtures
5. **User feedback** - You want documentation improvements to make testing easier

**Reference patterns from codebase:**
- SUPABASE_SETUP.md uses ✅/❌/⚠️ indicators
- Test result templates use status tables and screenshots
- quick-test.sh provides immediate feedback and checklists
- E2E tests show step-by-step with console logs and screenshots

## Key Decisions

- **Decision 1**: Add visual checklists at each major testing step
  - Rationale: Provides clear "done/not done" indicators
  - Trade-off: Increases document length but improves usability

- **Decision 2**: Create tables for expected results vs actual results
  - Rationale: Makes validation fast with side-by-side comparison
  - Trade-off: More visual density in document

- **Decision 3**: Add copy-paste ready code blocks for quick CLI testing
  - Rationale: Reduces manual typing errors in curl commands
  - Trade-off: More vertical space, but higher accuracy

- **Decision 4**: Include emoji indicators throughout for quick scanning
  - Rationale: Matches project's existing documentation style
  - Trade-off: None - consistent with patterns

- **Decision 5**: Add troubleshooting flowchart/table for quick error resolution
  - Rationale: Common errors can be resolved faster with lookup table
  - Trade-off: Additional section, but high value

- **Decision 6**: Create "Quick Test" section for common scenarios
  - Rationale: Developers often want to test just one thing quickly
  - Trade-off: Duplicates content, but provides faster path

- **Decision 7**: Add visual success criteria table at the end
  - Rationale: Makes it easy to verify what "done" looks like
  - Trade-off: More content, but reduces ambiguity

## Open Questions

- None - Ready to proceed with implementation

## Next Steps

→ `/workflows:plan` to implement the enhanced FASTAPI_INTEGRATION.md with:
1. Visual checklists for each testing phase
2. Expected vs actual results tables
3. Copy-paste ready code blocks
4. Troubleshooting quick-reference table
5. Quick test scenarios section
6. Success criteria summary table

---

# Enhancement Details

## Section 1: Prerequisites Checklist

Add a visual checklist before testing starts:

```markdown
## Prerequisites ✅

Before starting manual testing, verify:

### Environment Setup
- [ ] FastAPI service running: `curl http://localhost:8000/health`
- [ ] Frontend app running: `curl http://localhost:5173`
- [ ] Environment variables configured in `.env`:
  - [ ] `VITE_INVOICE_API_URL=http://localhost:8000`
  - [ ] `VITE_INVOICE_API_KEY=dev-key-12345`
  - [ ] `VITE_INVOICE_API_REQUIRE_AUTH=false`

### Browser Tools
- [ ] DevTools Console open (F12 on Windows/Linux, Option+Cmd+J on Mac)
- [ ] Network tab visible for request monitoring
- [ ] Errors filter enabled in Console
- [ ] Disable browser cache for testing

### Test Data
- [ ] Sample invoice PDF ready to upload
- [ ] Expected product names, quantities, prices documented
- [ ] Expected supplier name, invoice number, date noted
```

## Section 2: Testing Steps with Checkpoints

Enhance existing steps with visual checkpoints:

```markdown
## Manual Testing Steps

### Step 1: Upload Invoice

**Action:**
1. Navigate to http://localhost:5173
2. Click "Import from Invoice" button
3. Upload PDF invoice (drag-drop or file picker)

**Checkpoint:** ✅ Upload dialog appears
**Checkpoint:** ✅ File selection completes
**Checkpoint:** ✅ Progress bar starts moving

**Expected UI State:**
```
┌─────────────────────────────────┐
│  Import from Invoice           │
├─────────────────────────────────┤
│  [Upload PDF Invoice Here]   │  ← Drag & Drop Zone
│  📊 50%                  │  ← Progress Bar
└─────────────────────────────────┘
```

---

### Step 2: Verify Extraction Results

**Action:**
1. Wait for OCR completion (progress reaches 100%)
2. Review preview table
3. Check product data accuracy

**Checkpoint:** ✅ Preview table appears
**Checkpoint:** ✅ Product count matches invoice
**Checkpoint:** ✅ No console errors

**Expected UI State:**
```
┌─────────────────────────────────────────────────┐
│  ✅ Extraction Complete                  │
├───────────────────────────────────────────────┤
│  Product Name  | Qty  | Price  | Barcode  │
│  Milk 1L       | 12    | €1.35  | 012345... │
│  Bread Whole    | 5     | €2.50  | 987654... │
│  ...                              │
└───────────────────────────────────────────────┘
```

---

### Step 3: Edit and Validate

**Action:**
1. Click edit button on products needing changes
2. Add missing barcodes if needed
3. Fix any OCR errors

**Checkpoint:** ✅ Edit mode activates
**Checkpoint:** ✅ Changes saved successfully
**Checkpoint:** ✅ No validation errors

---

### Step 4: Import to Inventory

**Action:**
1. Click "Import [N] Products" button
2. Verify products appear in inventory list
3. Check stock IN movements

**Checkpoint:** ✅ Import button enabled
**Checkpoint:** ✅ Import completes successfully
**Checkpoint:** ✅ Products visible in inventory
```

## Section 3: Expected Results Table

Add quick comparison table:

```markdown
## Expected Results

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
```

## Section 4: Troubleshooting Quick-Reference

Create lookup table for common issues:

```markdown
## Troubleshooting Quick Reference

| Symptom | Likely Cause | Quick Fix | Reference |
|----------|---------------|------------|------------|
| "Network error while processing" | FastAPI server down | `curl http://localhost:8000/health` | Step 1 in guide |
| "Invalid or missing API key" | Env var missing or wrong | Check `.env` file values | Prerequisites |
| "Invalid file type" | Not a PDF | Verify file is `.pdf` format | Error 400 |
| "No products found" | Poor quality/handwritten invoice | Try cleaner invoice | Issue 422 |
| "Progress stuck at 50%" | Server timeout | Check FastAPI logs | Network tab |
| "Products not importing" | Backend mismatch | Verify Supabase connection | API docs |

### Error Resolution Flowchart

```text
┌───────────────────────┐
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

## Section 5: Quick Test Scenarios

Add shortcut sections for focused testing:

```markdown
## Quick Test Scenarios

### Quick Test 1: Simple Invoice (Sanity Check)
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

### Quick Test 2: Barcode Detection
**Purpose:** Verify OCR extracts barcodes correctly

**Steps:**
1. Upload invoice with known barcodes
2. Check preview table for barcode column
3. Verify codes match expected values

**Expected:** ✅ Barcodes displayed in preview (or "No barcode" if absent)

---

### Quick Test 3: Error Handling
**Purpose:** Verify error messages are user-friendly

**Steps:**
```bash
1. Upload non-PDF file (try .jpg)
2. Verify error message appears
3. Try empty/corrupted PDF
4. Verify "Invalid PDF file" error
```

**Expected:** ✅ Clear, actionable error messages

## Section 6: Copy-Paste Ready Commands

Provide ready-to-use command blocks:

```markdown
## Quick CLI Commands

### Check Server Health
```bash
curl -i http://localhost:8000/health
# Expected: HTTP/1.1 200 OK
```

### Test FastAPI Endpoint (No Auth)
```bash
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/invoice.pdf"
# Expected: JSON response with products array
```

### Test FastAPI Endpoint (With Auth)
```bash
curl -X POST http://localhost:8000/extract \
  -H "X-API-Key: dev-key-12345" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/invoice.pdf"
# Expected: JSON response with products array
```

### Test Frontend Server
```bash
curl -i http://localhost:5173
# Expected: HTML response from React app
```

### Monitor Console in Browser
```javascript
// Paste in DevTools Console (F12)
// Monitor for errors during testing
window.addEventListener('error', (e) => {
  console.error('Error:', e);
});
// Filter Console by: error, warn
```

## Section 7: Success Criteria Summary

Add final verification table:

```markdown
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
```

## Success Criteria

Implementation complete when:
- [ ] FASTAPI_INTEGRATION.md updated with all enhancements
- [ ] Document follows SUPABASE_SETUP.md patterns
- [ ] Visual aids (tables, checklists, emojis) added
- [ ] Troubleshooting section added
- [ ] Quick test scenarios included
- [ ] Copy-paste commands provided
- [ ] Success criteria summary table added
- [ ] Testing verified by at least one person
