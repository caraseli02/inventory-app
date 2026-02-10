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
}

export interface InvoiceOCRFailure {
  readonly success: false;
  readonly error: string;
}

export type InvoiceOCRResult = InvoiceOCRSuccess | InvoiceOCRFailure;

// Valid file types for invoice upload (PDF only)
export const VALID_INVOICE_TYPES = ['application/pdf'] as const;
export const VALID_INVOICE_EXTENSIONS = ['.pdf'] as const;
const MIN_UPLOAD_TIMEOUT_MS = 210000;
const COLD_START_BUFFER_MS = 60000;

function getUploadTimeoutMs(fileSizeBytes: number): number {
  const sizeAdaptiveMs = (fileSizeBytes / (1024 * 1024)) * 1000 + COLD_START_BUFFER_MS;
  return Math.max(MIN_UPLOAD_TIMEOUT_MS, sizeAdaptiveMs);
}

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
}

/**
 * Validate product fields from FastAPI response
 */
function isValidProduct(product: FastAPIExtractResponse['products'][0]): boolean {
  return (
    typeof product.name === 'string' &&
    product.name.trim().length > 0 &&
    product.name.length <= 500 &&
    typeof product.quantity === 'number' &&
    !isNaN(product.quantity) &&
    Number.isFinite(product.quantity) &&
    product.quantity > 0 &&
    product.quantity <= 10000 &&
    typeof product.unit_price === 'number' &&
    !isNaN(product.unit_price) &&
    Number.isFinite(product.unit_price) &&
    product.unit_price >= 0 &&
    product.unit_price <= 1000000 &&
    typeof product.total_price === 'number' &&
    !isNaN(product.total_price) &&
    Number.isFinite(product.total_price) &&
    product.total_price >= 0 &&
    (product.raw_code === undefined ||
      (typeof product.raw_code === 'string' && product.raw_code.length <= 50))
  );
}

/**
 * Check if value is a valid number
 */
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && Number.isFinite(value);
}

/**
 * Upload file with progress tracking using XMLHttpRequest
 */
async function uploadWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (progress: number) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    // Track actual upload progress (40% → 70%)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const uploadProgress = 40 + (e.loaded / e.total) * 30;
        onProgress?.(Math.round(uploadProgress));
      }
    });

    xhr.onload = () => {
      // Upload complete, server processing: 70% → 90%
      onProgress?.(90);
      resolve(new Response(xhr.responseText, { status: xhr.status }));
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out'));
    };

    // Keep frontend timeout above backend timeout to avoid premature client aborts.
    const timeoutMs = getUploadTimeoutMs(file.size);
    xhr.timeout = timeoutMs;

    xhr.open('POST', url);

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.send(formData);
  });
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
    if (!(VALID_INVOICE_TYPES as readonly string[]).includes(file.type)) {
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

    // Use server-side proxy in production to avoid exposing API keys in client bundle.
    const proxyUrl = import.meta.env.VITE_INVOICE_PROXY_URL;
    const directDevApiUrl = import.meta.env.DEV ? import.meta.env.VITE_INVOICE_API_URL : undefined;
    const extractUrl = proxyUrl
      ? proxyUrl
      : directDevApiUrl
        ? `${directDevApiUrl.replace(/\/$/, '')}/extract`
        : '/api/extract-invoice';

    // Forward user session when available so proxy can validate auth server-side.
    const headers: Record<string, string> = {};
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      logger.warn('Unable to read Supabase session for invoice proxy request', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    logger.debug('Sending request to FastAPI /extract endpoint', {
      url: extractUrl,
      mode: extractUrl === '/api/extract-invoice' || extractUrl === proxyUrl ? 'proxy' : 'direct-dev',
      fileName: file.name,
    });

    safeProgress(40);

    // Call FastAPI /extract endpoint with real upload progress
    let response: Response;
    try {
      response = await uploadWithProgress(extractUrl, file, headers, onProgress);
    } catch (error) {
      // Handle timeout errors (both AbortError and explicit timeout message)
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Upload timed out')) {
        logger.error('Upload timed out', {
          fileName: file.name,
          fileSize: file.size,
          timeoutMs: getUploadTimeoutMs(file.size),
        });
        return {
          success: false,
          error: 'Invoice processing is taking longer than expected (up to ~3.5 minutes). Please wait and try again.',
        };
      }

      // Handle network errors
      if (error instanceof Error && error.message === 'Upload failed') {
        logger.error('Network error during invoice extraction', {
          url: extractUrl,
          fileName: file.name,
          errorMessage: error.message,
        });
        return {
          success: false,
          error: 'Network error while processing invoice. Please check your internet connection and try again.',
        };
      }

      // Handle unexpected errors
      logger.error('Unexpected error during file upload', {
        url: extractUrl,
        fileName: file.name,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return {
        success: false,
        error: 'Unexpected error during upload. Please try again or contact support if the problem persists.',
      };
    }

    safeProgress(90);

    // Handle authentication errors
    if (response.status === 401) {
      logger.error('Authentication failed', {
        url: extractUrl,
        fileName: file.name,
      });
      return {
        success: false,
        error: 'Unauthorized request. Please check your server-side invoice API configuration.',
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

    // Validate total_amount type and value
    if (
      typeof responseData.total_amount !== 'number' ||
      !isValidNumber(responseData.total_amount) ||
      responseData.total_amount < 0
    ) {
      logger.error('Invalid total_amount type in response', {
        fileName: file.name,
        receivedType: typeof responseData.total_amount,
        receivedValue: responseData.total_amount,
      });
      return {
        success: false,
        error: 'Invalid invoice total amount received from service',
      };
    }

    // Validate all products before mapping
    const invalidProduct = responseData.products.find((p) => !isValidProduct(p));
    if (invalidProduct) {
      logger.error('Invalid product data in response', {
        fileName: file.name,
        invalidProduct: JSON.stringify(invalidProduct),
        productIndex: responseData.products.indexOf(invalidProduct),
      });
      return {
        success: false,
        error: 'Invalid product data received from invoice service. Please ensure that invoice contains valid product information.',
      };
    }

    // Map FastAPI response to InvoiceData (now validated)
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
