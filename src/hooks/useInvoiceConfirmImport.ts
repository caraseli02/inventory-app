import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import { previewInvoicePricing } from '@/lib/invoiceImportApi';
import type { InvoiceImportAction } from '@/lib/invoiceImportDiffs';
import type { ImportResult } from '@/lib/importRunnerTypes';
import { logger } from '@/lib/logger';
import type { ImportedProduct } from '@/lib/xlsx/index';
import type { InvoiceData } from '@/lib/invoiceOCR';
import type { InvoicePreviewProduct, InvoiceMatchResult, InvoiceStep } from './useInvoiceImport.types';
import { isValidNumber, buildImportErrorMessage } from './useInvoiceImport.helpers';

function buildImportedProducts(
  editable: InvoicePreviewProduct[],
  matches: (InvoiceMatchResult | null)[],
  actions: Record<string, InvoiceImportAction>,
  computedById: Map<string, { base_price_eur: number; price_50: number; price_70: number; price_100: number } | null>,
  invoiceData: InvoiceData,
  resolveAction: (i: number) => InvoiceImportAction,
  missingMsg: string,
): ImportedProduct[] {
  return editable.map((p, i) => {
    const match = matches[i];
    const importAction = actions[p.previewId] ?? resolveAction(i);
    const rowId = p.rowId || `row-${i + 1}`;
    const computed = computedById.get(rowId);
    if (!computed) throw new Error(missingMsg);
    return {
      Name: p.name, Barcode: p.barcode?.trim() || undefined, Category: p.category || 'General',
      Price: computed.base_price_eur, price50: computed.price_50, price70: computed.price_70, price100: computed.price_100,
      currentStock: p.quantity, Supplier: invoiceData.supplier || undefined, expiryDate: undefined, importAction,
      existingProductId: (importAction === 'update' || importAction === 'receive_stock') ? match?.product.id : undefined,
      imageUrl: p.imageUrl, importSource: 'invoice' as const, invoiceRowId: rowId,
      invoiceSupplier: invoiceData.supplier || undefined, invoiceNumber: invoiceData.invoiceNumber || undefined,
      weightKg: p.weightKg, invoiceLineTotal: p.totalPrice,
    };
  });
}

interface UseConfirmImportArgs {
  editableProducts: InvoicePreviewProduct[];
  invoiceData: InvoiceData | null;
  isFxReady: boolean;
  matchResults: (InvoiceMatchResult | null)[];
  importActions: Record<string, InvoiceImportAction>;
  getResolvedDefaultAction: (index: number) => InvoiceImportAction;
  onImport: (products: ImportedProduct[], onProgress?: (current: number, total: number) => void) => Promise<ImportResult>;
  setStep: React.Dispatch<React.SetStateAction<InvoiceStep>>;
  setImportErrors: React.Dispatch<React.SetStateAction<string[]>>;
  setImportProgress: React.Dispatch<React.SetStateAction<{ current: number; total: number }>>;
  t: TFunction;
}

export function useInvoiceConfirmImport({
  editableProducts, invoiceData, isFxReady, matchResults, importActions,
  getResolvedDefaultAction, onImport, setStep, setImportErrors, setImportProgress, t,
}: UseConfirmImportArgs): () => Promise<void> {
  return useCallback(async () => {
    if (!editableProducts.length || !invoiceData || !isFxReady) return;
    const missingWeight = editableProducts.filter((p) => !isValidNumber(p.weightKg)).length;
    if (missingWeight > 0) {
      setImportErrors([t('invoiceUpload.errors.missingWeight', { count: missingWeight, defaultValue: '{{count}} products are missing weight. Please set weight before importing.' })]);
      return;
    }
    setStep('importing');
    setImportProgress({ current: 0, total: editableProducts.length });
    setImportErrors([]);
    try {
      const preview = await previewInvoicePricing({
        invoice_meta: { supplier: invoiceData.supplier, invoice_number: invoiceData.invoiceNumber, date: invoiceData.invoiceDate },
        rows: editableProducts.map((p, i) => ({ row_id: p.rowId || `row-${i + 1}`, name: p.name, barcode: p.barcode || null, quantity: p.quantity, line_total_lei: p.lineTotalLei, weight_kg: p.weightKg ?? null })),
      });
      const blocked = preview.rows.filter((r) => r.status !== 'ok');
      if (blocked.length > 0) {
        setImportErrors([t('invoiceUpload.errors.previewBlocked', { count: blocked.length, defaultValue: '{{count}} rows need more input before import.' })]);
        setStep('preview'); return;
      }
      const computedById = new Map(preview.rows.map((r) => [r.row_id, r.computed ?? null]));
      const missingMsg = t('invoiceUpload.errors.previewMissingComputed', { defaultValue: 'Preview pricing returned incomplete data. Please try again.' });
      const imported = buildImportedProducts(editableProducts, matchResults, importActions, computedById, invoiceData, getResolvedDefaultAction, missingMsg);
      const result = await onImport(imported, (current, total) => { setImportProgress({ current, total }); });
      if (result.fatalError) {
        setImportErrors([result.fatalError]);
        setStep('preview');
        return;
      }
      if (result.errorCount > 0 || result.partialProducts.length > 0) {
        const nextErrors = [
          ...result.failedProducts.slice(0, 3).map((entry) => `${entry.name}: ${entry.error}`),
          ...result.partialProducts.slice(0, 3).map((entry) => `${entry.name}: ${entry.message}`),
        ];
        setImportErrors(nextErrors.length > 0 ? nextErrors : [t('import.failed')]);
        setStep('preview');
        return;
      }
      logger.info('Invoice import completed successfully', { productCount: imported.length, supplier: invoiceData.supplier, invoiceNumber: invoiceData.invoiceNumber });
      setStep('complete');
    } catch (error) {
      logger.error('Invoice import failed', { productCount: editableProducts.length, supplier: invoiceData?.supplier, errorMessage: error instanceof Error ? error.message : String(error), errorStack: error instanceof Error ? error.stack : undefined });
      setImportErrors([buildImportErrorMessage(error, t)]); setStep('preview');
    }
  }, [editableProducts, invoiceData, isFxReady, matchResults, importActions, getResolvedDefaultAction, onImport, setStep, setImportErrors, setImportProgress, t]);
}
