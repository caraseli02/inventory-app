# Invoice Automation Research

**Version**: 0.2.0 (research)
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

**✅ SOLUTION FOUND**: Google Cloud Vision API + GPT-4o mini
- 🎁 **1,000 pages FREE per month** (ongoing, not a trial!)
- 💰 **$0-0.10/month** for typical small business
- 📊 **99%+ accuracy** with hybrid approach
- ⚡ **90-95% time savings** (15-40 min → 1-2 min per invoice)
- ✅ **Pay only when business grows** - sustainable free tier!

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

### Option 1: Google Cloud Vision API 🏆 BEST FREE OPTION

**Why It's Perfect**:
- 🎁 **1,000 pages FREE per month** (ongoing, not a trial!)
- 💰 After free tier: Only $1.50 per 1,000 pages (extremely cheap)
- 🎁 New users get $300 credit for 90 days
- 📊 99.56% accuracy on standard documents
- ⚡ Processes in 4-5 seconds

**What You Get**:
- FREE for 500+ invoices/month (if 2 pages each)
- Even if business grows: 100 invoices/month = 200 pages = $0.30/month
- Only pay if you exceed 1,000 pages/month

**Pros**:
- ✅ Best free tier (1,000 pages/month ongoing)
- ✅ Pay only when business grows
- ✅ Enterprise-grade reliability (Google Cloud)
- ✅ Excellent accuracy (99.56%)
- ✅ No credit card required for free tier
- ✅ Returns structured text (JSON)

**Cons**:
- ❌ Not specialized for invoices (requires parsing logic)
- ❌ Need to extract line items manually from text
- ❌ Slightly more complex integration than specialized APIs

**Cost Estimate** (for 50 invoices/month, avg 2 pages):
- 100 pages/month: **$0.00** (well under 1,000 free pages)
- Even at 200 invoices (400 pages): **$0.00**
- Only start paying after 1,000 pages/month!

**Complexity**: Medium (requires text parsing after OCR)

### Option 2: GPT-4o Mini Vision 💰 CHEAPEST PAID OPTION

**Approach**: Use OpenAI's GPT-4o mini with vision to analyze invoices

**Why It's Great**:
- 💰 **Extremely cheap**: ~$0.000013 per invoice page
- 🧠 **Intelligent extraction**: Understands context and can extract structured data
- 🎯 **Flexible**: Handles any invoice format with prompt engineering
- 📋 Returns JSON directly (no parsing needed)

**Pros**:
- ✅ Almost free (100 invoices = ~$0.003/month)
- ✅ Extremely flexible with prompts
- ✅ Can handle irregular/handwritten invoices
- ✅ Extracts line items automatically
- ✅ Same OpenAI account if already using AI features

**Cons**:
- ❌ Requires prompt engineering
- ❌ Token-based pricing (slightly less predictable)
- ❌ Need to convert PDF to images first

**Cost Estimate** (for 50 invoices/month, avg 2 pages):
- 100 images × 85 tokens × $0.00000015 = **$0.00127/month**
- Essentially free for small businesses!

**Complexity**: Medium (requires OpenAI API + prompt design)

### Option 3: Veryfi Invoice OCR 📱 MOBILE-OPTIMIZED

**Best For**: Mobile-first apps with moderate volume

**Features**:
- 📱 100 documents/month FREE
- 💰 After: $99/month for 500 documents
- ⚡ Fast processing (3-5 seconds)
- 📊 98-99% accuracy

**Pros**:
- ✅ 100 free documents/month (50 invoices if 2 pages)
- ✅ Purpose-built for invoices
- ✅ Extracts line items automatically
- ✅ Mobile SDKs available

**Cons**:
- ❌ Limited free tier (100 documents)
- ❌ Expensive after free tier ($99/month)

**Cost Estimate** (for 50 invoices/month, avg 2 pages):
- 100 pages/month: **$0.00** (within free tier)
- Just at the limit for free tier

**Complexity**: Low (simple API integration)

### Option 4: Tesseract OCR 🔓 COMPLETELY FREE & OPEN SOURCE

**Approach**: Self-hosted open-source OCR engine

**Why Consider It**:
- 💰 **100% free** (no limits, no costs)
- 🔓 **Open source** (full control)
- 📦 **Active community** (many tutorials/libraries)
- 🌍 Supports 100+ languages

**Pros**:
- ✅ Completely free forever
- ✅ No API limits or quotas
- ✅ Full control over processing
- ✅ Can run on your own server
- ✅ Great for simple, clean invoices

**Cons**:
- ❌ Lower accuracy (90-95% vs 98-99%)
- ❌ Requires preprocessing (image cleanup)
- ❌ More development work
- ❌ No line item extraction (just text OCR)
- ❌ Need to build parsing logic

**Cost Estimate**:
- **$0.00/month** (self-hosted)

**Complexity**: High (requires significant development)

### Option 5: Email Automation + OCR (Full Automation)

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
- OCR API: $0/month (Google Cloud Vision - free tier)
- **Total: ~$5-10/month**

**Cost Estimate** (Make.com):
- Make.com: $9/month (10k operations)
- OCR API: $0/month (Google Cloud Vision - free tier)
- **Total: ~$9/month**

**Complexity**: High (requires workflow automation setup, but reusable templates available)

### Option 6: Manual Upload with OCR (Simplest)

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
- $0/month (Google Cloud Vision free tier)

**Complexity**: Low-Medium (add upload UI + OCR API integration)

## Recommended Approach

### Phase 1: Manual Upload with Google Cloud Vision (MVP) 🎯

**Why Google Cloud Vision**:
- 🎁 **1,000 pages FREE per month** (ongoing, not trial)
- 💰 **Zero cost** until business scales significantly
- 🏢 **Enterprise reliability** (Google Cloud infrastructure)
- 📊 **99.56% accuracy**
- ✅ **No credit card required** for free tier

**Implementation**:
1. Add "Import from Invoice" button to app (next to "Import from Excel")
2. User uploads PDF/image invoice
3. Send to Google Cloud Vision API (free!)
4. Parse OCR text response to extract line items
5. Use GPT-4o mini ($0.001/invoice) to structure data into JSON
6. Map to product fields (Name, Barcode, Price, Quantity)
7. Show preview table (like Excel import)
8. User reviews and confirms import

**Hybrid Approach** (Best of Both Worlds):
- Use **Google Cloud Vision** for OCR (free 1,000 pages/month)
- Use **GPT-4o mini** to parse OCR text into structured JSON (~$0.001/invoice)
- **Total cost**: ~$0.10/month for 100 invoices

**Estimated Development Time**: 2-3 days

**Cost**: $0-0.10/month (essentially free!)

### Phase 2: Email Automation (Future Enhancement)

Once Phase 1 is validated, add full automation:
1. Set up n8n workflow (use community template)
2. Configure email monitoring
3. Auto-extract with Google Cloud Vision (still free!)
4. Parse with GPT-4o mini
5. Create products in Airtable
6. Send notification to owner for review

**Estimated Development Time**: 2-3 days (using n8n templates)

**Cost**: $5-10/month (just n8n hosting, OCR is still free!)

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
// Google Cloud Vision + GPT-4o mini hybrid approach
export async function extractInvoiceData(file: File): Promise<InvoiceData>

// Step 1: Google Cloud Vision OCR (free)
async function performOCR(file: File): Promise<string>

// Step 2: GPT-4o mini to parse text into structured data
async function parseInvoiceText(ocrText: string): Promise<InvoiceData>

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
# Google Cloud Vision (free 1,000 pages/month)
VITE_GOOGLE_CLOUD_VISION_API_KEY=your_api_key_here

# GPT-4o mini (optional, for better parsing)
VITE_OPENAI_API_KEY=your_api_key_here  # If already using OpenAI
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

| API | Free Tier | Cost After Free | Accuracy | Speed | Complexity | Best For |
|-----|-----------|----------------|----------|-------|------------|----------|
| **Google Cloud Vision** 🏆 | 1,000 pages/mo | $1.50/1,000 pages | 99.56% | 4-5s | Medium | **Best choice** - generous free tier |
| **GPT-4o mini** 💰 | None | ~$0.001/invoice | 95-98% | 1-3s | Medium | Ultra-cheap parsing + extraction |
| **Veryfi** | 100 docs/mo | $99/mo (500 docs) | 98-99% | 3-5s | Low | Mobile apps, limited volume |
| **Tesseract OCR** 🔓 | Unlimited | $0 (self-hosted) | 90-95% | Varies | High | Maximum control, zero cost |
| **Hybrid (GCV + GPT-4o mini)** ⭐ | 1,000 pages/mo | ~$0.001/invoice | 99%+ | 5-8s | Medium | **RECOMMENDED** - best of both |

**Recommendation**: Use **Hybrid Approach** (Google Cloud Vision + GPT-4o mini):
- Google Cloud Vision for OCR (free 1,000 pages/month)
- GPT-4o mini for intelligent parsing (~$0.001 per invoice)
- **Total Cost**: $0-0.10/month for small businesses

## Success Metrics

**Efficiency Gains**:
- Manual entry: 15-40 minutes per invoice → Automated: 1-2 minutes (review only)
- Manual error rate: ~10% → OCR error rate: 1-2%
- Time savings: **90-95%**

**Cost Savings**:
- Manual labor: $10-20/invoice (at $30/hour) → Automated: $0.001-0.00/invoice
- **ROI**: Almost immediate - essentially free with Google Cloud Vision
- **First 1,000 pages/month**: $0.00 (covers 500+ invoices)

**User Experience**:
- No Excel skills required
- Works on tablet (same device as inventory app)
- Immediate product creation (no desktop computer needed)

## Risks & Mitigation

**Risk 1: OCR Accuracy Issues**
- **Mitigation**: Always show preview before importing (user can edit)
- **Mitigation**: Start with well-formatted supplier invoices (test accuracy first)

**Risk 2: Invoice Format Variations**
- **Mitigation**: GPT-4o mini handles any format with prompt engineering
- **Mitigation**: Can adjust prompts for specific supplier formats

**Risk 3: Cost Overruns**
- **Mitigation**: 1,000 free pages covers 500+ invoices/month (very generous)
- **Mitigation**: Set billing alerts in Google Cloud Console
- **Mitigation**: Even after free tier, only $1.50 per 1,000 pages

**Risk 4: Barcode Extraction Issues**
- **Mitigation**: Not all invoices include barcodes (this is fine)
- **Mitigation**: Owner can scan barcodes later using edit dialog (existing feature)

## Next Steps

1. **Set Up APIs** (Day 1)
   - Create Google Cloud account (get $300 credit)
   - Enable Vision API (no credit card required for free tier)
   - Set up OpenAI account for GPT-4o mini (optional)
   - Test both APIs with sample invoice

2. **Test with Real Invoices** (Day 2-3)
   - Get sample PDFs from grocery owner
   - Test Google Cloud Vision OCR accuracy
   - Test GPT-4o mini parsing accuracy
   - Validate line item extraction
   - Check if barcodes are included in invoices

3. **Implement Phase 1 MVP** (Week 2)
   - Build InvoiceUploadDialog component
   - Integrate Google Cloud Vision API
   - Integrate GPT-4o mini for parsing
   - Add product mapping logic
   - Test end-to-end flow

4. **User Testing** (Week 3)
   - Owner uploads 5-10 real invoices
   - Measure accuracy and time savings
   - Gather feedback
   - Fine-tune parsing prompts

5. **Evaluate Phase 2** (Week 4+)
   - If Phase 1 successful, plan email automation
   - Set up n8n instance
   - Configure workflow with community templates

## Conclusion

**Invoice automation is highly feasible, essentially FREE, and extremely high-value.** 🎯

**Recommended Path**:
- ✅ Use **Google Cloud Vision API** (1,000 pages FREE per month - ongoing!)
- ✅ Add **GPT-4o mini** for parsing (~$0.001 per invoice)
- ✅ Estimated cost: **$0-0.10/month** for small businesses
- ✅ Estimated dev time: **2-3 days**
- ✅ Expected time savings: **90-95%** (15-40 min → 1-2 min per invoice)
- ✅ **Pay only when business grows** - scales with success!

**Key Benefits Over Mindee**:
- 🎁 4x more free pages (1,000 vs 250)
- 🎁 Ongoing free tier (not 14-day trial)
- 💰 Cheaper after free tier ($1.50/1,000 vs $100/1,000)
- 🏢 Enterprise infrastructure (Google Cloud)
- ✅ No credit card required

This approach validates the concept with ZERO cost before business scales.

## References & Sources

**Google Cloud Vision & Document AI**:
- [Pricing | Document AI | Google Cloud](https://cloud.google.com/document-ai/pricing)
- [Invoice OCR in 3–5 Seconds: 2025 Benchmark - Veryfi vs Google Cloud Vision vs Mindee](https://www.veryfi.com/ai-insights/invoice-ocr-competitors-veryfi/)
- [Use Google Cloud Vision API to process invoices and receipts](https://www.leanx.eu/tutorials/use-google-cloud-vision-api-to-process-invoices-and-receipts)

**Free & Low-Cost OCR Solutions**:
- [Free Invoice OCR Solutions: How to Scan Invoices at No Cost](https://invoicedataextraction.com/blog/free-invoice-ocr-solutions)
- [9 Best OCR Software for Invoice Processing in 2025](https://www.intuz.com/blog/best-ocr-tools-for-invoice-processing)
- [10 Best AI OCR Tools for Invoice Automation (2025)](https://www.koncile.ai/en/ressources/top-10-ocr-tools-for-invoices-2025)

**Open Source OCR**:
- [Tesseract OCR: Is it still the best open-source OCR in 2025?](https://www.koncile.ai/en/ressources/is-tesseract-still-the-best-open-source-ocr)
- [Invoice Data Extraction using Tesseract OCR](https://medium.com/@hasanat.abul/invoice-extraction-using-tesseract-ocr-2ec75813d59b)
- [GitHub - invoice2data: Extract structured data from PDF invoices](https://github.com/invoice-x/invoice2data)

**API Integration & Automation**:
- [List of 8 Best Invoice Data Extraction Tools in 2025](https://klearstack.com/top-8-invoice-data-extraction-software)
- [Invoice data extraction – Microsoft Document Intelligence](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/invoice)
- [Veryfi Invoice OCR API](https://www.veryfi.com/invoice-ocr-api/)

**Workflow Automation**:
- [Zapier vs Make vs n8n: The Ultimate Comparison for 2025](https://www.c-sharpcorner.com/article/zapier-vs-make-vs-n8n-the-ultimate-comparison-for-workflow-automation-in-2025/)
- [Extract Invoice Data from Email to Google Sheets using GPT-4o - n8n workflow](https://n8n.io/workflows/4376-extract-invoice-data-from-email-to-google-sheets-using-gpt-4o-ai-automation/)
- [n8n vs Make vs Zapier [2025 Comparison]](https://www.digidop.com/blog/n8n-vs-make-vs-zapier)

**OpenAI Vision Pricing**:
- [Pricing | OpenAI API](https://openai.com/api/pricing/)
- [GPT-4o mini Vision Cost Discussion - OpenAI Community](https://community.openai.com/t/gpt-4o-mini-high-vision-cost/872382)
- [OpenAI GPT-4o API Pricing Guide 2025](https://blog.laozhang.ai/ai/openai-gpt-4o-api-pricing-guide/)

**Claude Vision (Alternative)**:
- [LLM API Pricing Comparison (2025): OpenAI, Gemini, Claude](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)
- [Claude API Pricing Calculator & Cost Guide](https://costgoat.com/pricing/claude-api)

## Changelog

### 0.2.0 (2025-12-16)
- Updated recommendation to **Google Cloud Vision API** (1,000 pages free/month)
- Added hybrid approach: Google Cloud Vision + GPT-4o mini
- Replaced Mindee (14-day trial) with sustainable free-tier solution
- Added 4 new solution options (Google Vision, GPT-4o mini, Veryfi, Tesseract)
- Updated cost estimates: $0-0.10/month (vs previous $0-10/month)
- Added comprehensive API comparison table
- Updated technical implementation for hybrid approach
- User concern: Mindee has 14-day trial, needs pay-as-you-grow solution

### 0.1.0 (2025-12-16)
- Initial research document
- Compared 4 solution approaches
- Recommended Phase 1 (manual upload + OCR) as MVP
- Identified Mindee as initial API candidate
- Outlined technical implementation requirements
