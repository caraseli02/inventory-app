/**
 * Invoice OCR and Data Extraction
 *
 * Hybrid approach using:
 * 1. Google Cloud Vision API for OCR (1,000 pages free/month)
 * 2. GPT-4o mini for parsing OCR text into structured JSON (~$0.001/invoice)
 *
 * Total cost: $0-0.10/month for typical small business
 */

export interface InvoiceProduct {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  barcode?: string;
}

export interface InvoiceData {
  products: InvoiceProduct[];
  supplier?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  totalAmount?: number;
}

export interface InvoiceOCRResult {
  success: boolean;
  data?: InvoiceData;
  error?: string;
  ocrText?: string; // Raw OCR text for debugging
}

/**
 * Step 1: Perform OCR using Google Cloud Vision API
 * Free tier: 1,000 pages/month
 */
async function performOCR(file: File): Promise<string> {
  const apiKey = import.meta.env.VITE_GOOGLE_CLOUD_VISION_API_KEY;

  if (!apiKey) {
    throw new Error('Google Cloud Vision API key not configured. Please set VITE_GOOGLE_CLOUD_VISION_API_KEY in your .env file.');
  }

  // Convert file to base64
  const base64 = await fileToBase64(file);
  const base64Content = base64.split(',')[1]; // Remove data:image/...;base64, prefix

  // Call Google Cloud Vision API
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Content,
            },
            features: [
              {
                type: 'DOCUMENT_TEXT_DETECTION',
                maxResults: 1,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `Google Cloud Vision API error: ${response.statusText}`
    );
  }

  const result = await response.json();
  const textAnnotations = result.responses[0]?.textAnnotations;

  if (!textAnnotations || textAnnotations.length === 0) {
    throw new Error('No text detected in the image. Please ensure the invoice is clear and readable.');
  }

  // First annotation contains the full text
  return textAnnotations[0].description;
}

/**
 * Step 2: Parse OCR text into structured invoice data using GPT-4o mini
 * Cost: ~$0.001 per invoice
 */
async function parseInvoiceText(ocrText: string): Promise<InvoiceData> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    // Fallback: Try basic regex parsing if OpenAI is not configured
    console.warn('OpenAI API key not configured. Using basic parsing (less accurate).');
    return basicParseInvoice(ocrText);
  }

  const prompt = `You are an invoice data extraction assistant. Extract the following information from this invoice OCR text:

1. Supplier name (if present)
2. Invoice number (if present)
3. Invoice date (if present, in YYYY-MM-DD format)
4. All products/line items with:
   - Product name
   - Quantity (as a number)
   - Unit price (as a number, in euros)
   - Total price (as a number, in euros)
   - Barcode (if present, usually 8-13 digits)

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "supplier": "string or null",
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "totalAmount": number or null,
  "products": [
    {
      "name": "string",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "barcode": "string or null"
    }
  ]
}

Important:
- Product name is REQUIRED (skip rows without a product name)
- If quantity is missing, use 1
- If prices are missing, use 0
- Extract all line items, not just the first few
- Remove any VAT/tax line items
- Barcodes are usually EAN-13 (13 digits) or UPC (12 digits)

Invoice OCR Text:
${ocrText}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a precise invoice data extraction assistant. Always return valid JSON only, no markdown or explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0, // Deterministic output
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `OpenAI API error: ${response.statusText}`
      );
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI API');
    }

    // Parse JSON response (remove markdown code blocks if present)
    const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Define interface for raw API response
    interface RawInvoiceProduct {
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      barcode?: string | null;
    }

    interface RawInvoiceData {
      supplier?: string | null;
      invoiceNumber?: string | null;
      invoiceDate?: string | null;
      totalAmount?: number | null;
      products?: RawInvoiceProduct[];
    }

    const invoiceData: RawInvoiceData = JSON.parse(jsonText);

    // Validate and clean data
    return {
      supplier: invoiceData.supplier || undefined,
      invoiceNumber: invoiceData.invoiceNumber || undefined,
      invoiceDate: invoiceData.invoiceDate || undefined,
      totalAmount: invoiceData.totalAmount || undefined,
      products: (invoiceData.products || [])
        .filter((p: RawInvoiceProduct) => p.name && p.name.trim().length > 0)
        .map((p: RawInvoiceProduct) => ({
          name: p.name.trim(),
          quantity: Number(p.quantity) || 1,
          unitPrice: Number(p.unitPrice) || 0,
          totalPrice: Number(p.totalPrice) || 0,
          barcode: p.barcode || undefined,
        })),
    };
  } catch (error) {
    console.error('GPT-4o mini parsing failed, falling back to basic parsing:', error);
    return basicParseInvoice(ocrText);
  }
}

/**
 * Fallback: Basic regex-based parsing (less accurate than GPT-4o mini)
 * Used when OpenAI API is not configured
 */
function basicParseInvoice(ocrText: string): InvoiceData {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l);
  const products: InvoiceProduct[] = [];

  // Try to extract basic product lines
  // This is a simplified parser and may not work for all invoice formats
  const productLineRegex = /^(.+?)\s+(\d+)\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/;

  for (const line of lines) {
    const match = line.match(productLineRegex);
    if (match) {
      const [, name, qty, price, total] = match;
      products.push({
        name: name.trim(),
        quantity: parseInt(qty),
        unitPrice: parseFloat(price.replace(',', '.')),
        totalPrice: parseFloat(total.replace(',', '.')),
      });
    }
  }

  return {
    products,
    supplier: undefined,
    invoiceNumber: undefined,
    invoiceDate: undefined,
  };
}

/**
 * Main function: Extract invoice data from uploaded file
 *
 * @param file - Invoice file (PDF, JPG, PNG)
 * @param onProgress - Optional callback for progress updates (0-100)
 * @returns Invoice data extraction result
 */
export async function extractInvoiceData(
  file: File,
  onProgress?: (progress: number) => void
): Promise<InvoiceOCRResult> {
  try {
    onProgress?.(10);

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload a PDF, JPG, or PNG file.',
      };
    }

    onProgress?.(20);

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size exceeds 10MB limit. Please upload a smaller file.',
      };
    }

    onProgress?.(30);

    // For PDFs, convert first page to image
    if (file.type === 'application/pdf') {
      // TODO: Implement PDF to image conversion using pdf.js
      // For now, return error for PDFs
      return {
        success: false,
        error: 'PDF support coming soon. Please upload a JPG or PNG image of the invoice for now.',
      };
    }

    onProgress?.(40);

    // Step 1: Perform OCR
    const ocrText = await performOCR(file);
    onProgress?.(70);

    // Step 2: Parse OCR text into structured data
    const invoiceData = await parseInvoiceText(ocrText);
    onProgress?.(90);

    // Validate that we got at least one product
    if (!invoiceData.products || invoiceData.products.length === 0) {
      return {
        success: false,
        error: 'No products found in the invoice. Please ensure the invoice is clear and contains product line items.',
        ocrText,
      };
    }

    onProgress?.(100);

    return {
      success: true,
      data: invoiceData,
      ocrText,
    };
  } catch (error) {
    console.error('Invoice extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract invoice data',
    };
  }
}

/**
 * Helper: Convert file to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
