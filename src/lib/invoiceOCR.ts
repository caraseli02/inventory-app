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
}

export interface InvoiceOCRFailure {
  readonly success: false;
  readonly error: string;
}

export type InvoiceOCRResult = InvoiceOCRSuccess | InvoiceOCRFailure;

// Valid file types for invoice upload (PDF only)
export const VALID_INVOICE_TYPES = ['application/pdf'] as const;
export const VALID_INVOICE_EXTENSIONS = ['.pdf'] as const;

// FastAPI response interface
interface FastAPIExtractResponse {
  products: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    raw_code?: string;
  }>;
  supplier?: string;
  invoice_number?: string;
  date?: string;
  total_amount?: number;
  currency?: string;
  confidence_score?: number;
}

/**
 * Main function: Extract invoice data from uploaded PDF
 *
 * @param file - Invoice PDF file
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
      });
    }
  };

  try {
    safeProgress(10);

    // Validate file type (PDF only)
    if (!VALID_INVOICE_TYPES.includes(file.type)) {
      logger.warn('Invalid file type rejected', {
        fileName: file.name,
        fileType: file.type,
        validTypes: Array.from(VALID_INVOICE_TYPES),
      });
      return {
        success: false,
        error: 'Invalid file type. Please upload a PDF file.',
      };
    }

    // Validate file extension
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const validExtensions = VALID_INVOICE_EXTENSIONS as readonly string[];
    if (!validExtensions.includes(fileExt)) {
      logger.warn('Invalid file extension rejected', {
        fileName: file.name,
        fileExtension: fileExt,
        validExtensions: Array.from(VALID_INVOICE_EXTENSIONS),
      });
      return {
        success: false,
        error: 'Invalid file extension. Please upload a PDF file.',
      };
    }

    safeProgress(20);

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
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

    // Prepare request to FastAPI /extract endpoint
    const apiUrl = import.meta.env.VITE_INVOICE_API_URL || 'http://localhost:8000';
    const extractUrl = `${apiUrl}/extract`;

    // Prepare FormData with the file
    const formData = new FormData();
    formData.append('file', file);

    // Prepare headers with optional API key
    const headers: Record<string, string> = {};
    const apiKey = import.meta.env.VITE_INVOICE_API_KEY;
    const requireAuth = import.meta.env.VITE_INVOICE_API_REQUIRE_AUTH === 'true';

    if (requireAuth || apiKey) {
      headers['X-API-Key'] = apiKey || '';
    }

    logger.debug('Sending request to FastAPI /extract endpoint', {
      url: extractUrl,
      hasApiKey: !!apiKey,
      requireAuth,
      fileName: file.name,
    });

    safeProgress(40);

    // Call FastAPI /extract endpoint
    let response: Response;
    try {
      response = await fetch(extractUrl, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (error) {
      logger.error('Network error during invoice extraction', {
        url: extractUrl,
        fileName: file.name,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: 'Network error while processing invoice. Please check your internet connection and try again.',
      };
    }

    safeProgress(70);

    // Handle authentication errors
    if (response.status === 401) {
      logger.error('Authentication failed', {
        url: extractUrl,
        fileName: file.name,
      });
      return {
        success: false,
        error: 'Invalid or missing API key. Please check your API configuration.',
      };
    }

    // Handle client errors (400, 422)
    if (response.status === 400 || response.status === 422) {
      logger.error('Invalid PDF or request error', {
        url: extractUrl,
        fileName: file.name,
        status: response.status,
      });
      return {
        success: false,
        error: 'Invalid PDF file. Please ensure the file is a valid PDF document.',
      };
    }

    // Handle other HTTP errors
    if (!response.ok) {
      logger.error('HTTP error from FastAPI', {
        url: extractUrl,
        fileName: file.name,
        status: response.status,
        statusText: response.statusText,
      });
      return {
        success: false,
        error: `Error processing invoice: ${response.status} ${response.statusText}`,
      };
    }

    // Parse response
    let responseData: FastAPIExtractResponse;
    try {
      responseData = await response.json();
    } catch (error) {
      logger.error('Failed to parse FastAPI response', {
        url: extractUrl,
        fileName: file.name,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: 'Invalid response from invoice service. Please try again.',
      };
    }

    // Validate response structure
    if (!responseData || typeof responseData !== 'object') {
      logger.error('Invalid response structure from FastAPI', {
        fileName: file.name,
        receivedData: responseData,
      });
      return {
        success: false,
        error: 'Invalid response from invoice service. Please ensure you are using the latest app version.',
      };
    }

    if (!Array.isArray(responseData.products)) {
      logger.error('Missing or invalid products field in response', {
        fileName: file.name,
        dataKeys: Object.keys(responseData),
        productsType: typeof responseData.products,
      });
      return {
        success: false,
        error: 'Invalid product data from invoice service',
      };
    }

    // Require total_amount from server
    if (responseData.total_amount === undefined || responseData.total_amount === null) {
      logger.error('Missing total_amount in response', {
        fileName: file.name,
        dataKeys: Object.keys(responseData),
      });
      return {
        success: false,
        error: 'Invoice total amount not found in response. Please ensure the invoice contains a total.',
      };
    }

    // Validate that we got at least one product
    if (responseData.products.length === 0) {
      logger.warn('No products found in response', {
        fileName: file.name,
      });
      return {
        success: false,
        error: 'No products found in the invoice. Please ensure the invoice contains product line items.',
      };
    }

    safeProgress(90);

    // Map FastAPI response to InvoiceData
    const invoiceData: InvoiceData = {
      products: responseData.products.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        unitPrice: product.unit_price,
        totalPrice: product.total_price,
        barcode: product.raw_code,
      })),
      supplier: responseData.supplier,
      invoiceNumber: responseData.invoice_number,
      invoiceDate: responseData.date,
      totalAmount: responseData.total_amount,
    };

    // Ignore currency and confidence_score as per plan

    safeProgress(100);

    logger.info('Invoice extraction completed successfully', {
      fileName: file.name,
      productCount: invoiceData.products.length,
      hasSupplier: !!invoiceData.supplier,
      hasInvoiceNumber: !!invoiceData.invoiceNumber,
      totalAmount: invoiceData.totalAmount,
    });

    return {
      success: true,
      data: invoiceData,
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
