import { useCallback, useEffect, useMemo } from 'react';
import type { InvoiceData, InvoiceProduct } from '@/lib/invoiceOCR';
import type { Product } from '@/types';
import type { InvoiceImportAction } from '@/lib/invoiceImportDiffs';
import {
  useProductIndexes,
  useMatchResults,
  useRowFlags,
  useResolvedDefaultAction,
  useSyncImportActions,
} from './useInvoiceComputed';
import type {
  InvoiceMatchResult,
  InvoiceStep,
  InvoicePreviewProduct,
  PricingByRowId,
  RowFlag,
  UseInvoiceImportReturn,
  UseInvoiceImportProps,
} from './useInvoiceImport.types';
import { logger } from '@/lib/logger';
import { getAlreadyImportedRowIds } from '@/lib/invoiceIdempotency';
import { previewInvoicePricing } from '@/lib/invoiceImportApi';
import { suggestProductDetails } from '@/lib/ai';

function hydrateInvoiceSession(
  invoiceData: InvoiceData,
  fileName: string,
  fxRate: number | null,
  setFileName: React.Dispatch<React.SetStateAction<string>>,
  setInvoiceData: React.Dispatch<React.SetStateAction<InvoiceData | null>>,
  setRawProducts: React.Dispatch<React.SetStateAction<InvoiceProduct[]>>,
  setRemovedPreviewIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setEditableProducts: React.Dispatch<React.SetStateAction<InvoicePreviewProduct[]>>,
  setImportActions: React.Dispatch<React.SetStateAction<Record<string, InvoiceImportAction>>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setStep: React.Dispatch<React.SetStateAction<InvoiceStep>>,
  mapToEditableProduct: (product: InvoiceProduct, index: number, rate: number | null) => InvoicePreviewProduct,
): void {
  const raw = invoiceData.products;
  setFileName(fileName);
  setInvoiceData(invoiceData);
  setRawProducts(raw);
  setRemovedPreviewIds(new Set());
  setEditableProducts(raw.map((p, i) => mapToEditableProduct(p, i, fxRate)));
  setImportActions({});
  setError(null);
  setStep('preview');
}

export function useInitialInvoiceSessionEffect(
  initialSession: UseInvoiceImportProps['initialSession'],
  fxRate: number | null,
  setFileName: React.Dispatch<React.SetStateAction<string>>,
  setInvoiceData: React.Dispatch<React.SetStateAction<InvoiceData | null>>,
  setRawProducts: React.Dispatch<React.SetStateAction<InvoiceProduct[]>>,
  setRemovedPreviewIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setEditableProducts: React.Dispatch<React.SetStateAction<InvoicePreviewProduct[]>>,
  setImportActions: React.Dispatch<React.SetStateAction<Record<string, InvoiceImportAction>>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setStep: React.Dispatch<React.SetStateAction<InvoiceStep>>,
  hydratedSessionKeyRef: React.MutableRefObject<string | null>,
  mapToEditableProduct: (product: InvoiceProduct, index: number, rate: number | null) => InvoicePreviewProduct,
) {
  useEffect(() => {
    if (!initialSession) return;
    const sessionKey = `${initialSession.jobId ?? 'local'}:${initialSession.fileName}`;
    if (hydratedSessionKeyRef.current === sessionKey) return;
    hydrateInvoiceSession(
      initialSession.invoiceData,
      initialSession.fileName,
      fxRate,
      setFileName,
      setInvoiceData,
      setRawProducts,
      setRemovedPreviewIds,
      setEditableProducts,
      setImportActions,
      setError,
      setStep,
      mapToEditableProduct,
    );
    hydratedSessionKeyRef.current = sessionKey;
  }, [initialSession, fxRate, setFileName, setInvoiceData, setRawProducts, setRemovedPreviewIds, setEditableProducts, setImportActions, setError, setStep, hydratedSessionKeyRef, mapToEditableProduct]);
}

export function useInvoiceDialogHandlers(
  step: InvoiceStep,
  onOpenChange: (open: boolean) => void,
  resetState: () => void,
  handleFileSelect: (file: File) => Promise<void>,
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>,
  setEditingIndex: React.Dispatch<React.SetStateAction<number | null>>,
) {
  const handleClose = useCallback(() => {
    if (step === 'importing') return;
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState, step]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelect(file);
  }, [setIsDragging, handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, [setIsDragging]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFileSelect(file);
  }, [handleFileSelect]);

  const handleEditProduct = useCallback((index: number) => {
    setEditingIndex(index);
  }, [setEditingIndex]);

  const handleSaveEdit = useCallback(() => {
    setEditingIndex(null);
  }, [setEditingIndex]);

  return {
    handleClose,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInput,
    handleEditProduct,
    handleSaveEdit,
  };
}

function useFxRecomputeEffect(
  rawProducts: InvoiceProduct[], fxRate: number | null, removedPreviewIds: Set<string>,
  setEditableProducts: React.Dispatch<React.SetStateAction<InvoicePreviewProduct[]>>,
  recomputeEditable: (
    product: InvoiceProduct,
    index: number,
    previous: Map<string, InvoicePreviewProduct>,
    rate: number,
    removedIds: Set<string>,
  ) => InvoicePreviewProduct[],
) {
  useEffect(() => {
    if (!rawProducts.length || !fxRate || !Number.isFinite(fxRate) || fxRate <= 0) return;
    setEditableProducts((prev) => {
      const prevById = new Map(prev.map((p) => [p.previewId, p]));
      return rawProducts.flatMap((p, i) => recomputeEditable(p, i, prevById, fxRate, removedPreviewIds));
    });
  }, [rawProducts, fxRate, removedPreviewIds, setEditableProducts, recomputeEditable]);
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
  editableProducts: InvoicePreviewProduct[], fxRate: number | null, invoiceData: InvoiceData | null,
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

export function useInvoiceDerivedState(
  products: Product[],
  editableProducts: InvoicePreviewProduct[],
  importActions: Record<string, InvoiceImportAction>,
  manualActionPreviewIds: Set<string>,
  invoiceData: InvoiceData | null,
  alreadyImportedRowIds: Set<string>,
  pricingComputedByRowId: PricingByRowId,
  fxRate: number | null,
  rawProducts: InvoiceProduct[],
  removedPreviewIds: Set<string>,
  setEditableProducts: React.Dispatch<React.SetStateAction<InvoicePreviewProduct[]>>,
  autoCategoryRef: React.MutableRefObject<Set<string>>,
  setAlreadyImportedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setPricingComputedByRowId: React.Dispatch<React.SetStateAction<PricingByRowId>>,
  setImportActions: React.Dispatch<React.SetStateAction<Record<string, InvoiceImportAction>>>,
  recomputeEditable: (
    product: InvoiceProduct,
    index: number,
    previous: Map<string, InvoicePreviewProduct>,
    rate: number,
    removedIds: Set<string>,
  ) => InvoicePreviewProduct[],
) {
  const isFxReady = fxRate != null && Number.isFinite(fxRate) && fxRate > 0;
  const { barcodeIndex, nameIndex } = useProductIndexes(products);
  const matchResults = useMatchResults(editableProducts, barcodeIndex, nameIndex);
  const rowFlags = useRowFlags(editableProducts, matchResults, pricingComputedByRowId, alreadyImportedRowIds, invoiceData?.supplier);
  const getResolvedDefaultAction = useResolvedDefaultAction(matchResults, rowFlags);
  const importableRowCount = useMemo(() => editableProducts.filter((p, i) => (importActions[p.previewId] ?? getResolvedDefaultAction(i)) !== 'skip').length, [editableProducts, importActions, getResolvedDefaultAction]);
  const invoiceIdentity = useMemo(() => ({ supplier: invoiceData?.supplier?.trim(), invoiceNumber: invoiceData?.invoiceNumber?.trim() }), [invoiceData?.supplier, invoiceData?.invoiceNumber]);

  useFxRecomputeEffect(rawProducts, fxRate, removedPreviewIds, setEditableProducts, recomputeEditable);
  useAiCategoryEffect(editableProducts, autoCategoryRef, setEditableProducts);
  useAlreadyImportedEffect(invoiceIdentity, setAlreadyImportedRowIds);
  usePricingPreviewEffect(editableProducts, fxRate, invoiceData, isFxReady, setPricingComputedByRowId);
  useSyncImportActions(editableProducts, manualActionPreviewIds, getResolvedDefaultAction, setImportActions);

  return {
    isFxReady,
    matchResults,
    rowFlags,
    getResolvedDefaultAction,
    importableRowCount,
  };
}

export function buildInvoiceImportReturn(
  fs: {
    step: InvoiceStep;
    isDragging: boolean;
    isProcessing: boolean;
    ocrProgress: number;
    fileName: string;
    error: string | null;
    fxRate: number | null;
    isFxManual: boolean;
    fxRateError: string | null;
    invoiceData: InvoiceData | null;
    handleFxRateChange: (value: string) => void;
  },
  ps: {
    editableProducts: InvoicePreviewProduct[];
    editingIndex: number | null;
    importActions: Record<string, InvoiceImportAction>;
    pricingComputedByRowId: PricingByRowId;
    setManualActionPreviewIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setImportActions: React.Dispatch<React.SetStateAction<Record<string, InvoiceImportAction>>>;
  },
  importState: {
    isFxReady: boolean;
    matchResults: (InvoiceMatchResult | null)[];
    rowFlags: RowFlag[];
    getResolvedDefaultAction: (index: number) => InvoiceImportAction;
    importableRowCount: number;
  },
  dialogHandlers: ReturnType<typeof useInvoiceDialogHandlers>,
  importProgress: { current: number; total: number },
  importErrors: string[],
  handleFileSelect: (file: File) => Promise<void>,
  handleRemoveProduct: (index: number) => void,
  handleProductFieldChange: (index: number, field: keyof InvoicePreviewProduct, value: string | number) => void,
  handleConfirmImport: () => Promise<void>,
  resetState: () => void,
  t: ReturnType<typeof import('react-i18next').useTranslation>['t'],
): UseInvoiceImportReturn {
  return {
    step: fs.step,
    isDragging: fs.isDragging,
    isProcessing: fs.isProcessing,
    ocrProgress: fs.ocrProgress,
    fileName: fs.fileName,
    error: fs.error,
    fxRate: fs.fxRate,
    isFxManual: fs.isFxManual,
    fxRateError: fs.fxRateError,
    isFxReady: importState.isFxReady,
    editableProducts: ps.editableProducts,
    editingIndex: ps.editingIndex,
    importActions: ps.importActions,
    matchResults: importState.matchResults,
    rowFlags: importState.rowFlags,
    pricingComputedByRowId: ps.pricingComputedByRowId,
    invoiceData: fs.invoiceData,
    importableRowCount: importState.importableRowCount,
    importProgress,
    importErrors,
    handleClose: dialogHandlers.handleClose,
    handleFileSelect,
    handleDrop: dialogHandlers.handleDrop,
    handleDragOver: dialogHandlers.handleDragOver,
    handleDragLeave: dialogHandlers.handleDragLeave,
    handleFileInput: dialogHandlers.handleFileInput,
    handleFxRateChange: fs.handleFxRateChange,
    handleRemoveProduct,
    handleEditProduct: dialogHandlers.handleEditProduct,
    handleSaveEdit: dialogHandlers.handleSaveEdit,
    handleCancelEdit: dialogHandlers.handleSaveEdit,
    handleProductFieldChange,
    handleConfirmImport,
    getResolvedDefaultAction: importState.getResolvedDefaultAction,
    setManualActionPreviewIds: ps.setManualActionPreviewIds,
    setImportActions: ps.setImportActions,
    resetState,
    t,
  };
}
