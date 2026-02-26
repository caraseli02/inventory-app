import type { TFunction } from 'i18next';
import type { Product } from '../types';
import type { ImportedProduct } from './xlsx';
import { logger } from './logger';
import { AuthorizationError, NetworkError } from './errors';
import {
  addStockMovement,
  createProduct,
  getProductByBarcode,
  updateProduct,
} from './api-provider';
import { buildInvoiceRowNote, getAlreadyImportedRowIds } from './invoiceIdempotency';
import { buildInvoiceProductUpdatePayload } from './invoiceImportDiffs';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  successCount: number;
  skipCount: number;
  errorCount: number;
  invoiceDuplicateSkipCount: number;
  failedProducts: Array<{ name: string; error: string }>;
  partialProducts: Array<{ name: string; message: string }>;
  fatalError?: string;
}

interface InvoiceImportState {
  normalizedNameMap: Map<string, Product>;
  productById: Map<string, Product>;
  alreadyImportedRowIds: Set<string>;
}

type RowResult =
  | { type: 'success' }
  | { type: 'skip'; isDuplicate: boolean }
  | { type: 'partial'; name: string; message: string };

// ── Shared helpers ───────────────────────────────────────────────────────────

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeBarcode(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildProductIndices(allProducts: Product[]) {
  const normalizedNameMap = new Map<string, Product>();
  const productById = new Map<string, Product>();
  allProducts.forEach((product) => {
    const normalized = normalizeName(product.fields.Name);
    if (!normalizedNameMap.has(normalized)) normalizedNameMap.set(normalized, product);
    productById.set(product.id, product);
  });
  return { normalizedNameMap, productById };
}

function buildStockNote(
  imported: ImportedProduct,
  importedRowId: string | undefined
): string | undefined {
  if (!importedRowId) return undefined;
  return (
    buildInvoiceRowNote({
      supplier: imported.invoiceSupplier,
      invoiceNumber: imported.invoiceNumber,
      rowId: importedRowId,
    }) ?? undefined
  );
}

function isFatalImportError(err: unknown, successCount: number): boolean {
  return err instanceof AuthorizationError || (err instanceof NetworkError && successCount === 0);
}

function accumulateRowResult(result: ImportResult, rowResult: RowResult): void {
  if (rowResult.type === 'success') { result.successCount += 1; return; }
  if (rowResult.type === 'skip') {
    result.skipCount += 1;
    if (rowResult.isDuplicate) result.invoiceDuplicateSkipCount += 1;
    return;
  }
  result.partialProducts.push({ name: rowResult.name, message: rowResult.message });
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toErrorEntry(name: string, err: unknown, t: TFunction): { name: string; error: string } {
  return { name, error: err instanceof Error ? err.message : t('errors.unknownError') };
}

// ── Invoice import helpers ───────────────────────────────────────────────────

async function loadAlreadyImportedIds(firstRow: ImportedProduct | undefined): Promise<Set<string>> {
  if (!firstRow?.invoiceSupplier || !firstRow?.invoiceNumber) return new Set();
  try {
    return await getAlreadyImportedRowIds({
      supplier: firstRow.invoiceSupplier,
      invoiceNumber: firstRow.invoiceNumber,
    });
  } catch (err) {
    logger.warn('Invoice import idempotency pre-check unavailable', {
      supplier: firstRow.invoiceSupplier,
      invoiceNumber: firstRow.invoiceNumber,
      errorMessage: toErrorMessage(err),
    });
    return new Set();
  }
}

async function resolveExistingProduct(
  imported: ImportedProduct,
  importedBarcode: string | undefined,
  state: InvoiceImportState,
  importAction: string
): Promise<Product | null> {
  let existing: Product | null = null;
  if (imported.existingProductId) existing = state.productById.get(imported.existingProductId) ?? null;
  if (!existing && importedBarcode) existing = await getProductByBarcode(importedBarcode);
  if (!existing && importAction !== 'create') {
    existing = state.normalizedNameMap.get(normalizeName(imported.Name)) ?? null;
  }
  if (existing) {
    state.normalizedNameMap.set(normalizeName(imported.Name), existing);
    state.productById.set(existing.id, existing);
  }
  return existing;
}

async function processExistingProduct(
  imported: ImportedProduct,
  existing: Product,
  importedRowId: string | undefined,
  isAlreadyImportedRow: boolean,
  stockNote: string | undefined,
  importAction: string,
  state: InvoiceImportState,
  t: TFunction
): Promise<RowResult> {
  if (isAlreadyImportedRow && importAction === 'receive_stock') return { type: 'skip', isDuplicate: true };
  if (importAction === 'receive_stock' && !imported.currentStock) return { type: 'skip', isDuplicate: false };
  if (importAction === 'update') {
    const payload = buildInvoiceProductUpdatePayload(existing, imported);
    if (Object.keys(payload).length > 0) {
      const updated = await updateProduct(existing.id, payload);
      state.normalizedNameMap.set(normalizeName(updated.fields.Name), updated);
      state.productById.set(updated.id, updated);
    }
  }
  if (imported.currentStock && imported.currentStock > 0 && !isAlreadyImportedRow) {
    try {
      await addStockMovement(existing.id, imported.currentStock, 'IN', stockNote);
      if (importedRowId) state.alreadyImportedRowIds.add(importedRowId);
    } catch (stockErr) {
      const message = toErrorMessage(stockErr);
      logger.error('Invoice import stock movement failed after product update', {
        productId: existing.id, productName: imported.Name, quantity: imported.currentStock, errorMessage: message,
      });
      return { type: 'partial', name: imported.Name, message: t('import.partialStockFailed', { defaultValue: 'Product processed, but stock movement failed: {{message}}', message }) };
    }
  }
  return { type: 'success' };
}

async function processNewProduct(
  imported: ImportedProduct,
  importedBarcode: string | undefined,
  importedRowId: string | undefined,
  isAlreadyImportedRow: boolean,
  importAction: string,
  stockNote: string | undefined,
  state: InvoiceImportState,
  t: TFunction
): Promise<RowResult> {
  if (isAlreadyImportedRow) return { type: 'skip', isDuplicate: true };
  if (importAction === 'receive_stock') {
    throw new Error(t('import.invoiceReceiveStockMatchMissing', { defaultValue: 'Matched product no longer exists. Refresh inventory and try again.' }));
  }
  const newProduct = await createProduct({
    Name: imported.Name, Barcode: importedBarcode, Category: imported.Category,
    Price: imported.Price, 'Price 50%': imported.price50, 'Price 70%': imported.price70,
    'Price 100%': imported.price100, Markup: 70, 'Expiry Date': imported.expiryDate, Supplier: imported.Supplier,
  });
  state.normalizedNameMap.set(normalizeName(imported.Name), newProduct);
  state.productById.set(newProduct.id, newProduct);
  if (imported.currentStock && imported.currentStock > 0) {
    try {
      await addStockMovement(newProduct.id, imported.currentStock, 'IN', stockNote);
      if (importedRowId) state.alreadyImportedRowIds.add(importedRowId);
    } catch (stockErr) {
      const message = toErrorMessage(stockErr);
      logger.error('Invoice import stock movement failed after product creation', {
        productId: newProduct.id, productName: imported.Name, quantity: imported.currentStock, errorMessage: message,
      });
      return { type: 'partial', name: imported.Name, message: t('import.partialStockFailed', { defaultValue: 'Product created, but stock movement failed: {{message}}', message }) };
    }
  }
  return { type: 'success' };
}

export async function runInvoiceImport(
  importedProducts: ImportedProduct[],
  allProducts: Product[],
  t: TFunction,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    successCount: 0, skipCount: 0, errorCount: 0,
    invoiceDuplicateSkipCount: 0, failedProducts: [], partialProducts: [],
  };
  const state: InvoiceImportState = {
    ...buildProductIndices(allProducts),
    alreadyImportedRowIds: await loadAlreadyImportedIds(importedProducts[0]),
  };
  const totalCount = importedProducts.length;
  let processedCount = 0;

  for (const imported of importedProducts) {
    try {
      const importAction = imported.importAction ?? 'create';
      if (importAction === 'skip') { result.skipCount += 1; continue; }

      const importedRowId = imported.invoiceRowId?.trim();
      const isAlreadyImportedRow = Boolean(importedRowId && state.alreadyImportedRowIds.has(importedRowId));
      const stockNote = buildStockNote(imported, importedRowId);
      const importedBarcode = normalizeBarcode(imported.Barcode);
      const existing = await resolveExistingProduct(imported, importedBarcode, state, importAction);

      const rowResult = existing
        ? await processExistingProduct(imported, existing, importedRowId, isAlreadyImportedRow, stockNote, importAction, state, t)
        : await processNewProduct(imported, importedBarcode, importedRowId, isAlreadyImportedRow, importAction, stockNote, state, t);

      accumulateRowResult(result, rowResult);
    } catch (err) {
      logger.error('Invoice import row failed', { productName: imported.Name, barcode: imported.Barcode, errorMessage: toErrorMessage(err), timestamp: new Date().toISOString() });
      result.errorCount += 1;
      result.failedProducts.push(toErrorEntry(imported.Name, err, t));
    } finally {
      processedCount += 1;
      onProgress?.(processedCount, totalCount);
    }
  }

  return result;
}

// ── Xlsx import helpers ──────────────────────────────────────────────────────

async function processXlsxUpdateRow(imported: ImportedProduct): Promise<void> {
  await updateProduct(imported.existingProductId!, {
    Name: imported.Name, Category: imported.Category, Price: imported.Price,
    'Price 70%': imported.price70, Markup: 70, Supplier: imported.Supplier, Image: imported.imageUrl,
  });
  if (imported.currentStock && imported.currentStock > 0) {
    await addStockMovement(imported.existingProductId!, imported.currentStock, 'IN');
  }
}

async function processXlsxCreateRow(imported: ImportedProduct): Promise<boolean> {
  const importedBarcode = normalizeBarcode(imported.Barcode);
  if (importedBarcode) {
    const existing = await getProductByBarcode(importedBarcode);
    if (existing) return false;
  }
  const newProduct = await createProduct({
    Name: imported.Name, Barcode: importedBarcode, Category: imported.Category,
    Price: imported.Price, 'Price 50%': imported.price50, 'Price 70%': imported.price70,
    'Price 100%': imported.price100, Markup: 70, 'Expiry Date': imported.expiryDate, Image: imported.imageUrl,
  });
  if (imported.currentStock && imported.currentStock > 0 && newProduct) {
    await addStockMovement(newProduct.id, imported.currentStock, 'IN');
  }
  return true;
}

export async function runXlsxImport(
  importedProducts: ImportedProduct[],
  t: TFunction,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    successCount: 0, skipCount: 0, errorCount: 0,
    invoiceDuplicateSkipCount: 0, failedProducts: [], partialProducts: [],
  };
  const totalCount = importedProducts.length;
  let processedCount = 0;

  for (const imported of importedProducts) {
    try {
      const importAction = imported.importAction ?? 'create';
      if (importAction === 'skip') { result.skipCount++; continue; }

      if (importAction === 'update' && imported.existingProductId) {
        await processXlsxUpdateRow(imported);
        result.successCount++;
        continue;
      }

      const created = await processXlsxCreateRow(imported);
      if (created) result.successCount++; else result.skipCount++;
    } catch (err) {
      if (isFatalImportError(err, result.successCount)) {
        result.fatalError = toErrorMessage(err);
        return result;
      }
      logger.error('Product import failed', { productName: imported.Name, barcode: imported.Barcode, errorMessage: toErrorMessage(err), timestamp: new Date().toISOString() });
      result.failedProducts.push(toErrorEntry(imported.Name, err, t));
      result.errorCount++;
    } finally {
      processedCount += 1;
      onProgress?.(processedCount, totalCount);
    }
  }

  return result;
}

// ── Toast message builders ───────────────────────────────────────────────────

function formatFailedList(items: Array<{ name: string; error: string }>): string {
  const list = items.slice(0, 3).map((f) => `• ${f.name}: ${f.error}`).join('\n');
  return list + (items.length > 3 ? `\n... and ${items.length - 3} more` : '');
}

export function buildInvoiceImportToast(
  result: ImportResult,
  t: TFunction
): { toastType: 'success' | 'warning' | 'error' | 'info'; title: string; message: string } {
  const { successCount, skipCount, errorCount, invoiceDuplicateSkipCount, partialProducts, failedProducts } = result;
  if (successCount > 0 || partialProducts.length > 0) {
    let message = t('import.successMessage', { count: successCount, skipped: skipCount, errors: errorCount });
    if (invoiceDuplicateSkipCount > 0) {
      message += `\n\n${t('import.invoiceAlreadyImportedSkipped', { count: invoiceDuplicateSkipCount, defaultValue: '{{count}} rows were skipped because they were already imported from this invoice.' })}`;
    }
    if (partialProducts.length > 0) {
      message += `\n\n${t('import.partialProducts', 'Partially imported products')}:\n${formatFailedList(partialProducts.map((p) => ({ name: p.name, error: p.message })))}`;
    }
    if (failedProducts.length > 0) {
      message += `\n\n${t('import.failedProducts', 'Failed products')}:\n${formatFailedList(failedProducts)}`;
    }
    return { toastType: errorCount > 0 || partialProducts.length > 0 ? 'warning' : 'success', title: t('import.success'), message };
  }
  const message = failedProducts.length > 0
    ? formatFailedList(failedProducts)
    : t('import.failedMessage', { count: errorCount });
  return { toastType: invoiceDuplicateSkipCount > 0 ? 'info' : 'error', title: t('import.failed'), message };
}

export function buildXlsxImportToast(
  result: ImportResult,
  t: TFunction
): { toastType: 'success' | 'warning' | 'error' | 'info'; title: string; message: string } {
  const { successCount, skipCount, errorCount, failedProducts } = result;
  if (successCount > 0) {
    let message = t('import.successMessage', { count: successCount, skipped: skipCount, errors: errorCount });
    if (failedProducts.length > 0) {
      message += `\n\n${t('import.failedProducts', 'Failed products')}:\n${formatFailedList(failedProducts)}`;
    }
    return { toastType: errorCount > 0 ? 'warning' : 'success', title: t('import.success'), message };
  }
  if (skipCount > 0) {
    return { toastType: 'info', title: t('import.allSkipped'), message: t('import.allSkippedMessage', { count: skipCount }) };
  }
  let message = t('import.failedMessage', { count: errorCount });
  if (failedProducts.length > 0) message += `\n\n${formatFailedList(failedProducts)}`;
  return { toastType: 'error', title: t('import.failed'), message };
}
