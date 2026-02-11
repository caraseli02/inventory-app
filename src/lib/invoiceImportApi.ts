import { supabase } from './supabase';

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

function getInvoiceApiBaseUrl(): string {
  const proxyBaseUrl = import.meta.env.VITE_INVOICE_PROXY_BASE_URL as string | undefined;
  if (proxyBaseUrl) return proxyBaseUrl.replace(/\/$/, '');

  const directApiUrl = import.meta.env.VITE_INVOICE_API_URL as string | undefined;
  if (directApiUrl) return directApiUrl.replace(/\/$/, '');

  return '/api';
}

async function getAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };

  const apiKey = import.meta.env.VITE_INVOICE_API_KEY as string | undefined;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function previewInvoicePricing(
  payload: PreviewPricingRequest
): Promise<PreviewPricingResponse> {
  const baseUrl = getInvoiceApiBaseUrl();
  const response = await fetch(`${baseUrl}/invoice/preview-pricing`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Preview pricing failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<PreviewPricingResponse>;
}
