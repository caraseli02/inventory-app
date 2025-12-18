/**
 * Invoice OCR and Data Extraction
 *
 * Hybrid approach using:
 * 1. Google Cloud Vision API for OCR (1,000 pages free/month)
 * 2. GPT-4o mini for parsing OCR text into structured JSON (~$0.001/invoice)
 *
 * Security: API calls are proxied through Supabase Edge Functions
 * to keep API keys secure on the server side.
 *
 * Total cost: $0-0.10/month for typical small business
 */

import { logger } from './logger';
import { supabase } from './supabase';

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

// Valid file types for invoice upload
export const VALID_INVOICE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;
export const VALID_INVOICE_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const;

/**
 * Step 1: Perform OCR using Google Cloud Vision API via Supabase Edge Function
 * Free tier: 1,000 pages/month
 * Security: API key is kept secure on the server side
 *
 * @param file - Image file to process (JPG/PNG only)
 * @returns Extracted text from the invoice
 * @throws Error if file is corrupted, network fails, or API returns error
 *
 * Note: This function does not implement automatic retries. Network errors
 * should be handled by the caller if retry logic is needed. Timeout is
 * handled by the Edge Function (30 seconds).
 */
async function performOCR(file: File): Promise<string> {
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

  // Call Supabase Edge Function for OCR
  try {
    const { data, error } = await supabase.functions.invoke('invoice-ocr', {
      body: { imageBase64: base64Content },
    });

    if (error) {
      const errorMessage = error.message || 'Failed to perform OCR on invoice image';
      logger.error('Invoice OCR Edge Function error', {
        fileName: file.name,
        errorMessage,
        errorContext: error.context,
        timestamp: new Date().toISOString(),
      });
      throw new Error(errorMessage); // Throw the SAME message we logged
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      logger.error('Invalid response structure from OCR Edge Function', {
        fileName: file.name,
        receivedData: data,
      });
      throw new Error('Invalid response from OCR service - please ensure you are using the latest app version');
    }

    if (!data.text || typeof data.text !== 'string') {
      logger.error('Missing or invalid text field in OCR response', {
        fileName: file.name,
        dataKeys: Object.keys(data),
        textType: typeof data.text,
      });
      throw new Error('Invalid text data from OCR service');
    }

    logger.info('OCR processing completed successfully', {
      fileName: file.name,
      textLength: data.text.length,
    });

    return data.text;
  } catch (error) {
    // If error was already thrown with a message, re-throw it
    if (error instanceof Error && error.message && !error.message.includes('Invalid response')) {
      throw error;
    }

    // Check for actual network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const networkErrorMessage = 'Network error while processing invoice. Please check your internet connection.';
      logger.error('Network error during OCR', {
        fileName: file.name,
        errorMessage: error.message,
      });
      throw new Error(networkErrorMessage);
    }

    logger.error('Unexpected error during OCR', {
      fileName: file.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error('An unexpected error occurred during OCR processing. Please try again.');
  }
}

/**
 * Step 2: Parse OCR text into structured invoice data using GPT-4o mini via Supabase Edge Function
 * Cost: ~$0.001 per invoice
 * Security: API key is kept secure on the server side
 */
async function parseInvoiceText(ocrText: string): Promise<InvoiceData> {
  logger.debug('Starting AI-powered invoice parsing', {
    ocrTextLength: ocrText.length,
  });

  // Call Supabase Edge Function for parsing
  try {
    const { data, error } = await supabase.functions.invoke('invoice-parse', {
      body: { ocrText },
    });

    if (error) {
      const errorMessage = error.message || 'Failed to parse invoice text';
      logger.error('Invoice parse Edge Function error', {
        errorMessage,
        errorContext: error.context,
        timestamp: new Date().toISOString(),
      });
      throw new Error(errorMessage); // Throw the SAME message we logged
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      logger.error('Invalid response structure from parse Edge Function', {
        receivedData: data,
      });
      throw new Error('Invalid response from parsing service - please ensure you are using the latest app version');
    }

    if (!Array.isArray(data.products)) {
      logger.error('Missing or invalid products field in parse response', {
        dataKeys: Object.keys(data),
        productsType: typeof data.products,
      });
      throw new Error('Invalid product data from parsing service');
    }

    // The Edge Function already validates and cleans the data
    const invoiceData: InvoiceData = {
      supplier: data.supplier,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      totalAmount: data.totalAmount,
      products: data.products || [],
    };

    logger.info('Invoice parsing completed successfully', {
      productCount: invoiceData.products.length,
      hasSupplier: !!invoiceData.supplier,
      hasInvoiceNumber: !!invoiceData.invoiceNumber,
    });

    return invoiceData;
  } catch (error) {
    // If error was already thrown with a message, re-throw it
    if (error instanceof Error && error.message && !error.message.includes('Invalid response')) {
      throw error;
    }

    // Check for actual network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const networkErrorMessage = 'Network error while parsing invoice. Please check your internet connection.';
      logger.error('Network error during invoice parsing', {
        errorMessage: error.message,
      });
      throw new Error(networkErrorMessage);
    }

    logger.error('Unexpected error during invoice parsing', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error('An unexpected error occurred during invoice parsing. Please try again.');
  }
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
      logger.warn('Progress callback failed - UI progress updates may be inaccurate', {
        progress,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
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
        errorCode: error && 'code' in error ? (error as { code?: number }).code : undefined, // Some browsers include error codes
        errorFull: error, // Log the full error object
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
