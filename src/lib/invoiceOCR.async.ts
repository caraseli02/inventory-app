import { logger } from './logger';
import { resolveSupabaseAccessToken } from './invoiceAuth';
import type {
  InvoiceOCRFailure,
  InvoiceOCRPending,
  InvoiceOCRResult,
  InvoiceExtractionJobStatus,
} from './invoiceOCR.types';
import { getApiErrorMessage, validateExtractResponse, mapResponseToInvoiceData } from './invoiceOCR.parse';
import type { FastAPIExtractResponse } from './invoiceOCR.parse';

interface AcceptedExtractResponse {
  job_id: string;
  status: Extract<InvoiceExtractionJobStatus, 'queued' | 'processing'>;
  status_url: string;
}

interface ExtractionStatusSuccessResponse {
  job_id: string;
  status: 'succeeded';
  result: FastAPIExtractResponse;
}

interface ExtractionStatusFailureResponse {
  job_id: string;
  status: 'failed';
  error?: {
    code?: string;
    message?: string;
  };
}

interface ExtractionStatusPendingResponse {
  job_id: string;
  status: Extract<InvoiceExtractionJobStatus, 'queued' | 'processing'>;
}

type ExtractionStatusResponse =
  | ExtractionStatusSuccessResponse
  | ExtractionStatusFailureResponse
  | ExtractionStatusPendingResponse;

function isLocalhostApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function getInvoiceRequestHeaders(): Promise<Record<string, string> | null> {
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

function resolveStatusUrl(statusUrl: string): string {
  try {
    return new URL(statusUrl).toString();
  } catch {
    const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;
    const normalizedApiUrl = apiUrl?.replace(/\/$/, '');
    const useDevProxy = import.meta.env.DEV && (!normalizedApiUrl || isLocalhostApiUrl(normalizedApiUrl));
    if (useDevProxy) return statusUrl;
    if (!normalizedApiUrl) return statusUrl;
    return new URL(statusUrl, `${normalizedApiUrl}/`).toString();
  }
}

function getRetryAfterSeconds(response: Response): number | null {
  const value = response.headers.get('Retry-After');
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function mapErrorCodeToMessage(errorCode?: string, fallback?: string): string {
  switch (errorCode) {
    case 'EXTRACTION_TIMEOUT':
      return 'Invoice processing is taking longer than expected. Please try again.';
    case 'INVALID_PDF':
      return fallback || 'Invalid PDF file. Please ensure the file is a valid PDF document.';
    case 'PDF_TOO_LARGE':
      return fallback || 'File size exceeds 10MB limit. Please upload a smaller file.';
    case 'AUTH_REQUIRED':
      return fallback || 'Authentication required. Please sign in again and retry invoice upload.';
    case 'JOB_EXPIRED':
      return fallback || 'This invoice processing job expired. Please upload the invoice again.';
    case 'JOB_NOT_FOUND':
      return fallback || 'Invoice processing job not found. Please upload the invoice again.';
    case 'EXTRACTION_FAILED':
      return fallback || 'Unable to extract invoice.';
    default:
      return fallback || 'Failed to process invoice. Please try again.';
  }
}

function mapStatusResponseToResult(
  data: ExtractionStatusResponse,
  statusUrl: string,
  retryAfterSeconds: number | null
): InvoiceOCRResult {
  if (data.status === 'succeeded') {
    const validationError = validateExtractResponse(data.result, statusUrl);
    if (validationError) return validationError;
    return { success: true, data: mapResponseToInvoiceData(data.result) };
  }

  if (data.status === 'failed') {
    const errorCode = data.error?.code;
    const fallback = data.error?.message?.trim() || undefined;
    return { success: false, errorCode, error: mapErrorCodeToMessage(errorCode, fallback) };
  }

  return {
    success: false,
    pending: true,
    jobId: data.job_id,
    jobStatus: data.status,
    statusUrl: resolveStatusUrl(statusUrl),
    retryAfterSeconds,
  };
}

export async function parseAcceptedResponse(
  response: Response,
  extractUrl: string,
  fileName: string
): Promise<InvoiceOCRPending | InvoiceOCRFailure> {
  try {
    const data = await response.json() as AcceptedExtractResponse;
    if (!data.job_id || !data.status_url || (data.status !== 'queued' && data.status !== 'processing')) {
      logger.error('Invalid accepted extract response', { url: extractUrl, fileName, data });
      return { success: false, error: 'Invalid accepted response from invoice service. Please try again.' };
    }

    return {
      success: false,
      pending: true,
      jobId: data.job_id,
      jobStatus: data.status,
      statusUrl: resolveStatusUrl(data.status_url),
      retryAfterSeconds: getRetryAfterSeconds(response),
    };
  } catch (error) {
    logger.error('Failed to parse accepted extract response', {
      url: extractUrl,
      fileName,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Invalid accepted response from invoice service. Please try again.' };
  }
}

export async function getInvoiceExtractionStatus(statusUrl: string): Promise<InvoiceOCRResult> {
  const headers = await getInvoiceRequestHeaders();
  if (!headers) {
    return {
      success: false,
      errorCode: 'AUTH_REQUIRED',
      error: 'Authentication required. Please sign in again and retry invoice upload.',
    };
  }

  const response = await fetch(resolveStatusUrl(statusUrl), { method: 'GET', headers });

  if (response.status === 401) {
    return {
      success: false,
      errorCode: 'AUTH_REQUIRED',
      error: 'Authentication required. Please sign in again and retry invoice upload.',
    };
  }

  if (response.status === 404) {
    let errorCode: string | undefined = 'JOB_NOT_FOUND';
    let message: string | undefined;
    try {
      const payload = await response.json() as { error?: { code?: string; message?: string }; detail?: string };
      errorCode = payload.error?.code || errorCode;
      message = payload.error?.message || payload.detail;
    } catch {
      // ignore parse errors; use defaults
    }
    return { success: false, errorCode, error: mapErrorCodeToMessage(errorCode, message) };
  }

  if (!response.ok) {
    return { success: false, error: `Error processing invoice: ${response.status} ${response.statusText}` };
  }

  try {
    const data = await response.json() as ExtractionStatusResponse;
    return mapStatusResponseToResult(data, statusUrl, getRetryAfterSeconds(response));
  } catch (error) {
    logger.error('Failed to parse invoice extraction status response', {
      statusUrl,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Invalid response from invoice service. Please try again.' };
  }
}

export async function handleClientError(
  response: Response,
  extractUrl: string,
  fileName: string
): Promise<InvoiceOCRFailure | null> {
  if (response.status !== 400 && response.status !== 422) return null;

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
    fileName,
    status: response.status,
    backendMessage,
  });
  return { success: false, error: backendMessage || 'Invalid PDF file. Please ensure the file is a valid PDF document.' };
}
