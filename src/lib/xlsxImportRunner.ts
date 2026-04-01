import type { TFunction } from 'i18next';

import type { Product } from '@/types';
import type { ImportedProduct } from '@/lib/xlsx';
import { addStockMovement, createProduct, getProductByBarcode, updateProduct } from '@/lib/api-provider';
import { buildInvoiceProductUpdatePayload } from '@/lib/invoiceImportDiffs';
import { buildExcelRowNote, getAlreadyImportedExcelRowIds } from '@/lib/excelImportIdempotency';
import { AuthorizationError, NetworkError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { ImportResult } from '@/lib/importRunnerTypes';

interface XlsxImportState {
  productById: Map<string, Product>;
  alreadyImportedRowIds: Set<string>;
}

function normalizeBarcode(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toErrorEntry(name: string, err: unknown, t: TFunction): { name: string; error: string } {
  return { name, error: err instanceof Error ? err.message : t('errors.unknownError') };
}

function isFatalImportError(err: unknown, successCount: number): boolean {
  return err instanceof AuthorizationError || (err instanceof NetworkError && successCount === 0);
}

function buildProductById(allProducts: Product[]): Map<string, Product> {
  const productById = new Map<string, Product>();
  allProducts.forEach((product) => {
    productById.set(product.id, product);
  });
  return productById;
}

function buildExcelStockNote(imported: ImportedProduct): string | undefined {
  const rowId = imported.excelRowId?.trim();
  const batchId = imported.excelBatchId?.trim();
  const barcode = imported.Barcode?.trim();
  const name = imported.Name?.trim();

  if (!rowId || !batchId) return undefined;
  // Barcode is optional; use Name as fallback identity for idempotency tracking
  return buildExcelRowNote({ batchId, rowId, barcode: barcode || name || '' }) ?? undefined;
}

async function loadAlreadyImportedExcelIds(firstRow: ImportedProduct | undefined): Promise<Set<string>> {
  if (!firstRow?.excelBatchId) return new Set();
  try {
    return await getAlreadyImportedExcelRowIds({ batchId: firstRow.excelBatchId });
  } catch (err) {
    logger.warn('Excel import idempotency pre-check unavailable', {
      batchId: firstRow.excelBatchId,
      errorMessage: toErrorMessage(err),
    });
    return new Set();
  }
}

async function resolveExistingProduct(
  imported: ImportedProduct,
  state: XlsxImportState,
): Promise<Product | null> {
  if (imported.existingProductId) {
    const byId = state.productById.get(imported.existingProductId) ?? null;
    if (byId) return byId;
  }

  const importedBarcode = normalizeBarcode(imported.Barcode);
  if (!importedBarcode) return null;
  return getProductByBarcode(importedBarcode);
}

async function maybeApplyUpdate(
  existing: Product,
  imported: ImportedProduct,
  state: XlsxImportState,
): Promise<void> {
  const payload = buildInvoiceProductUpdatePayload(existing, imported);
  if (Object.keys(payload).length === 0) return;

  const updated = await updateProduct(existing.id, payload);
  state.productById.set(updated.id, updated);
}

async function addExcelStockMovement(input: {
  productId: string;
  imported: ImportedProduct;
  rowId: string | undefined;
  state: XlsxImportState;
  t: TFunction;
  context: 'create' | 'update';
}): Promise<string | null> {
  const quantity = input.imported.currentStock;
  // Guard: skip stock movement for non-positive, missing, or non-finite quantities
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) return null;

  try {
    await addStockMovement(
      input.productId,
      quantity,
      'IN',
      buildExcelStockNote(input.imported),
    );
    // Row idempotency is now marked before DB writes in runXlsxImport loop
    return null;
  } catch (stockErr) {
    const message = toErrorMessage(stockErr);
    logger.error(`Excel import stock movement failed after product ${input.context}`, {
      productId: input.productId,
      productName: input.imported.Name,
      quantity,
      errorMessage: message,
    });
    return input.t('import.partialStockFailed', {
      defaultValue: `Product ${input.context}d, but stock movement failed: {{message}}`,
      message,
    });
  }
}

function createBaseResult(): ImportResult {
  return {
    successCount: 0,
    skipCount: 0,
    errorCount: 0,
    invoiceDuplicateSkipCount: 0,
    xlsxDuplicateSkipCount: 0,
    failedProducts: [],
    partialProducts: [],
  };
}

function formatFailedList(items: Array<{ name: string; error: string }>): string {
  const list = items.slice(0, 3).map((f) => `• ${f.name}: ${f.error}`).join('\n');
  return list + (items.length > 3 ? `\n... and ${items.length - 3} more` : '');
}

async function handleExistingRow(input: {
  existing: Product;
  imported: ImportedProduct;
  importAction: NonNullable<ImportedProduct['importAction']>;
  isAlreadyImportedRow: boolean;
  rowId: string | undefined;
  state: XlsxImportState;
  result: ImportResult;
  t: TFunction;
}): Promise<void> {
  const { existing, imported, importAction, isAlreadyImportedRow, rowId, state, result, t } = input;

  if (importAction === 'create') {
    result.skipCount += 1;
    return;
  }

  if (importAction === 'receive_stock' && isAlreadyImportedRow) {
    result.skipCount += 1;
    result.xlsxDuplicateSkipCount += 1;
    return;
  }

  if (importAction === 'receive_stock' && !imported.currentStock) {
    result.skipCount += 1;
    return;
  }

  if (importAction === 'update') {
    await maybeApplyUpdate(existing, imported, state);
  }

  if (!isAlreadyImportedRow) {
    const partialMessage = await addExcelStockMovement({
      productId: existing.id,
      imported,
      rowId,
      state,
      t,
      context: 'update',
    });
    if (partialMessage) {
      result.partialProducts.push({ name: imported.Name, message: partialMessage });
      return;
    }
  }

  result.successCount += 1;
}

async function handleCreateRow(input: {
  imported: ImportedProduct;
  importAction: NonNullable<ImportedProduct['importAction']>;
  isAlreadyImportedRow: boolean;
  rowId: string | undefined;
  state: XlsxImportState;
  result: ImportResult;
  t: TFunction;
}): Promise<void> {
  const { imported, importAction, isAlreadyImportedRow, rowId, state, result, t } = input;

  if (importAction === 'receive_stock' || importAction === 'update') {
    throw new Error(t('import.invoiceReceiveStockMatchMissing', {
      defaultValue: 'Matched product no longer exists. Refresh inventory and try again.',
    }));
  }

  if (isAlreadyImportedRow) {
    result.skipCount += 1;
    result.xlsxDuplicateSkipCount += 1;
    return;
  }

  const newProduct = await createProduct({
    Name: imported.Name,
    Barcode: normalizeBarcode(imported.Barcode),
    Category: imported.Category,
    Price: imported.Price,
    'Price 50%': imported.price50,
    'Price 70%': imported.price70,
    'Price 100%': imported.price100,
    Markup: 70,
    'Expiry Date': imported.expiryDate,
    Supplier: imported.Supplier,
  });
  state.productById.set(newProduct.id, newProduct);

  const partialMessage = await addExcelStockMovement({
    productId: newProduct.id,
    imported,
    rowId,
    state,
    t,
    context: 'create',
  });
  if (partialMessage) {
    result.partialProducts.push({ name: imported.Name, message: partialMessage });
    return;
  }

  result.successCount += 1;
}

export async function runXlsxImport(
  importedProducts: ImportedProduct[],
  allProducts: Product[],
  t: TFunction,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const result = createBaseResult();
  const state: XlsxImportState = {
    productById: buildProductById(allProducts),
    alreadyImportedRowIds: await loadAlreadyImportedExcelIds(importedProducts[0]),
  };
  const totalCount = importedProducts.length;
  let processedCount = 0;

  for (const imported of importedProducts) {
    try {
      const importAction = imported.importAction ?? 'create';
      if (importAction === 'skip') {
        result.skipCount += 1;
        continue;
      }

      const rowId = imported.excelRowId?.trim();
      const isAlreadyImportedRow = Boolean(rowId && state.alreadyImportedRowIds.has(rowId));
      // Mark row as in-progress immediately to prevent concurrent duplicate processing
      if (rowId && !isAlreadyImportedRow) state.alreadyImportedRowIds.add(rowId);
      const existing = await resolveExistingProduct(imported, state);

      if (existing) {
        await handleExistingRow({
          existing,
          imported,
          importAction,
          isAlreadyImportedRow,
          rowId,
          state,
          result,
          t,
        });
      } else {
        await handleCreateRow({
          imported,
          importAction,
          isAlreadyImportedRow,
          rowId,
          state,
          result,
          t,
        });
      }
    } catch (err) {
      if (isFatalImportError(err, result.successCount)) {
        result.fatalError = toErrorMessage(err);
        return result;
      }
      logger.error('Product import failed', {
        productName: imported.Name,
        barcode: imported.Barcode,
        errorMessage: toErrorMessage(err),
        timestamp: new Date().toISOString(),
      });
      result.failedProducts.push(toErrorEntry(imported.Name, err, t));
      result.errorCount += 1;
    } finally {
      processedCount += 1;
      onProgress?.(processedCount, totalCount);
    }
  }

  return result;
}

export function buildXlsxImportToast(
  result: ImportResult,
  t: TFunction
): { toastType: 'success' | 'warning' | 'error' | 'info'; title: string; message: string } {
  const { successCount, skipCount, errorCount, failedProducts, partialProducts, xlsxDuplicateSkipCount } = result;
  if (successCount > 0 || partialProducts.length > 0) {
    let message = t('import.successMessage', { count: successCount, skipped: skipCount, errors: errorCount });
    if (xlsxDuplicateSkipCount > 0) {
      message += `\n\n${t('import.xlsxAlreadyImportedSkipped', {
        count: xlsxDuplicateSkipCount,
        defaultValue: '{{count}} rows were skipped because they were already imported from this Excel batch.',
      })}`;
    }
    if (partialProducts.length > 0) {
      message += `\n\n${t('import.partialProducts', 'Partially imported products')}:\n${formatFailedList(partialProducts.map((p) => ({ name: p.name, error: p.message })))}`;
    }
    if (failedProducts.length > 0) {
      message += `\n\n${t('import.failedProducts', 'Failed products')}:\n${formatFailedList(failedProducts)}`;
    }
    return {
      toastType: errorCount > 0 || partialProducts.length > 0 ? 'warning' : 'success',
      title: t('import.success'),
      message,
    };
  }

  if (skipCount > 0) {
    return {
      toastType: 'info',
      title: t('import.allSkipped'),
      message: t('import.allSkippedMessage', { count: skipCount }),
    };
  }

  let message = t('import.failedMessage', { count: errorCount });
  if (failedProducts.length > 0) message += `\n\n${formatFailedList(failedProducts)}`;
  return { toastType: 'error', title: t('import.failed'), message };
}
