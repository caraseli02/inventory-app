import { logger } from './logger';
import { resolveSupabaseAccessToken } from './invoiceAuth';

export interface InvoiceProduct {
  rowId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  barcode?: string;
  weightKgCandidate?: number;
  // Optional backend suggestions (FastAPI /extract additive fields)
  categorySuggestion?: string;
  categoryConfidence?: number;
  categorySource?: 'llm';
}

export interface InvoiceData {
  products: InvoiceProduct[];
  supplier?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  totalAmount?: number;
}

function isLocalhostApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function getInvoiceRequestHeaders(): Promise<Record<string, string> | null> {
  // Do not set Content-Type for FormData uploads.
  // The browser/XHR must set it with the multipart boundary.
  const headers: Record<string, string> = {};

  const authRequired = String(import.meta.env.VITE_INVOICE_API_REQUIRE_AUTH ?? 'true')
    .trim()
    .toLowerCase() !== 'false';

  if (!authRequired) return headers;

  const accessToken = await resolveSupabaseAccessToken();
  if (!accessToken) {
    logger.warn('Missing Supabase access token for invoice request');
    return null;
  }

  headers.Authorization = `Bearer ${accessToken}`;
  return headers;
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
    row_id?: string;
    name: string;
    quantity: number | string;
    unit_price: number | string;
    total_price: number | string;
    raw_code?: string | number | null;
    weight_kg_candidate?: number | null;
    category_suggestion?: string | null;
    category_confidence?: number | null;
    category_source?: 'llm' | null;
    weight_kg?: number | null;
  }>;
  supplier?: string;
  invoice_number?: string;
  date?: string;
  total_amount?: number;
}

interface FastAPIErrorResponse {
  detail?: unknown;
  message?: string;
  error?: string;
}

/**
 * Normalize FastAPI/Proxy error payloads into a readable one-line message.
 */
function getApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as FastAPIErrorResponse;

  if (typeof p.message === 'string' && p.message.trim()) return p.message.trim();
  if (typeof p.error === 'string' && p.error.trim()) return p.error.trim();

  const detail = p.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (first && typeof first === 'object') {
      const detailObj = first as Record<string, unknown>;
      if (typeof detailObj.msg === 'string' && detailObj.msg.trim()) {
        return detailObj.msg.trim();
      }
    }
  }

  return null;
}

const ALLOWED_CATEGORY_SUGGESTIONS: ReadonlySet<string> = new Set([
  'General',
  'Produce',
  'Dairy',
  'Meat',
  'Pantry',
  'Snacks',
  'Beverages',
  'Household',
  'Conserve',
  'Cereale',
]);

function normalizeCategorySuggestion(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return ALLOWED_CATEGORY_SUGGESTIONS.has(trimmed) ? trimmed : undefined;
}

function normalizeCategoryConfidence(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value));
}

function normalizeCategorySource(value: unknown): 'llm' | undefined {
  return value === 'llm' ? 'llm' : undefined;
}

/**
 * Validate product fields from FastAPI response
 */
function isValidProduct(product: FastAPIExtractResponse['products'][0]): boolean {
  const quantity = typeof product.quantity === 'number' ? product.quantity : Number(product.quantity);
  const unitPrice = typeof product.unit_price === 'number' ? product.unit_price : Number(product.unit_price);
  const totalPrice = typeof product.total_price === 'number' ? product.total_price : Number(product.total_price);

  return (
    (product.row_id === undefined || typeof product.row_id === 'string') &&
    typeof product.name === 'string' &&
    product.name.trim().length > 0 &&
    product.name.length <= 500 &&
    !isNaN(quantity) &&
    Number.isFinite(quantity) &&
    quantity > 0 &&
    quantity <= 10000 &&
    !isNaN(unitPrice) &&
    Number.isFinite(unitPrice) &&
    unitPrice >= 0 &&
    unitPrice <= 1000000 &&
    !isNaN(totalPrice) &&
    Number.isFinite(totalPrice) &&
    totalPrice >= 0 &&
    (product.weight_kg_candidate === undefined ||
      product.weight_kg_candidate === null ||
      (typeof product.weight_kg_candidate === 'number' &&
        !isNaN(product.weight_kg_candidate) &&
        Number.isFinite(product.weight_kg_candidate) &&
        product.weight_kg_candidate >= 0)) &&
    (product.weight_kg === undefined ||
      product.weight_kg === null ||
      (typeof product.weight_kg === 'number' &&
        !isNaN(product.weight_kg) &&
        Number.isFinite(product.weight_kg) &&
        product.weight_kg >= 0)) &&
    (product.raw_code === undefined ||
      product.raw_code === null ||
      (typeof product.raw_code === 'string' && product.raw_code.length <= 50) ||
      typeof product.raw_code === 'number') &&
    // Additive-only fields: validate type/shape but don't reject unknown category values.
    (product.category_suggestion === undefined ||
      product.category_suggestion === null ||
      (typeof product.category_suggestion === 'string' && product.category_suggestion.length <= 50)) &&
    (product.category_confidence === undefined ||
      product.category_confidence === null ||
      (typeof product.category_confidence === 'number' &&
        !isNaN(product.category_confidence) &&
        Number.isFinite(product.category_confidence))) &&
    (product.category_source === undefined ||
      product.category_source === null ||
      product.category_source === 'llm')
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
  fileFieldName: string,
  headers: Record<string, string>,
  onProgress?: (progress: number) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    // IMPORTANT: only append the file once. Appending under multiple keys
    // duplicates bytes in the multipart payload (3x upload time/size).
    formData.append(fileFieldName, file);

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
      const responseHeaders = new Headers();
      const rawHeaders = xhr.getAllResponseHeaders();
      if (rawHeaders) {
        rawHeaders
          .trim()
          .split(/[\r\n]+/)
          .forEach((line) => {
            const idx = line.indexOf(':');
            if (idx === -1) return;
            const key = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim();
            if (!key) return;
            responseHeaders.append(key, value);
          });
      }

      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: responseHeaders,
        })
      );
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out'));
    };

    // 2 minute timeout (size-adaptive) with 60s cold start buffer for Render
    const timeoutMs = Math.max(120000, (file.size / (1024 * 1024)) * 1000 + 60000);
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

    // Call FastAPI directly (no auth required - anonymous access)
    const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;
    const normalizedApiUrl = apiUrl?.replace(/\/$/, '');
    const useDevProxy = import.meta.env.DEV && (!normalizedApiUrl || isLocalhostApiUrl(normalizedApiUrl));
    const extractUrl = useDevProxy ? '/extract' : normalizedApiUrl ? `${normalizedApiUrl}/extract` : '/api/extract-invoice';

    const headers = await getInvoiceRequestHeaders();
    if (!headers) {
      return {
        success: false,
        error: 'Authentication required. Please sign in again and retry invoice upload.',
      };
    }

    logger.debug('Sending request to FastAPI /extract endpoint', {
      url: extractUrl,
      mode: useDevProxy ? 'vite-dev-proxy' : extractUrl.startsWith('/api') ? 'proxy-fallback' : 'direct',
      fileName: file.name,
    });

    safeProgress(40);

    // Call FastAPI /extract endpoint with real upload progress
    let response: Response;
    try {
      const configuredFieldName = (import.meta.env.VITE_INVOICE_UPLOAD_FIELD_NAME as string | undefined)?.trim();
      const fileFieldName = configuredFieldName || 'file';
      // Use guarded callback in the XHR event handlers too.
      response = await uploadWithProgress(extractUrl, file, fileFieldName, headers, safeProgress);
    } catch (error) {
      // Handle timeout errors (both AbortError and explicit timeout message)
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Upload timed out')) {
        logger.error('Upload timed out', {
          fileName: file.name,
          fileSize: file.size,
          timeoutMs: Math.max(120000, (file.size / (1024 * 1024)) * 1000 + 60000),
        });
        return {
          success: false,
          error: 'Service is warming up (first upload may take 30-60 seconds). Please wait and try again.',
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

    // Cache/debug observability headers (if backend supports them).
    // Useful to diagnose "no speedup" reports (cache disabled, misses, or multi-worker).
    try {
      const extractCache = response.headers.get('x-extract-cache') || undefined;
      const instanceId = response.headers.get('x-instance-id') || undefined;
      const processId = response.headers.get('x-process-id') || undefined;
      // Treat file hash as sensitive debug-only metadata. Do not log by default.
      const debugHeadersEnabled =
        import.meta.env.DEV ||
        String(import.meta.env.VITE_INVOICE_DEBUG_HEADERS || '')
          .trim()
          .toLowerCase() === 'true';
      const fileHash = debugHeadersEnabled ? response.headers.get('x-extract-file-hash') || undefined : undefined;

      if (extractCache || instanceId || processId || fileHash) {
        logger.info('Invoice extract observability', {
          url: extractUrl,
          status: response.status,
          extractCache,
          instanceId,
          processId,
          ...(fileHash ? { fileHash } : {}),
        });
      }
    } catch {
      // If CORS blocks header access in direct-dev mode, ignore.
    }

    // Handle client errors (400, 422) with detailed backend message when available
    if (response.status === 400 || response.status === 422) {
      const responseText = await response.text();
      let backendMessage: string | null = null;

      try {
        const errorPayload = responseText ? JSON.parse(responseText) : null;
        backendMessage = getApiErrorMessage(errorPayload);
      } catch {
        backendMessage = responseText?.trim() || null;
      }

      logger.error('Invalid PDF or request error', {
        url: extractUrl,
        fileName: file.name,
        status: response.status,
        backendMessage,
      });

      return {
        success: false,
        error: backendMessage || 'Invalid PDF file. Please ensure the file is a valid PDF document.',
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
        rowId: product.row_id,
        name: product.name,
        quantity: typeof product.quantity === 'number' ? product.quantity : Number(product.quantity),
        unitPrice: typeof product.unit_price === 'number' ? product.unit_price : Number(product.unit_price),
        totalPrice: typeof product.total_price === 'number' ? product.total_price : Number(product.total_price),
        barcode: product.raw_code != null ? String(product.raw_code) : undefined,
        weightKgCandidate: product.weight_kg_candidate ?? product.weight_kg ?? undefined,
        categorySuggestion: normalizeCategorySuggestion(product.category_suggestion),
        categoryConfidence: normalizeCategoryConfidence(product.category_confidence),
        categorySource: normalizeCategorySource(product.category_source),
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
