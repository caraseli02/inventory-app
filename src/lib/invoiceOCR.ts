/**
 * Invoice OCR and Data Extraction
 *
 * Hybrid approach using:
 * 1. Google Cloud Vision API for OCR (1,000 pages free/month)
 * 2. GPT-4o mini for parsing OCR text into structured JSON (~$0.001/invoice)
 *
 * Total cost: $0-0.10/month for typical small business
 */

import { logger } from './logger';

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

// Discriminated union for type-safe results
export interface InvoiceOCRSuccess {
  readonly success: true;
  readonly data: InvoiceData;
  readonly ocrText?: string;
}

export interface InvoiceOCRFailure {
  readonly success: false;
  readonly error: string;
  readonly ocrText?: string;
}

export type InvoiceOCRResult = InvoiceOCRSuccess | InvoiceOCRFailure;

// Internal types for API response parsing (moved to module scope)
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

// Valid file types for invoice upload
export const VALID_INVOICE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;
export const VALID_INVOICE_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const;

/**
 * Step 1: Perform OCR using Google Cloud Vision API
 * Free tier: 1,000 pages/month
 */
async function performOCR(file: File): Promise<string> {
  const apiKey = import.meta.env.VITE_GOOGLE_CLOUD_VISION_API_KEY;

  if (!apiKey) {
    logger.error('Google Cloud Vision API key not configured', {
      envVar: 'VITE_GOOGLE_CLOUD_VISION_API_KEY',
    });
    throw new Error('Google Cloud Vision API key not configured. Please set VITE_GOOGLE_CLOUD_VISION_API_KEY in your .env file.');
  }

  logger.info('Starting OCR processing', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  });

  // Convert file to base64
  let base64Content: string;
  try {
    const base64 = await fileToBase64(file);
    base64Content = base64.split(',')[1]; // Remove data:image/...;base64, prefix
  } catch (error) {
    logger.error('Failed to convert file to base64', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to read invoice file. Please ensure the file is not corrupted.');
  }

  // Call Google Cloud Vision API
  let response: Response;
  try {
    response = await fetch(
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
  } catch (error) {
    logger.error('Google Cloud Vision API network error', {
      fileName: file.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error('Network error while contacting Google Cloud Vision API. Please check your internet connection.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMessage = error.error?.message || `Google Cloud Vision API error: ${response.statusText}`;

    logger.error('Google Cloud Vision API request failed', {
      fileName: file.name,
      status: response.status,
      statusText: response.statusText,
      errorMessage,
    });

    if (response.status === 401) {
      throw new Error('Google Cloud Vision API authentication failed. Please check your API key.');
    }
    if (response.status === 429) {
      throw new Error('Google Cloud Vision API quota exceeded. Please try again later or upgrade your plan.');
    }

    throw new Error(errorMessage);
  }

  const result = await response.json();
  const textAnnotations = result.responses[0]?.textAnnotations;

  if (!textAnnotations || textAnnotations.length === 0) {
    logger.warn('No text detected in invoice image', {
      fileName: file.name,
      fileType: file.type,
    });
    throw new Error('No text detected in the image. Please ensure the invoice is clear and readable.');
  }

  logger.info('OCR processing completed successfully', {
    fileName: file.name,
    textLength: textAnnotations[0].description.length,
  });

  return textAnnotations[0].description;
}

/**
 * Step 2: Parse OCR text into structured invoice data using GPT-4o mini
 * Cost: ~$0.001 per invoice
 */
async function parseInvoiceText(ocrText: string): Promise<InvoiceData> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    logger.error('OpenAI API key not configured', {
      envVar: 'VITE_OPENAI_API_KEY',
      requiredFor: 'AI-powered invoice parsing',
    });
    throw new Error(
      'AI invoice extraction requires OpenAI API key. Please set VITE_OPENAI_API_KEY in your .env file. ' +
      'Get a free key at https://platform.openai.com/api-keys'
    );
  }

  logger.debug('Starting AI-powered invoice parsing', {
    ocrTextLength: ocrText.length,
  });

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

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
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
  } catch (error) {
    logger.error('OpenAI API network error', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error('Network error while contacting OpenAI API. Please check your internet connection.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMessage = error.error?.message || `OpenAI API error: ${response.statusText}`;

    logger.error('OpenAI API request failed', {
      status: response.status,
      statusText: response.statusText,
      errorMessage,
    });

    if (response.status === 401) {
      throw new Error('OpenAI API authentication failed. Please check your API key.');
    }
    if (response.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please try again later.');
    }

    throw new Error(errorMessage);
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content;

  if (!content) {
    logger.error('No response from OpenAI API', {
      resultChoices: result.choices?.length,
    });
    throw new Error('No response from OpenAI API');
  }

  // Parse JSON response (remove markdown code blocks if present)
  const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let invoiceData: RawInvoiceData;
  try {
    invoiceData = JSON.parse(jsonText);
  } catch (error) {
    logger.error('Failed to parse OpenAI JSON response', {
      errorMessage: error instanceof Error ? error.message : String(error),
      responsePreview: jsonText.substring(0, 200),
    });
    throw new Error('Failed to parse AI response. The invoice format may be unsupported.');
  }

  // Validate and clean data
  const cleanedData = {
    supplier: invoiceData.supplier || undefined,
    invoiceNumber: invoiceData.invoiceNumber || undefined,
    invoiceDate: invoiceData.invoiceDate || undefined,
    totalAmount: invoiceData.totalAmount || undefined,
    products: (invoiceData.products || [])
      .filter((p: RawInvoiceProduct) => p.name?.trim())
      .map((p: RawInvoiceProduct) => ({
        name: p.name.trim(),
        quantity: Number(p.quantity) || 1,
        unitPrice: Number(p.unitPrice) || 0,
        totalPrice: Number(p.totalPrice) || 0,
        barcode: p.barcode || undefined,
      })),
  };

  logger.info('Invoice parsing completed successfully', {
    productCount: cleanedData.products.length,
    hasSupplier: !!cleanedData.supplier,
    hasInvoiceNumber: !!cleanedData.invoiceNumber,
  });

  return cleanedData;
}

/**
 * Main function: Extract invoice data from uploaded file
 *
 * @param file - Invoice file (JPG, PNG only - PDF support removed)
 * @param onProgress - Optional callback for progress updates (0-100)
 * @returns Invoice data extraction result
 */
export async function extractInvoiceData(
  file: File,
  onProgress?: (progress: number) => void
): Promise<InvoiceOCRResult> {
  logger.info('Starting invoice extraction', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  });

  // Safe progress callback wrapper
  const safeProgress = (progress: number) => {
    try {
      onProgress?.(progress);
    } catch (error) {
      logger.debug('Progress callback failed', {
        progress,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  };

  try {
    safeProgress(10);

    // Validate file type (PDF removed)
    const validTypes: string[] = Array.from(VALID_INVOICE_TYPES);
    if (!validTypes.includes(file.type)) {
      logger.warn('Invalid file type rejected', {
        fileName: file.name,
        fileType: file.type,
        validTypes: Array.from(VALID_INVOICE_TYPES),
      });
      return {
        success: false,
        error: 'Invalid file type. Please upload a JPG or PNG file.',
      };
    }

    safeProgress(20);

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      logger.warn('File size exceeds limit', {
        fileName: file.name,
        fileSize: file.size,
        maxSize,
      });
      return {
        success: false,
        error: 'File size exceeds 10MB limit. Please upload a smaller file.',
      };
    }

    safeProgress(30);
    safeProgress(40);

    // Step 1: Perform OCR
    const ocrText = await performOCR(file);
    safeProgress(70);

    // Step 2: Parse OCR text into structured data
    const invoiceData = await parseInvoiceText(ocrText);
    safeProgress(90);

    // Validate that we got at least one product
    if (!invoiceData.products || invoiceData.products.length === 0) {
      logger.warn('No products found in parsed invoice', {
        fileName: file.name,
        hasOcrText: !!ocrText,
        ocrTextLength: ocrText.length,
      });
      return {
        success: false,
        error: 'No products found in the invoice. Please ensure the invoice is clear and contains product line items.',
        ocrText,
      };
    }

    safeProgress(100);

    logger.info('Invoice extraction completed successfully', {
      fileName: file.name,
      productCount: invoiceData.products.length,
    });

    return {
      success: true,
      data: invoiceData,
      ocrText,
    };
  } catch (error) {
    logger.error('Invoice extraction failed', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract invoice data',
    };
  }
}

/**
 * Helper: Convert file to base64 string with enhanced error handling
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      logger.debug('File converted to base64 successfully', {
        fileName: file.name,
        fileSize: file.size,
      });
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      const error = reader.error;
      logger.error('FileReader failed to read file', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        errorName: error?.name,
        errorMessage: error?.message,
      });

      // Provide user-friendly error messages based on error type
      if (error?.name === 'NotFoundError') {
        reject(new Error('File not found. Please try selecting the file again.'));
      } else if (error?.name === 'NotReadableError') {
        reject(new Error('File cannot be read. The file may be corrupted or inaccessible.'));
      } else if (error?.name === 'SecurityError') {
        reject(new Error('Security error: Browser blocked file access.'));
      } else {
        reject(new Error('Failed to read file. Please try again.'));
      }
    };

    reader.readAsDataURL(file);
  });
}
