import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvoiceImportAction } from '@/lib/invoiceImportDiffs';
import type { InvoiceProduct } from '@/lib/invoiceOCR';
import { parseWeightKgFromProductName } from '@/lib/invoicePricing';
import { getAlreadyImportedRowIds } from '@/lib/invoiceIdempotency';
import { previewInvoicePricing } from '@/lib/invoiceImportApi';
import { suggestProductDetails } from '@/lib/ai';
import { logger } from '@/lib/logger';
import { useInvoiceFileState } from './useInvoiceFileState';
import { useInvoiceConfirmImport } from './useInvoiceConfirmImport';
import {
  useProductIndexes, useMatchResults, useRowFlags, useResolvedDefaultAction, useSyncImportActions,
} from './useInvoiceComputed';
import {
  isValidNumber, roundCurrency, normalizeForMatch, inferCategoryFromName,
  getPreviewId, buildImportErrorMessage, NUMERIC_EDITABLE_FIELDS,
} from './useInvoiceImport.helpers';
import type {
  InvoiceStep, InvoiceMatchResult, InvoicePreviewProduct,
  PricingByRowId, RowFlag, UseInvoiceImportReturn, UseInvoiceImportProps,
} from './useInvoiceImport.types';

export type { InvoiceStep, InvoiceMatchResult, InvoicePreviewProduct, PricingByRowId, RowFlag, UseInvoiceImportReturn };
export { isValidNumber, roundCurrency, normalizeForMatch, inferCategoryFromName, getPreviewId, buildImportErrorMessage };
export { CATEGORIES } from './useInvoiceImport.types';

// ── Module-level pure helpers ─────────────────────────────────────────────────

function mapToEditableProduct(p: InvoiceProduct, index: number, fxRate: number | null): InvoicePreviewProduct {
  const isFxReadyNow = fxRate != null && Number.isFinite(fxRate) && fxRate > 0;
  const quantity = p.quantity;
  const totalPrice = isFxReadyNow ? roundCurrency(p.totalPrice / fxRate!) : p.totalPrice;
  const unitPrice = isFxReadyNow ? (quantity > 0 ? roundCurrency(totalPrice / quantity) : 0) : p.unitPrice;
  return {
    ...p, previewId: getPreviewId(p, index), lineTotalLei: p.totalPrice, quantity, unitPrice, totalPrice,
    weightKg: p.weightKgCandidate ?? parseWeightKgFromProductName(p.name),
    category: p.categorySuggestion ?? inferCategoryFromName(p.name),
  };
}

function recomputeEditable(p: InvoiceProduct, index: number, prev: Map<string, InvoicePreviewProduct>, fxRate: number, removedIds: Set<string>): InvoicePreviewProduct[] {
  const previewId = getPreviewId(p, index);
  if (removedIds.has(previewId)) return [];
  const previous = prev.get(previewId);
  const quantity = previous?.quantity ?? p.quantity;
  const weightKg = previous?.weightKg ?? p.weightKgCandidate ?? parseWeightKgFromProductName(p.name);
  const lineTotalLei = previous?.lineTotalLei ?? p.totalPrice;
  const totalPrice = roundCurrency(lineTotalLei / fxRate);
  const unitPrice = quantity > 0 ? roundCurrency(totalPrice / quantity) : 0;
  return [{ ...p, previewId, lineTotalLei, name: previous?.name ?? p.name, barcode: previous?.barcode ?? p.barcode, quantity, unitPrice, totalPrice, weightKg, category: previous?.category ?? p.categorySuggestion ?? inferCategoryFromName(p.name), imageUrl: previous?.imageUrl }];
}

// ── Inner state hook ──────────────────────────────────────────────────────────

function useProductState() {
  const [editableProducts, setEditableProducts] = useState<InvoicePreviewProduct[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [importActions, setImportActions] = useState<Record<string, InvoiceImportAction>>({});
  const [manualActionPreviewIds, setManualActionPreviewIds] = useState<Set<string>>(new Set());
  const [removedPreviewIds, setRemovedPreviewIds] = useState<Set<string>>(new Set());
  const [alreadyImportedRowIds, setAlreadyImportedRowIds] = useState<Set<string>>(new Set());
  const [pricingComputedByRowId, setPricingComputedByRowId] = useState<PricingByRowId>({});
  const autoCategoryRef = useRef(new Set<string>());
  return { editableProducts, setEditableProducts, editingIndex, setEditingIndex, importActions, setImportActions, manualActionPreviewIds, setManualActionPreviewIds, removedPreviewIds, setRemovedPreviewIds, alreadyImportedRowIds, setAlreadyImportedRowIds, pricingComputedByRowId, setPricingComputedByRowId, autoCategoryRef };
}

function resetInvoiceImportState(
  cancelActiveAttempt: () => void,
  setStep: React.Dispatch<React.SetStateAction<InvoiceStep>>,
  setInvoiceData: React.Dispatch<React.SetStateAction<ReturnType<typeof useInvoiceFileState>['invoiceData']>>,
  setRawProducts: React.Dispatch<React.SetStateAction<InvoiceProduct[]>>,
  setFileName: React.Dispatch<React.SetStateAction<string>>,
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setFxRate: React.Dispatch<React.SetStateAction<number | null>>,
  setIsFxManual: React.Dispatch<React.SetStateAction<boolean>>,
  setFxRateError: React.Dispatch<React.SetStateAction<string | null>>,
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>,
  setEditableProducts: React.Dispatch<React.SetStateAction<InvoicePreviewProduct[]>>,
  setEditingIndex: React.Dispatch<React.SetStateAction<number | null>>,
  setImportActions: React.Dispatch<React.SetStateAction<Record<string, InvoiceImportAction>>>,
  setManualActionPreviewIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setRemovedPreviewIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setAlreadyImportedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setPricingComputedByRowId: React.Dispatch<React.SetStateAction<PricingByRowId>>,
  autoCategoryRef: React.MutableRefObject<Set<string>>,
  setImportProgress: React.Dispatch<React.SetStateAction<{ current: number; total: number }>>,
  setImportErrors: React.Dispatch<React.SetStateAction<string[]>>,
): void {
  cancelActiveAttempt();
  setStep('upload'); setInvoiceData(null); setRawProducts([]); setFileName(''); setIsProcessing(false);
  setError(null); setFxRate(19.5); setIsFxManual(false); setFxRateError(null); setIsDragging(false);
  setEditableProducts([]); setEditingIndex(null); setImportActions({}); setManualActionPreviewIds(new Set());
  setRemovedPreviewIds(new Set()); setAlreadyImportedRowIds(new Set()); setPricingComputedByRowId({});
  autoCategoryRef.current = new Set<string>(); setImportProgress({ current: 0, total: 0 }); setImportErrors([]);
}

function createFileSelectHandler(
  handleFileSelectCore: ReturnType<typeof useInvoiceFileState>['handleFileSelectCore'],
  fxRate: number | null,
  setInvoiceData: React.Dispatch<React.SetStateAction<ReturnType<typeof useInvoiceFileState>['invoiceData']>>,
  setRawProducts: React.Dispatch<React.SetStateAction<InvoiceProduct[]>>,
  setRemovedPreviewIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setEditableProducts: React.Dispatch<React.SetStateAction<InvoicePreviewProduct[]>>,
  setImportActions: React.Dispatch<React.SetStateAction<Record<string, InvoiceImportAction>>>,
  setStep: React.Dispatch<React.SetStateAction<InvoiceStep>>,
): (file: File) => Promise<void> {
  return async (file) => {
    await handleFileSelectCore(file, (data, raw) => {
      setInvoiceData(data);
      setRawProducts(raw);
      setRemovedPreviewIds(new Set());
      setEditableProducts(raw.map((p, i) => mapToEditableProduct(p, i, fxRate)));
      setImportActions({});
      setStep('preview');
    });
  };
}

function updateEditableProduct(
  field: keyof InvoicePreviewProduct,
  value: string | number,
  product: InvoicePreviewProduct,
  fxRate: number | null,
  isFxReady: boolean,
): InvoicePreviewProduct {
  if (!NUMERIC_EDITABLE_FIELDS.has(field)) {
    return { ...product, [field]: typeof value === 'string' ? value : String(value) };
  }
  if (typeof value === 'string' && value.trim() === '') return product;
  const num = typeof value === 'number' ? value : Number(value);
  if (!isValidNumber(num)) return product;
  const next = { ...product, [field]: num } as InvoicePreviewProduct;
  if (field === 'quantity' || field === 'unitPrice') next.totalPrice = roundCurrency(next.quantity * next.unitPrice);
  if ((field === 'quantity' || field === 'unitPrice' || field === 'totalPrice') && isFxReady) next.lineTotalLei = roundCurrency(next.totalPrice * fxRate!);
  return next;
}

function removeEditableProduct(
  index: number,
  editableProducts: InvoicePreviewProduct[],
  setRemovedPreviewIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setImportActions: React.Dispatch<React.SetStateAction<Record<string, InvoiceImportAction>>>,
  setManualActionPreviewIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setEditableProducts: React.Dispatch<React.SetStateAction<InvoicePreviewProduct[]>>,
  setEditingIndex: React.Dispatch<React.SetStateAction<number | null>>,
): void {
  const toRemove = editableProducts[index];
  if (!toRemove) return;
  setRemovedPreviewIds((r) => new Set(r).add(toRemove.previewId));
  setImportActions((a) => {
    const n = { ...a };
    delete n[toRemove.previewId];
    return n;
  });
  setManualActionPreviewIds((m) => {
    const n = new Set(m);
    n.delete(toRemove.previewId);
    return n;
  });
  setEditableProducts((prev) => prev.filter((_, i) => i !== index));
  setEditingIndex(null);
}

// ── FX + raw product effects ──────────────────────────────────────────────────

function useFxRecomputeEffect(
  rawProducts: InvoiceProduct[], fxRate: number | null, removedPreviewIds: Set<string>,
  setEditableProducts: React.Dispatch<React.SetStateAction<InvoicePreviewProduct[]>>,
) {
  useEffect(() => {
    if (!rawProducts.length || !fxRate || !Number.isFinite(fxRate) || fxRate <= 0) return;
    setEditableProducts((prev) => {
      const prevById = new Map(prev.map((p) => [p.previewId, p]));
      return rawProducts.flatMap((p, i) => recomputeEditable(p, i, prevById, fxRate, removedPreviewIds));
    });
  }, [rawProducts, fxRate, removedPreviewIds, setEditableProducts]);
}

function useAiCategoryEffect(
  editableProducts: InvoicePreviewProduct[], autoCategoryRef: React.MutableRefObject<Set<string>>,
  setEditableProducts: React.Dispatch<React.SetStateAction<InvoicePreviewProduct[]>>,
) {
  useEffect(() => {
    if (!editableProducts.length) return;
    const pending = editableProducts.map((p, i) => ({ product: p, index: i }))
      .filter(({ product: p }) => p.barcode && !autoCategoryRef.current.has(p.barcode) && (!p.category || p.category === 'General'));
    if (!pending.length) return;
    pending.forEach(({ product: p }) => { if (p.barcode) autoCategoryRef.current.add(p.barcode); });
    void (async () => {
      const results = await Promise.allSettled(pending.map(({ product: p }) => suggestProductDetails(p.barcode || '')));
      setEditableProducts((prev) => prev.map((p, i) => {
        const mi = pending.findIndex((item) => item.index === i);
        if (mi === -1) return p;
        const r = results[mi];
        if (r.status !== 'fulfilled' || !r.value) return p;
        return { ...p, category: r.value.category || p.category, imageUrl: r.value.imageUrl || p.imageUrl };
      }));
    })();
  }, [editableProducts, autoCategoryRef, setEditableProducts]);
}

function useAlreadyImportedEffect(
  invoiceIdentity: { supplier?: string; invoiceNumber?: string },
  setAlreadyImportedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!invoiceIdentity.supplier || !invoiceIdentity.invoiceNumber) { setAlreadyImportedRowIds(new Set()); return; }
      try { const ids = await getAlreadyImportedRowIds(invoiceIdentity); if (!cancelled) setAlreadyImportedRowIds(ids); }
      catch (err) { logger.warn('Failed to load already-imported invoice rows', { supplier: invoiceIdentity.supplier, invoiceNumber: invoiceIdentity.invoiceNumber, errorMessage: err instanceof Error ? err.message : String(err) }); if (!cancelled) setAlreadyImportedRowIds(new Set()); }
    })();
    return () => { cancelled = true; };
  }, [invoiceIdentity, setAlreadyImportedRowIds]);
}

function usePricingPreviewEffect(
  editableProducts: InvoicePreviewProduct[], fxRate: number | null, invoiceData: ReturnType<typeof useInvoiceFileState>['invoiceData'],
  isFxReady: boolean, setPricingComputedByRowId: React.Dispatch<React.SetStateAction<PricingByRowId>>,
) {
  useEffect(() => {
    if (!invoiceData || !isFxReady || !editableProducts.length) { setPricingComputedByRowId({}); return; }
    let cancelled = false;
    void (async () => {
      try {
        const preview = await previewInvoicePricing({ invoice_meta: { supplier: invoiceData.supplier, invoice_number: invoiceData.invoiceNumber, date: invoiceData.invoiceDate }, rows: editableProducts.map((p, i) => ({ row_id: p.rowId || `row-${i + 1}`, name: p.name, barcode: p.barcode || null, quantity: p.quantity, line_total_lei: p.lineTotalLei, weight_kg: p.weightKg ?? null })) });
        if (cancelled) return;
        const next: PricingByRowId = {};
        for (const row of preview.rows) { if (row.status === 'ok' && row.computed) next[row.row_id] = row.computed; }
        setPricingComputedByRowId(next);
      } catch (err) { logger.warn('Invoice pricing preview preload failed', { errorMessage: err instanceof Error ? err.message : String(err) }); if (!cancelled) setPricingComputedByRowId({}); }
    })();
    return () => { cancelled = true; };
  }, [editableProducts, fxRate, invoiceData, isFxReady, setPricingComputedByRowId]);
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useInvoiceImport({ onOpenChange, onImport, products }: UseInvoiceImportProps): UseInvoiceImportReturn {
  const { t } = useTranslation();
  const fs = useInvoiceFileState(t);
  const ps = useProductState();
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const { step, setStep, isDragging, setIsDragging, invoiceData, setInvoiceData, rawProducts, setRawProducts, fileName, ocrProgress, isProcessing, setIsProcessing, error, setError, fxRate, setFxRate, isFxManual, fxRateError, setFxRateError, setIsFxManual, setFileName, handleFileSelectCore, handleFxRateChange, cancelActiveAttempt } = fs;
  const { editableProducts, setEditableProducts, editingIndex, setEditingIndex, importActions, setImportActions, manualActionPreviewIds, setManualActionPreviewIds, removedPreviewIds, setRemovedPreviewIds, alreadyImportedRowIds, setAlreadyImportedRowIds, pricingComputedByRowId, setPricingComputedByRowId, autoCategoryRef } = ps;

  const isFxReady = fxRate != null && Number.isFinite(fxRate) && fxRate > 0;
  const { barcodeIndex, nameIndex } = useProductIndexes(products);
  const matchResults = useMatchResults(editableProducts, barcodeIndex, nameIndex);
  const rowFlags = useRowFlags(editableProducts, matchResults, pricingComputedByRowId, alreadyImportedRowIds, invoiceData?.supplier);
  const getResolvedDefaultAction = useResolvedDefaultAction(matchResults, rowFlags);
  const importableRowCount = useMemo(() => editableProducts.filter((p, i) => (importActions[p.previewId] ?? getResolvedDefaultAction(i)) !== 'skip').length, [editableProducts, importActions, getResolvedDefaultAction]);
  const invoiceIdentity = useMemo(() => ({ supplier: invoiceData?.supplier?.trim(), invoiceNumber: invoiceData?.invoiceNumber?.trim() }), [invoiceData?.supplier, invoiceData?.invoiceNumber]);

  useFxRecomputeEffect(rawProducts, fxRate, removedPreviewIds, setEditableProducts);
  useAiCategoryEffect(editableProducts, autoCategoryRef, setEditableProducts);
  useAlreadyImportedEffect(invoiceIdentity, setAlreadyImportedRowIds);
  usePricingPreviewEffect(editableProducts, fxRate, invoiceData, isFxReady, setPricingComputedByRowId);
  useSyncImportActions(editableProducts, manualActionPreviewIds, getResolvedDefaultAction, setImportActions);

  const resetState = useCallback(() => {
    resetInvoiceImportState(
      cancelActiveAttempt,
      setStep,
      setInvoiceData,
      setRawProducts,
      setFileName,
      setIsProcessing,
      setError,
      setFxRate,
      setIsFxManual,
      setFxRateError,
      setIsDragging,
      setEditableProducts,
      setEditingIndex,
      setImportActions,
      setManualActionPreviewIds,
      setRemovedPreviewIds,
      setAlreadyImportedRowIds,
      setPricingComputedByRowId,
      autoCategoryRef,
      setImportProgress,
      setImportErrors,
    );
  }, [cancelActiveAttempt, setStep, setInvoiceData, setRawProducts, setFileName, setIsProcessing, setError, setFxRate, setIsFxManual, setFxRateError, setIsDragging, setEditableProducts, setEditingIndex, setImportActions, setManualActionPreviewIds, setRemovedPreviewIds, setAlreadyImportedRowIds, setPricingComputedByRowId, autoCategoryRef, setImportProgress, setImportErrors]);

  const handleFileSelect = useCallback(async (file: File) => (
    createFileSelectHandler(handleFileSelectCore, fxRate, setInvoiceData, setRawProducts, setRemovedPreviewIds, setEditableProducts, setImportActions, setStep)(file)
  ), [handleFileSelectCore, fxRate, setInvoiceData, setRawProducts, setRemovedPreviewIds, setEditableProducts, setImportActions, setStep]);

  const handleClose = useCallback(() => {
    if (step === 'importing') return;
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState, step]);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) void handleFileSelect(file); }, [setIsDragging, handleFileSelect]);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, [setIsDragging]);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, [setIsDragging]);
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) void handleFileSelect(file); }, [handleFileSelect]);
  const handleEditProduct = useCallback((index: number) => { setEditingIndex(index); }, [setEditingIndex]);
  const handleSaveEdit = useCallback(() => { setEditingIndex(null); }, [setEditingIndex]); const handleCancelEdit = handleSaveEdit;

  const handleRemoveProductAtIndex = useCallback((index: number) => {
    removeEditableProduct(index, editableProducts, setRemovedPreviewIds, setImportActions, setManualActionPreviewIds, setEditableProducts, setEditingIndex);
  }, [editableProducts, setRemovedPreviewIds, setImportActions, setManualActionPreviewIds, setEditableProducts, setEditingIndex]);

  const handleProductFieldChange = useCallback((index: number, field: keyof InvoicePreviewProduct, value: string | number) => {
    setEditableProducts((prev) => prev.map((p, i) => (
      i !== index ? p : updateEditableProduct(field, value, p, fxRate, isFxReady)
    )));
  }, [setEditableProducts, fxRate, isFxReady]);

  const handleConfirmImport = useInvoiceConfirmImport({ editableProducts, invoiceData, isFxReady, matchResults, importActions, getResolvedDefaultAction, onImport, setStep, setImportErrors, setImportProgress, t });

  return {
    step, isDragging, isProcessing, ocrProgress, fileName, error,
    fxRate, isFxManual, fxRateError, isFxReady,
    editableProducts, editingIndex, importActions, matchResults, rowFlags,
    pricingComputedByRowId, invoiceData, importableRowCount, importProgress, importErrors,
    handleClose, handleFileSelect, handleDrop, handleDragOver, handleDragLeave,
    handleFileInput, handleFxRateChange, handleRemoveProduct: handleRemoveProductAtIndex, handleEditProduct,
    handleSaveEdit, handleCancelEdit, handleProductFieldChange, handleConfirmImport,
    getResolvedDefaultAction, setManualActionPreviewIds, setImportActions, resetState, t,
  };
}
