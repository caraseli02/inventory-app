import type { Product } from '@/types';
import { buildInvoiceProductUpdatePayload } from '@/lib/invoiceImportDiffs';
import type { ImportedProduct } from './index';

export type XlsxImportAction = NonNullable<ImportedProduct['importAction']>;

export interface XlsxPreviewRow {
  previewId: string;
  product: ImportedProduct;
  matchedProduct: Product | null;
  hasDiffs: boolean;
  isAlreadyImported: boolean;
  importAction: XlsxImportAction;
  blockingError?: string;
}

function normalizeBarcode(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getDefaultExcelImportAction(input: {
  hasMatch: boolean;
  isAlreadyImported: boolean;
  hasDiffs: boolean;
}): XlsxImportAction {
  if (input.isAlreadyImported && !input.hasMatch) return 'skip';
  if (!input.hasMatch) return 'create';
  if (input.isAlreadyImported) return input.hasDiffs ? 'update' : 'skip';
  return input.hasDiffs ? 'update' : 'receive_stock';
}

function getBlockingError(input: {
  product: ImportedProduct;
  matchedProduct: Product | null;
  isAlreadyImported: boolean;
  importAction: XlsxImportAction;
}): string | undefined {
  const requiresExisting = input.importAction === 'receive_stock' || input.importAction === 'update';
  if (requiresExisting && !input.matchedProduct) {
    return 'Matched product no longer exists. Refresh inventory and try again.';
  }

  const requiresStock = input.importAction === 'receive_stock' || (input.importAction === 'update' && !input.isAlreadyImported);
  if (requiresStock) {
    const quantity = input.product.currentStock;
    if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) {
      return 'Quantity is required for rows that will receive stock.';
    }
  }

  return undefined;
}

export function getAvailableExcelActions(row: XlsxPreviewRow): XlsxImportAction[] {
  if (!row.matchedProduct) return ['create', 'skip'];
  if (row.isAlreadyImported) return ['update', 'skip'];
  return ['receive_stock', 'update', 'skip'];
}

export function applyExcelImportAction(
  row: XlsxPreviewRow,
  importAction: XlsxImportAction
): XlsxPreviewRow {
  const nextProduct: ImportedProduct = {
    ...row.product,
    importAction,
    existingProductId: row.matchedProduct?.id,
  };

  return {
    ...row,
    product: nextProduct,
    importAction,
    blockingError: getBlockingError({
      product: nextProduct,
      matchedProduct: row.matchedProduct,
      isAlreadyImported: row.isAlreadyImported,
      importAction,
    }),
  };
}

export function buildXlsxPreviewRows(
  importedProducts: ImportedProduct[],
  allProducts: Product[],
  alreadyImportedRowIds: Set<string>
): XlsxPreviewRow[] {
  const productByBarcode = new Map<string, Product>();
  allProducts.forEach((product) => {
    const barcode = normalizeBarcode(product.fields.Barcode);
    if (barcode) productByBarcode.set(barcode, product);
  });

  return importedProducts.map((product, index) => {
    const barcode = normalizeBarcode(product.Barcode);
    const matchedProduct = barcode ? productByBarcode.get(barcode) ?? null : null;
    const payload = matchedProduct ? buildInvoiceProductUpdatePayload(matchedProduct, product) : {};
    const hasDiffs = Object.keys(payload).length > 0;
    const previewId = product.excelRowId?.trim() || `xlsx:${index}`;
    const isAlreadyImported = Boolean(product.excelRowId && alreadyImportedRowIds.has(product.excelRowId));
    const importAction = product.importAction ?? getDefaultExcelImportAction({
      hasMatch: Boolean(matchedProduct),
      isAlreadyImported,
      hasDiffs,
    });

    return {
      previewId,
      product: {
        ...product,
        Barcode: barcode,
        existingProductId: matchedProduct?.id,
        importAction,
      },
      matchedProduct,
      hasDiffs,
      isAlreadyImported,
      importAction,
      blockingError: getBlockingError({
        product,
        matchedProduct,
        isAlreadyImported,
        importAction,
      }),
    };
  });
}
