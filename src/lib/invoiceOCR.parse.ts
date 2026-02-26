import { logger } from './logger';
import type { InvoiceData, InvoiceOCRFailure } from './invoiceOCR.types';

// FastAPI response interface
export interface FastAPIExtractResponse {
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

/**
 * Normalize FastAPI/Proxy error payloads into a readable one-line message.
 */
export function getApiErrorMessage(payload: unknown): string | null {
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

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && Number.isFinite(value);
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
 * Validate the parsed FastAPI response structure and product data.
 * Returns an error result if invalid, null if valid.
 */
export function validateExtractResponse(responseData: unknown, fileName: string): InvoiceOCRFailure | null {
  if (!responseData || typeof responseData !== 'object') {
    logger.error('Invalid response structure from FastAPI', { fileName, receivedData: responseData });
    return { success: false, error: 'Invalid response from invoice service. Please ensure you are using the latest app version.' };
  }

  const data = responseData as FastAPIExtractResponse;

  if (!Array.isArray(data.products)) {
    logger.error('Missing or invalid products field in response', {
      fileName,
      dataKeys: Object.keys(data),
      productsType: typeof data.products,
    });
    return { success: false, error: 'Invalid product data from invoice service' };
  }

  if (data.total_amount === undefined || data.total_amount === null) {
    logger.error('Missing total_amount in response', { fileName, dataKeys: Object.keys(data) });
    return { success: false, error: 'Invoice total amount not found in response. Please ensure the invoice contains a total.' };
  }

  if (data.products.length === 0) {
    logger.warn('No products found in response', { fileName });
    return { success: false, error: 'No products found in the invoice. Please ensure the invoice contains product line items.' };
  }

  if (typeof data.total_amount !== 'number' || !isValidNumber(data.total_amount) || data.total_amount < 0) {
    logger.error('Invalid total_amount type in response', {
      fileName,
      receivedType: typeof data.total_amount,
      receivedValue: data.total_amount,
    });
    return { success: false, error: 'Invalid invoice total amount received from service' };
  }

  const invalidProduct = data.products.find((p) => !isValidProduct(p));
  if (invalidProduct) {
    logger.error('Invalid product data in response', {
      fileName,
      invalidProduct: JSON.stringify(invalidProduct),
      productIndex: data.products.indexOf(invalidProduct),
    });
    return {
      success: false,
      error: 'Invalid product data received from invoice service. Please ensure that invoice contains valid product information.',
    };
  }

  return null;
}

/**
 * Map a validated FastAPI response to the app's InvoiceData structure.
 */
export function mapResponseToInvoiceData(responseData: FastAPIExtractResponse): InvoiceData {
  return {
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
}
