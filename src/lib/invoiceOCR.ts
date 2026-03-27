import { logger } from './logger';
import { resolveSupabaseAccessToken } from './invoiceAuth';
import {
  getInvoiceExtractionStatus as getAsyncInvoiceExtractionStatus,
  handleClientError,
  parseAcceptedResponse,
} from './invoiceOCR.async';
import {
  type InvoiceOCRFailure,
  type InvoiceOCRResult,
  VALID_INVOICE_TYPES,
  VALID_INVOICE_EXTENSIONS,
} from './invoiceOCR.types';
import { validateExtractResponse, mapResponseToInvoiceData } from './invoiceOCR.parse';
import type { FastAPIExtractResponse } from './invoiceOCR.parse';

// Re-export all public types so consumers keep importing from '@/lib/invoiceOCR'
export type {
  InvoiceProduct,
  InvoiceData,
  InvoiceOCRSuccess,
  InvoiceOCRPending,
  InvoiceOCRFailure,
  InvoiceOCRResult,
  InvoiceExtractionJobStatus,
} from './invoiceOCR.types';
export { VALID_INVOICE_TYPES, VALID_INVOICE_EXTENSIONS } from './invoiceOCR.types';

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
      resolve(new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText, headers: responseHeaders }));
    };

    xhr.onerror = () => { reject(new Error('Upload failed')); };
    xhr.ontimeout = () => { reject(new Error('Upload timed out')); };

    // 2 minute timeout (size-adaptive) with 60s cold start buffer for Render
    xhr.timeout = Math.max(120000, (file.size / (1024 * 1024)) * 1000 + 60000);
    xhr.open('POST', url);
    Object.entries(headers).forEach(([key, value]) => { xhr.setRequestHeader(key, value); });
    xhr.send(formData);
  });
}

/**
 * Validate file type, extension, and size. Returns an error result or null.
 */
function validateInvoiceFile(file: File): InvoiceOCRFailure | null {
  if (!(VALID_INVOICE_TYPES as readonly string[]).includes(file.type)) {
    logger.warn('Invalid file type rejected', {
      fileName: file.name, fileType: file.type, validTypes: Array.from(VALID_INVOICE_TYPES),
    });
    return { success: false, error: 'Invalid file type. Please upload a PDF file.' };
  }

  const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!(VALID_INVOICE_EXTENSIONS as readonly string[]).includes(fileExt)) {
    logger.warn('Invalid file extension rejected', {
      fileName: file.name, fileExtension: fileExt, validExtensions: Array.from(VALID_INVOICE_EXTENSIONS),
    });
    return { success: false, error: 'Invalid file extension. Please upload a PDF file.' };
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    logger.warn('File size exceeds limit', { fileName: file.name, fileSize: file.size, maxSize });
    return { success: false, error: 'File size exceeds 10MB limit. Please upload a smaller file.' };
  }

  return null;
}

function resolveExtractUrl(): string {
  const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;
  const normalizedApiUrl = apiUrl?.replace(/\/$/, '');
  const useLocalhostTarget = normalizedApiUrl
    ? ['localhost', '127.0.0.1'].includes(new URL(normalizedApiUrl).hostname)
    : false;
  const useDevProxy = import.meta.env.DEV && (!normalizedApiUrl || useLocalhostTarget);
  return useDevProxy ? '/extract' : normalizedApiUrl ? `${normalizedApiUrl}/extract` : '/api/extract-invoice';
}

function handleUploadError(error: unknown, extractUrl: string, file: File): InvoiceOCRFailure {
  if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Upload timed out')) {
    logger.error('Upload timed out', {
      fileName: file.name, fileSize: file.size,
      timeoutMs: Math.max(120000, (file.size / (1024 * 1024)) * 1000 + 60000),
    });
    return { success: false, error: 'Service is warming up (first upload may take 30-60 seconds). Please wait and try again.' };
  }

  if (error instanceof Error && error.message === 'Upload failed') {
    logger.error('Network error during invoice extraction', { url: extractUrl, fileName: file.name, errorMessage: error.message });
    return { success: false, error: 'Network error while processing invoice. Please check your internet connection and try again.' };
  }

  logger.error('Unexpected error during file upload', {
    url: extractUrl, fileName: file.name,
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
  });
  return { success: false, error: 'Unexpected error during upload. Please try again or contact support if the problem persists.' };
}

function logObservabilityHeaders(response: Response, extractUrl: string): void {
  try {
    const extractCache = response.headers.get('x-extract-cache') || undefined;
    const instanceId = response.headers.get('x-instance-id') || undefined;
    const processId = response.headers.get('x-process-id') || undefined;
    const debugHeadersEnabled =
      import.meta.env.DEV ||
      String(import.meta.env.VITE_INVOICE_DEBUG_HEADERS || '').trim().toLowerCase() === 'true';
    const fileHash = debugHeadersEnabled ? response.headers.get('x-extract-file-hash') || undefined : undefined;

    if (extractCache || instanceId || processId || fileHash) {
      logger.info('Invoice extract observability', {
        url: extractUrl, status: response.status,
        extractCache, instanceId, processId,
        ...(fileHash ? { fileHash } : {}),
      });
    }
  } catch {
    // If CORS blocks header access in direct-dev mode, ignore.
  }
}

async function parseJsonResponse(
  response: Response,
  extractUrl: string,
  fileName: string
): Promise<{ ok: true; data: FastAPIExtractResponse } | InvoiceOCRFailure> {
  try {
    const data = await response.json() as FastAPIExtractResponse;
    return { ok: true, data };
  } catch (error) {
    logger.error('Failed to parse FastAPI response', {
      url: extractUrl, fileName, errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Invalid response from invoice service. Please try again.' };
  }
}

export const getInvoiceExtractionStatus = getAsyncInvoiceExtractionStatus;

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
  logger.info('Starting invoice extraction', { fileName: file.name, fileSize: file.size, fileType: file.type });

  const safeProgress = (progress: number) => {
    try {
      onProgress?.(progress);
    } catch (error) {
      logger.warn('Progress callback failed - UI progress updates may be inaccurate', {
        progress, errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  };

  try {
    safeProgress(10);
    const fileError = validateInvoiceFile(file);
    if (fileError) return fileError;
    safeProgress(30);

    const extractUrl = resolveExtractUrl();
    const headers = await getInvoiceRequestHeaders();
    if (!headers) {
      return { success: false, error: 'Authentication required. Please sign in again and retry invoice upload.' };
    }

    logger.debug('Sending request to FastAPI /extract endpoint', {
      url: extractUrl,
      mode: extractUrl === '/extract' ? 'vite-dev-proxy' : extractUrl.startsWith('/api') ? 'proxy-fallback' : 'direct',
      fileName: file.name,
    });
    safeProgress(40);

    let response: Response;
    try {
      const fieldName = (import.meta.env.VITE_INVOICE_UPLOAD_FIELD_NAME as string | undefined)?.trim() || 'file';
      response = await uploadWithProgress(extractUrl, file, fieldName, headers, safeProgress);
    } catch (error) {
      return handleUploadError(error, extractUrl, file);
    }

    safeProgress(90);

    if (response.status === 401) {
      logger.error('Authentication failed', { url: extractUrl, fileName: file.name });
      return { success: false, error: 'Unauthorized request. Please check your server-side invoice API configuration.' };
    }

    logObservabilityHeaders(response, extractUrl);

    const clientError = await handleClientError(response, extractUrl, file.name);
    if (clientError) return clientError;

    if (response.status === 202) {
      safeProgress(90);
      return parseAcceptedResponse(response, extractUrl, file.name);
    }

    if (!response.ok) {
      logger.error('HTTP error from FastAPI', { url: extractUrl, fileName: file.name, status: response.status, statusText: response.statusText });
      return { success: false, error: `Error processing invoice: ${response.status} ${response.statusText}` };
    }

    const parseResult = await parseJsonResponse(response, extractUrl, file.name);
    if (!('ok' in parseResult)) return parseResult;

    const validationError = validateExtractResponse(parseResult.data, file.name);
    if (validationError) return validationError;

    const invoiceData = mapResponseToInvoiceData(parseResult.data);
    safeProgress(100);

    logger.info('Invoice extraction completed successfully', {
      fileName: file.name, productCount: invoiceData.products.length,
      hasSupplier: !!invoiceData.supplier, hasInvoiceNumber: !!invoiceData.invoiceNumber,
      totalAmount: invoiceData.totalAmount,
    });
    return { success: true, data: invoiceData };
  } catch (error) {
    logger.error('Invoice extraction failed', {
      fileName: file.name, fileSize: file.size, fileType: file.type,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to extract invoice data' };
  }
}
