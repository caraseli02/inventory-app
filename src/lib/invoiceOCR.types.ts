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
