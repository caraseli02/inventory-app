import { logger } from './logger';
import { resolveSupabaseAccessToken } from './invoiceAuth';

export interface InvoiceImportRowInput {
  row_id: string;
  name: string;
  barcode: string | null;
  quantity: number;
  line_total_lei: number;
  weight_kg: number | null;
}

export interface InvoiceMetaInput {
  supplier?: string;
  invoice_number?: string;
  date?: string;
}

export interface PreviewPricingRequest {
  invoice_meta?: InvoiceMetaInput;
  rows: InvoiceImportRowInput[];
}

export interface PreviewPricingRow {
  row_id: string;
  status: 'ok' | 'needs_input';
  messages?: string[];
  computed?: {
    base_price_eur: number;
    transport_eur: number;
    price_50: number;
    price_70: number;
    price_100: number;
  } | null;
}

export interface PreviewPricingResponse {
  rows: PreviewPricingRow[];
  summary?: {
    ok_count: number;
    needs_input_count: number;
    error_count?: number;
  };
}

function isLocalhostApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function getInvoiceApiBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;
  const normalizedApiUrl = apiUrl?.replace(/\/$/, '');
  const useDevProxy = import.meta.env.DEV && (!normalizedApiUrl || isLocalhostApiUrl(normalizedApiUrl));

  if (useDevProxy) {
    return '';
  }

  if (!normalizedApiUrl) {
    logger.error('VITE_INVOICE_API_URL not configured in production');
    throw new Error('Invoice service not configured. Please contact support.');
  }

  return normalizedApiUrl;
}

function getInvoiceApiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };

  return headers;
}

async function getInvoiceAuthHeader(): Promise<Record<string, string> | null> {
  const authRequired = String(import.meta.env.VITE_INVOICE_API_REQUIRE_AUTH ?? 'true')
    .trim()
    .toLowerCase() !== 'false';

  if (!authRequired) return {};

  const accessToken = await resolveSupabaseAccessToken();
  if (!accessToken) {
    logger.warn('Missing Supabase access token for invoice pricing request');
    return null;
  }

  return { Authorization: `Bearer ${accessToken}` };
}

export async function previewInvoicePricing(
  payload: PreviewPricingRequest
): Promise<PreviewPricingResponse> {
  const baseUrl = getInvoiceApiBaseUrl();
  const authHeader = await getInvoiceAuthHeader();
  if (authHeader === null) {
    throw new Error('Authentication required. Please sign in again.');
  }

  const response = await fetch(`${baseUrl}/invoice/preview-pricing`, {
    method: 'POST',
    headers: getInvoiceApiHeaders(authHeader),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Preview pricing failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<PreviewPricingResponse>;
}
