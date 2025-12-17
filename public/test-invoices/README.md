# Test Invoice Files

This directory contains HTML invoice files for testing the AI-powered invoice processing feature.

## How to Use These Test Files

### Step 1: Convert HTML to PNG/JPG

Open each HTML file in your browser and take screenshots:

1. **invoice-simple.html** - Basic invoice with 5 products, no barcodes
   - Tests: Basic OCR, product extraction, supplier info
   - Expected: 5 products extracted (Lapte, Paine, Apa, Oua, Cafea)

2. **invoice-with-barcodes.html** - Invoice with EAN-13 barcodes
   - Tests: Barcode extraction, multiple products
   - Expected: 7 products with valid barcodes

3. **invoice-mixed.html** - Real-world invoice with some products having barcodes
   - Tests: Mixed barcode scenario, VAT handling
   - Expected: 9 products, some with barcodes, some without

### Step 2: Screenshot Instructions

**macOS:**
1. Open HTML file in browser (Safari/Chrome)
2. Press `Cmd + Shift + 4`
3. Press `Space` to capture full window
4. Click on browser window
5. Save as PNG in this directory

**Windows:**
1. Open HTML file in browser
2. Press `Win + Shift + S`
3. Select area to capture
4. Save as PNG in this directory

### Step 3: Test the Feature

1. Start dev server (already running at http://localhost:5174)
2. Go to Inventory page
3. Click "Import from Invoice" button
4. Upload one of the PNG files
5. Verify:
   - ✅ OCR extracts text correctly
   - ✅ AI parses products with names, quantities, prices
   - ✅ Barcodes are extracted when present
   - ✅ Supplier and invoice metadata extracted
   - ✅ Preview shows all products
   - ✅ Import creates products successfully

## Test Scenarios

### Scenario 1: Simple Invoice (No Barcodes)
**File:** invoice-simple.html
**Expected Results:**
- 5 products extracted
- Supplier: METRO Cash & Carry Romania
- Invoice #: INV-2025-001234
- Date: 2025-12-17
- All products without barcodes (can add later via edit)

### Scenario 2: Complete Invoice (With Barcodes)
**File:** invoice-with-barcodes.html
**Expected Results:**
- 7 products extracted
- All products have valid EAN-13 barcodes
- Supplier: Selgros Romania SRL
- Invoice #: SEL-2025-789456
- Total: €705.00

### Scenario 3: Mixed Invoice (Realistic)
**File:** invoice-mixed.html
**Expected Results:**
- 9 products extracted
- 6 products with barcodes
- 3 products without barcodes (marked as N/A)
- Supplier: Kaufland România SRL
- Invoice #: KF-RO-2025-456123
- VAT line should be excluded from products
- Total: €1,174.53

## Error Cases to Test

1. **Upload non-invoice image** - Should show clear error
2. **Upload blurry screenshot** - Should warn about text detection issues
3. **Upload file > 10MB** - Should show file size error
4. **Test without API keys** - Should show configuration error

## Validation Checklist

After testing with each invoice:
- [ ] OCR completes without errors
- [ ] Progress bar shows all stages
- [ ] Products table shows all items
- [ ] Barcodes display correctly (or "No barcode")
- [ ] Prices formatted as €X.XX
- [ ] Supplier name appears in summary
- [ ] Can go back and upload different invoice
- [ ] Import creates products in Airtable
- [ ] Products appear in inventory list
- [ ] No console errors in browser dev tools
- [ ] All logging uses logger (check Network tab)

## Notes

- All invoices use EUR currency (€) as per project standards
- Product names are in Romanian (realistic for the market)
- Barcodes are valid EAN-13 format where present
- Prices include 2 decimal places for accuracy
- Supplier info varies to test different formats
