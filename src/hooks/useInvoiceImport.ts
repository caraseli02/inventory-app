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

  const { step, setStep, isDragging, setIsDragging, invoiceData, setInvoiceData, rawProducts, setRawProducts, fileName, ocrProgress, isProcessing, setIsProcessing, error, setError, fxRate, setFxRate, isFxManual, fxRateError, setFxRateError, setIsFxManual, setFileName, handleFileSelectCore, handleFxRateChange } = fs;
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
    setStep('upload'); setInvoiceData(null); setRawProducts([]); setFileName(''); setIsProcessing(false);
    setError(null); setFxRate(19.5); setIsFxManual(false); setFxRateError(null); setIsDragging(false);
    setEditableProducts([]); setEditingIndex(null); setImportActions({}); setManualActionPreviewIds(new Set());
    setRemovedPreviewIds(new Set()); setAlreadyImportedRowIds(new Set()); setPricingComputedByRowId({});
    autoCategoryRef.current = new Set<string>(); setImportProgress({ current: 0, total: 0 }); setImportErrors([]);
  }, [setStep, setInvoiceData, setRawProducts, setFileName, setIsProcessing, setError, setFxRate, setIsFxManual, setFxRateError, setIsDragging, setEditableProducts, setEditingIndex, setImportActions, setManualActionPreviewIds, setRemovedPreviewIds, setAlreadyImportedRowIds, setPricingComputedByRowId, autoCategoryRef]);

  const handleFileSelect = useCallback(async (file: File) => {
    await handleFileSelectCore(file, (data, raw) => {
      setInvoiceData(data); setRawProducts(raw); setRemovedPreviewIds(new Set());
      setEditableProducts(raw.map((p, i) => mapToEditableProduct(p, i, fxRate)));
      setImportActions({}); setStep('preview');
    });
  }, [handleFileSelectCore, fxRate, setInvoiceData, setRawProducts, setRemovedPreviewIds, setEditableProducts, setImportActions, setStep]);

  const handleClose = useCallback(() => { if (!isProcessing) { resetState(); onOpenChange(false); } }, [isProcessing, onOpenChange, resetState]);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) void handleFileSelect(file); }, [setIsDragging, handleFileSelect]);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, [setIsDragging]);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, [setIsDragging]);
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) void handleFileSelect(file); }, [handleFileSelect]);
  const handleEditProduct = useCallback((index: number) => { setEditingIndex(index); }, [setEditingIndex]);
  const handleSaveEdit = useCallback(() => { setEditingIndex(null); }, [setEditingIndex]);
  const handleCancelEdit = useCallback(() => { setEditingIndex(null); }, [setEditingIndex]);

  const handleRemoveProduct = useCallback((index: number) => {
    const toRemove = editableProducts[index]; if (!toRemove) return;
    setRemovedPreviewIds((r) => new Set(r).add(toRemove.previewId));
    setImportActions((a) => { const n = { ...a }; delete n[toRemove.previewId]; return n; });
    setManualActionPreviewIds((m) => { const n = new Set(m); n.delete(toRemove.previewId); return n; });
    setEditableProducts((prev) => prev.filter((_, i) => i !== index)); setEditingIndex(null);
  }, [editableProducts, setRemovedPreviewIds, setImportActions, setManualActionPreviewIds, setEditableProducts, setEditingIndex]);

  const handleProductFieldChange = useCallback((index: number, field: keyof InvoicePreviewProduct, value: string | number) => {
    setEditableProducts((prev) => prev.map((p, i) => {
      if (i !== index) return p;
      if (NUMERIC_EDITABLE_FIELDS.has(field)) {
        if (typeof value === 'string' && value.trim() === '') return p;
        const num = typeof value === 'number' ? value : Number(value);
        if (!isValidNumber(num)) return p;
        const next = { ...p, [field]: num } as InvoicePreviewProduct;
        if (field === 'quantity' || field === 'unitPrice') next.totalPrice = roundCurrency(next.quantity * next.unitPrice);
        if ((field === 'quantity' || field === 'unitPrice' || field === 'totalPrice') && isFxReady) next.lineTotalLei = roundCurrency(next.totalPrice * fxRate!);
        return next;
      }
      return { ...p, [field]: typeof value === 'string' ? value : String(value) };
    }));
  }, [setEditableProducts, fxRate, isFxReady]);

  const handleConfirmImport = useInvoiceConfirmImport({ editableProducts, invoiceData, isFxReady, matchResults, importActions, getResolvedDefaultAction, onImport, setStep, setImportErrors, setImportProgress, t });

  return {
    step, isDragging, isProcessing, ocrProgress, fileName, error,
    fxRate, isFxManual, fxRateError, isFxReady,
    editableProducts, editingIndex, importActions, matchResults, rowFlags,
    pricingComputedByRowId, invoiceData, importableRowCount, importProgress, importErrors,
    handleClose, handleFileSelect, handleDrop, handleDragOver, handleDragLeave,
    handleFileInput, handleFxRateChange, handleRemoveProduct, handleEditProduct,
    handleSaveEdit, handleCancelEdit, handleProductFieldChange, handleConfirmImport,
    getResolvedDefaultAction, setManualActionPreviewIds, setImportActions, resetState, t,
  };
}
