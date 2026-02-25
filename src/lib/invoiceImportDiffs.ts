import type { Product } from '@/types';
import type { CreateProductDTO } from '@/lib/api-provider';

export type InvoiceImportAction = 'create' | 'update' | 'receive_stock' | 'skip';

export interface InvoiceComputedPricing {
  base_price_eur?: number | null;
  price_50?: number | null;
  price_70?: number | null;
  price_100?: number | null;
}

export interface InvoiceImportComparableRow {
  Category?: string;
  Supplier?: string;
  Price?: number;
  price50?: number;
  price70?: number;
  price100?: number;
}

// Invoice prices are currency values. Use half-cent tolerance to avoid
// false diffs from float math / EUR<->LEI round-trips in preview.
const EPSILON = 0.005;

function numbersDifferent(a: number | undefined, b: number | undefined): boolean {
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  return Math.abs(a - b) > EPSILON;
}

function normalizeOptionalText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function hasMeaningfulInvoiceDiffs(
  existingProduct: Product,
  imported: InvoiceImportComparableRow
): boolean {
  if (imported.Price !== undefined && numbersDifferent(imported.Price, existingProduct.fields.Price)) return true;
  if (imported.price50 !== undefined && numbersDifferent(imported.price50, existingProduct.fields['Price 50%'])) return true;
  if (imported.price70 !== undefined && numbersDifferent(imported.price70, existingProduct.fields['Price 70%'])) return true;
  if (imported.price100 !== undefined && numbersDifferent(imported.price100, existingProduct.fields['Price 100%'])) return true;

  const importedSupplier = normalizeOptionalText(imported.Supplier);
  if (importedSupplier && importedSupplier !== normalizeOptionalText(existingProduct.fields.Supplier)) {
    return true;
  }

  const importedCategory = normalizeOptionalText(imported.Category);
  if (
    importedCategory &&
    importedCategory !== 'General' &&
    importedCategory !== normalizeOptionalText(existingProduct.fields.Category)
  ) {
    return true;
  }

  return false;
}

export function getDefaultInvoiceImportAction(input: {
  hasMatch: boolean;
  isAlreadyImported: boolean;
  hasDiffs: boolean;
}): InvoiceImportAction {
  if (input.isAlreadyImported && !input.hasMatch) return 'skip';
  if (!input.hasMatch) return 'create';
  if (input.isAlreadyImported) return input.hasDiffs ? 'update' : 'skip';
  return input.hasDiffs ? 'update' : 'receive_stock';
}

export function buildInvoiceProductUpdatePayload(
  existingProduct: Product,
  imported: InvoiceImportComparableRow
): Partial<CreateProductDTO> {
  const payload: Partial<CreateProductDTO> = {};

  if (imported.Price !== undefined && numbersDifferent(imported.Price, existingProduct.fields.Price)) {
    payload.Price = imported.Price;
  }
  if (imported.price50 !== undefined && numbersDifferent(imported.price50, existingProduct.fields['Price 50%'])) {
    payload['Price 50%'] = imported.price50;
  }
  if (imported.price70 !== undefined && numbersDifferent(imported.price70, existingProduct.fields['Price 70%'])) {
    payload['Price 70%'] = imported.price70;
  }
  if (imported.price100 !== undefined && numbersDifferent(imported.price100, existingProduct.fields['Price 100%'])) {
    payload['Price 100%'] = imported.price100;
  }

  const importedSupplier = normalizeOptionalText(imported.Supplier);
  if (importedSupplier && importedSupplier !== normalizeOptionalText(existingProduct.fields.Supplier)) {
    payload.Supplier = importedSupplier;
  }

  const importedCategory = normalizeOptionalText(imported.Category);
  if (
    importedCategory &&
    importedCategory !== 'General' &&
    importedCategory !== normalizeOptionalText(existingProduct.fields.Category)
  ) {
    payload.Category = importedCategory;
  }

  return payload;
}
