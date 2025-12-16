# Invoice Automation Research

**Version**: 0.1.0 (research)
**Status**: RESEARCH
**Owner**: TBD
**Last Updated**: 2025-12-16
**Dependencies**: product_management.md, xlsx_integration.md

## Executive Summary

This document evaluates automated invoice processing solutions to replace the current manual workflow where grocery owners:
1. Receive supplier invoices (PDF/email)
2. Manually create Excel spreadsheet
3. Upload Excel to app

**Goal**: Automate steps 1-2 by extracting invoice data directly and creating products automatically.

## Problem Statement

**Current Workflow Pain Points**:
- Manual data entry is time-consuming (15-40 minutes per invoice)
- High error rate (~10% with manual entry)
- Delays between receiving invoices and updating inventory
- Requires computer skills to create Excel files

**Ideal Workflow**:
1. Owner receives invoice via email
2. Automation extracts product data (name, barcode, price, quantity)
3. Products automatically created in Airtable
4. Owner reviews and approves in app

## Solution Options

### Option 1: Dedicated Invoice OCR API ⭐ RECOMMENDED

**Best Solutions**:
- **Mindee Invoice OCR API**: 250 pages/month free, then $0.10/page
- **Nanonets**: Usage-based pricing, free tier available
- **Microsoft Document Intelligence**: Pay-per-use, enterprise-grade

**Pros**:
- ✅ Purpose-built for invoices (98-99% accuracy)
- ✅ Extracts line items automatically
- ✅ Handles multi-page, scanned, or photo invoices
- ✅ Returns structured JSON (easy integration)
- ✅ Supports multiple languages and currencies
- ✅ No template required (adaptive AI)

**Cons**:
- ❌ Requires API integration (development work)
- ❌ Per-page costs (but very low)

**Cost Estimate** (for 50 invoices/month, avg 2 pages):
- Mindee: 100 pages × $0.10 = $10/month (after free 250 pages)
- Very low cost for small businesses

**Complexity**: Medium (requires backend development)

### Option 2: GPT-4o Vision API

**Approach**: Use OpenAI's GPT-4o with vision capabilities to analyze invoice images/PDFs

**Pros**:
- ✅ Extremely flexible (can handle any invoice format)
- ✅ Can extract custom fields with prompt engineering
- ✅ Same API already potentially used for product AI suggestions
- ✅ Great for irregular/handwritten invoices

**Cons**:
- ❌ Higher cost per invoice ($0.002-0.01 per image depending on detail level)
- ❌ Requires careful prompt engineering
- ❌ May need multiple API calls for multi-page invoices
- ❌ Token-based pricing (harder to predict)

**Cost Estimate** (for 50 invoices/month, avg 2 pages):
- 100 images × ~$0.005 = $0.50-1.00/month (very rough estimate)
- Low cost, but less predictable than dedicated OCR

**Complexity**: Medium (requires OpenAI API setup + prompt engineering)

### Option 3: Email Automation + OCR (Full Automation)

**Approach**: Use workflow automation platform (n8n, Make, Zapier) to:
1. Monitor email inbox for invoices
2. Extract PDF attachments
3. Send to OCR API (Mindee or GPT-4o)
4. Parse results and create products in Airtable

**Best Platform**: **n8n** (open-source, self-hosted)
- ✅ Has ready-made workflow: "Extract Invoice Data from Email to Google Sheets using GPT-4o"
- ✅ Free if self-hosted (only pay for OCR API)
- ✅ 135+ invoice processing workflows in community library
- ✅ Native Airtable integration

**Alternative**: **Make.com** (cloud, more user-friendly)
- Free tier: 1,000 operations/month
- Paid: Starting at $9/month for 10,000 operations

**Pros**:
- ✅ Fully automated end-to-end (no manual upload)
- ✅ Owner just forwards invoice email
- ✅ Products created automatically in Airtable
- ✅ Can add approval step before creating products

**Cons**:
- ❌ Most complex to set up
- ❌ Requires server for n8n (or cloud subscription for Make/Zapier)
- ❌ More moving parts (email monitoring, OCR, database writes)

**Cost Estimate** (n8n self-hosted):
- n8n hosting: $5-10/month (DigitalOcean droplet or similar)
- OCR API: $10/month (Mindee)
- **Total: ~$15-20/month**

**Cost Estimate** (Make.com):
- Make.com: $9/month (10k operations)
- OCR API: $10/month
- **Total: ~$19/month**

**Complexity**: High (requires workflow automation setup, but reusable templates available)

### Option 4: Manual Upload with OCR (Simplest)

**Approach**: Add invoice upload feature to app (similar to Excel import):
1. Owner uploads PDF invoice in app
2. App sends to OCR API
3. Extracts products and shows preview
4. Owner reviews and confirms

**Pros**:
- ✅ Simplest to implement
- ✅ Owner has full control
- ✅ No email automation needed
- ✅ Works with any invoice source

**Cons**:
- ❌ Still requires manual upload step
- ❌ Not fully automated

**Cost Estimate**:
- Same as Option 1: ~$10/month (Mindee)

**Complexity**: Low-Medium (add upload UI + OCR API integration)

## Recommended Approach

### Phase 1: Manual Upload with OCR (MVP) ⭐

**Why**:
- Lowest complexity
- Validates OCR accuracy with real invoices
- Owner maintains control
- Easy to test and iterate

**Implementation**:
1. Add "Import from Invoice" button to app (next to "Import from Excel")
2. User uploads PDF/image invoice
3. Send to Mindee Invoice OCR API
4. Parse JSON response for line items
5. Map to product fields (Name, Barcode, Price, Quantity)
6. Show preview table (like Excel import)
7. User reviews and confirms import

**Estimated Development Time**: 1-2 days

**Cost**: $10/month (after 250 free pages)

### Phase 2: Email Automation (Future Enhancement)

Once Phase 1 is validated, add full automation:
1. Set up n8n workflow (use community template)
2. Configure email monitoring
3. Auto-extract and create products
4. Send notification to owner for review

**Estimated Development Time**: 2-3 days (using n8n templates)

**Cost**: $15-20/month

## Technical Implementation (Phase 1)

### Required Changes

**1. New UI Component**: `InvoiceUploadDialog.tsx`
```tsx
// Similar to Excel import dialog, but for PDF/images
- File upload (accept: .pdf, .jpg, .png)
- Progress indicator during OCR
- Preview table of extracted products
- Confirm/Cancel buttons
```

**2. New API Integration**: `lib/invoiceOCR.ts`
```typescript
// Mindee Invoice OCR API wrapper
export async function extractInvoiceData(file: File): Promise<InvoiceData>
export interface InvoiceData {
  products: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    barcode?: string;
  }>;
  supplier?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
}
```

**3. Environment Variables**:
```bash
VITE_MINDEE_API_KEY=your_api_key_here
```

**4. Product Mapping Logic**:
```typescript
// Map invoice line items to Product fields
- Extract product name → Name
- Extract barcode if present → Barcode
- Extract unit price → Price
- Extract quantity → Initial stock (create IN movement)
- Use supplier name if available → Supplier field
```

### API Comparison

| API | Free Tier | Cost After Free | Accuracy | Speed | Complexity |
|-----|-----------|----------------|----------|-------|------------|
| **Mindee** | 250 pages/mo | $0.10/page | 98-99% | <1s | Low |
| **Nanonets** | Trial available | Usage-based | 98-99% | <2s | Low |
| **GPT-4o Vision** | None | ~$0.005/image | 95-98% | 1-3s | Medium |
| **MS Document Intelligence** | 500 pages/mo | $0.001/page | 98-99% | <2s | Medium |

**Recommendation**: Start with **Mindee** for ease of use and generous free tier.

## Success Metrics

**Efficiency Gains**:
- Manual entry: 15-40 minutes per invoice → Automated: 1-2 minutes (review only)
- Manual error rate: ~10% → OCR error rate: 1-2%
- Time savings: **90-95%**

**Cost Savings**:
- Manual labor: $10-20/invoice (at $30/hour) → OCR: $0.10-0.20/invoice
- **ROI**: Pays for itself after processing 1-2 invoices

**User Experience**:
- No Excel skills required
- Works on tablet (same device as inventory app)
- Immediate product creation (no desktop computer needed)

## Risks & Mitigation

**Risk 1: OCR Accuracy Issues**
- **Mitigation**: Always show preview before importing (user can edit)
- **Mitigation**: Start with well-formatted supplier invoices (test accuracy first)

**Risk 2: Invoice Format Variations**
- **Mitigation**: Mindee is adaptive (no templates needed)
- **Mitigation**: Can train custom model if needed (paid tier)

**Risk 3: Cost Overruns**
- **Mitigation**: 250 free pages covers 125 invoices/month (likely sufficient)
- **Mitigation**: Set usage alerts in Mindee dashboard

**Risk 4: Barcode Extraction Issues**
- **Mitigation**: Not all invoices include barcodes (this is fine)
- **Mitigation**: Owner can scan barcodes later using edit dialog (existing feature)

## Next Steps

1. **Test with Real Invoices** (Week 1)
   - Get sample PDFs from grocery owner
   - Test with Mindee API (free trial)
   - Validate extraction accuracy
   - Check if barcodes are included in invoices

2. **Implement Phase 1 MVP** (Week 2-3)
   - Build InvoiceUploadDialog component
   - Integrate Mindee API
   - Add product mapping logic
   - Test end-to-end flow

3. **User Testing** (Week 4)
   - Owner uploads 5-10 real invoices
   - Measure accuracy and time savings
   - Gather feedback

4. **Evaluate Phase 2** (Week 5+)
   - If Phase 1 successful, plan email automation
   - Set up n8n instance
   - Configure workflow

## Conclusion

**Invoice automation is highly feasible, low-cost, and high-value.**

**Recommended Path**:
- ✅ Start with **Phase 1** (manual upload + OCR)
- ✅ Use **Mindee Invoice OCR API** (250 pages free, then $0.10/page)
- ✅ Estimated cost: **$0-10/month** for small business
- ✅ Estimated dev time: **1-2 days**
- ✅ Expected time savings: **90%** (15-40 min → 1-2 min per invoice)

This approach validates the concept with minimal investment before committing to full automation.

## References & Sources

**Invoice OCR Solutions**:
- [9 Best OCR Software for Invoice Processing in 2025](https://www.intuz.com/blog/best-ocr-tools-for-invoice-processing)
- [10 Best AI OCR Tools for Invoice Automation (2025)](https://www.koncile.ai/en/ressources/top-10-ocr-tools-for-invoices-2025)
- [Invoice OCR API – Mindee](https://www.mindee.com/product/invoice-ocr-api)
- [The Best Invoice OCR Software in 2025 - Klippa](https://www.klippa.com/en/ocr/financial-documents/invoices/)

**API Integration & Automation**:
- [Invoice data extraction – Microsoft Document Intelligence](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/invoice)
- [List of 8 Best Invoice Data Extraction Tools in 2025](https://klearstack.com/top-8-invoice-data-extraction-software)
- [Automate Invoice Data Extraction with AI - Docsumo](https://www.docsumo.com/solutions/documents/invoices)

**Workflow Automation**:
- [Zapier vs Make vs n8n: The Ultimate Comparison for 2025](https://www.c-sharpcorner.com/article/zapier-vs-make-vs-n8n-the-ultimate-comparison-for-workflow-automation-in-2025/)
- [Extract Invoice Data from Email to Google Sheets using GPT-4o - n8n workflow](https://n8n.io/workflows/4376-extract-invoice-data-from-email-to-google-sheets-using-gpt-4o-ai-automation/)
- [Invoices from Gmail to Drive and Google Sheets - n8n workflow](https://n8n.io/workflows/3016-invoices-from-gmail-to-drive-and-google-sheets/)
- [n8n vs Make vs Zapier [2025 Comparison]](https://www.digidop.com/blog/n8n-vs-make-vs-zapier)

**OpenAI Vision Pricing**:
- [Pricing | OpenAI](https://openai.com/api/pricing/)
- [OpenAI GPT4 Vision Cost Calculator](https://ultimategptcalculator.com/vision)
- [OpenAI GPT-4o API Pricing Guide 2025](https://blog.laozhang.ai/ai/openai-gpt-4o-api-pricing-guide/)

## Changelog

### 0.1.0 (2025-12-16)
- Initial research document
- Compared 4 solution approaches
- Recommended Phase 1 (manual upload + OCR) as MVP
- Identified Mindee as best API for cost/ease balance
- Outlined technical implementation requirements
