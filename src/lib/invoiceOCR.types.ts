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

export type InvoiceExtractionJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed';

export interface InvoiceOCRSuccess {
  readonly success: true;
  readonly data: InvoiceData;
}

export interface InvoiceOCRPending {
  readonly success: false;
  readonly pending: true;
  readonly jobId: string;
  readonly jobStatus: Extract<InvoiceExtractionJobStatus, 'queued' | 'processing'>;
  readonly statusUrl: string;
  readonly retryAfterSeconds: number | null;
}

export interface InvoiceOCRFailure {
  readonly success: false;
  readonly pending?: false;
  readonly error: string;
  readonly errorCode?: string;
}

export type InvoiceOCRResult = InvoiceOCRSuccess | InvoiceOCRPending | InvoiceOCRFailure;

// Valid file types for invoice upload (PDF only)
export const VALID_INVOICE_TYPES = ['application/pdf'] as const;
export const VALID_INVOICE_EXTENSIONS = ['.pdf'] as const;
