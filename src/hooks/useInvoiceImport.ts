import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvoiceImportAction } from '@/lib/invoiceImportDiffs';
import type { InvoiceProduct } from '@/lib/invoiceOCR';
import { parseWeightKgFromProductName } from '@/lib/invoicePricing';
import { useInvoiceFileState } from './useInvoiceFileState';
import { useInvoiceConfirmImport } from './useInvoiceConfirmImport';
import {
  isValidNumber,
  roundCurrency,
  normalizeForMatch,
  inferCategoryFromName,
  getPreviewId,
  buildImportErrorMessage,
  NUMERIC_EDITABLE_FIELDS,
} from './useInvoiceImport.helpers';
import type {
  InvoiceStep,
  InvoiceMatchResult,
  InvoicePreviewProduct,
  PricingByRowId,
  RowFlag,
  UseInvoiceImportReturn,
  UseInvoiceImportProps,
} from './useInvoiceImport.types';
import {
  useInitialInvoiceSessionEffect,
  useInvoiceDialogHandlers,
  useInvoiceDerivedState,
  buildInvoiceImportReturn,
} from './useInvoiceImport.lifecycle';

export type { InvoiceStep, InvoiceMatchResult, InvoicePreviewProduct, PricingByRowId, RowFlag, UseInvoiceImportReturn };
export { isValidNumber, roundCurrency, normalizeForMatch, inferCategoryFromName, getPreviewId, buildImportErrorMessage };
export { CATEGORIES } from './useInvoiceImport.types';

function mapToEditableProduct(p: InvoiceProduct, index: number, fxRate: number | null): InvoicePreviewProduct {
  const isFxReadyNow = fxRate != null && Number.isFinite(fxRate) && fxRate > 0;
  const quantity = p.quantity;
  const totalPrice = isFxReadyNow ? roundCurrency(p.totalPrice / fxRate) : p.totalPrice;
  const unitPrice = isFxReadyNow ? (quantity > 0 ? roundCurrency(totalPrice / quantity) : 0) : p.unitPrice;
  return {
    ...p,
    previewId: getPreviewId(p, index),
    lineTotalLei: p.totalPrice,
    quantity,
    unitPrice,
    totalPrice,
    weightKg: p.weightKgCandidate ?? parseWeightKgFromProductName(p.name),
    category: p.categorySuggestion ?? inferCategoryFromName(p.name),
  };
}

function recomputeEditable(
  p: InvoiceProduct,
  index: number,
  prev: Map<string, InvoicePreviewProduct>,
  fxRate: number,
  removedIds: Set<string>,
): InvoicePreviewProduct[] {
  const previewId = getPreviewId(p, index);
  if (removedIds.has(previewId)) return [];
  const previous = prev.get(previewId);
  const quantity = previous?.quantity ?? p.quantity;
  const weightKg = previous?.weightKg ?? p.weightKgCandidate ?? parseWeightKgFromProductName(p.name);
  const lineTotalLei = previous?.lineTotalLei ?? p.totalPrice;
  const totalPrice = roundCurrency(lineTotalLei / fxRate);
  const unitPrice = quantity > 0 ? roundCurrency(totalPrice / quantity) : 0;
  return [{
    ...p,
    previewId,
    lineTotalLei,
    name: previous?.name ?? p.name,
    barcode: previous?.barcode ?? p.barcode,
    quantity,
    unitPrice,
    totalPrice,
    weightKg,
    category: previous?.category ?? p.categorySuggestion ?? inferCategoryFromName(p.name),
    imageUrl: previous?.imageUrl,
  }];
}

function useProductState() {
  const [editableProducts, setEditableProducts] = useState<InvoicePreviewProduct[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [importActions, setImportActions] = useState<Record<string, InvoiceImportAction>>({});
  const [manualActionPreviewIds, setManualActionPreviewIds] = useState<Set<string>>(new Set());
  const [removedPreviewIds, setRemovedPreviewIds] = useState<Set<string>>(new Set());
  const [alreadyImportedRowIds, setAlreadyImportedRowIds] = useState<Set<string>>(new Set());
  const [pricingComputedByRowId, setPricingComputedByRowId] = useState<PricingByRowId>({});
  const autoCategoryRef = useRef(new Set<string>());
  return {
    editableProducts,
    setEditableProducts,
    editingIndex,
    setEditingIndex,
    importActions,
    setImportActions,
    manualActionPreviewIds,
    setManualActionPreviewIds,
    removedPreviewIds,
    setRemovedPreviewIds,
    alreadyImportedRowIds,
    setAlreadyImportedRowIds,
    pricingComputedByRowId,
    setPricingComputedByRowId,
    autoCategoryRef,
  };
}

function resetInvoiceImportState(
  cancelActiveAttempt: () => void,
  fs: ReturnType<typeof useInvoiceFileState>,
  ps: ReturnType<typeof useProductState>,
  setImportProgress: React.Dispatch<React.SetStateAction<{ current: number; total: number }>>,
  setImportErrors: React.Dispatch<React.SetStateAction<string[]>>,
) {
  cancelActiveAttempt();
  fs.setStep('upload');
  fs.setInvoiceData(null);
  fs.setRawProducts([]);
  fs.setFileName('');
  fs.setIsProcessing(false);
  fs.setError(null);
  fs.setFxRate(19.5);
  fs.setIsFxManual(false);
  fs.setFxRateError(null);
  fs.setIsDragging(false);
  ps.setEditableProducts([]);
  ps.setEditingIndex(null);
  ps.setImportActions({});
  ps.setManualActionPreviewIds(new Set());
  ps.setRemovedPreviewIds(new Set());
  ps.setAlreadyImportedRowIds(new Set());
  ps.setPricingComputedByRowId({});
  ps.autoCategoryRef.current = new Set<string>();
  setImportProgress({ current: 0, total: 0 });
  setImportErrors([]);
}

function createFileSelectHandler(
  submitInvoiceFile: ReturnType<typeof useInvoiceFileState>['submitInvoiceFile'],
  fxRate: number | null,
  ps: ReturnType<typeof useProductState>,
  fs: ReturnType<typeof useInvoiceFileState>,
  onPendingJob?: UseInvoiceImportProps['onPendingJob'],
) {
  return async (file: File) => {
    const result = await submitInvoiceFile(file);
    if (!result) return;

    if (result.success) {
      fs.setInvoiceData(result.data);
      fs.setRawProducts(result.data.products);
      ps.setRemovedPreviewIds(new Set());
      ps.setEditableProducts(result.data.products.map((p, i) => mapToEditableProduct(p, i, fxRate)));
      ps.setImportActions({});
      fs.setStep('preview');
      return;
    }

    if (result.pending) {
      onPendingJob?.(result, file);
      fs.setStep('processing');
      return;
    }

    fs.setError(result.error);
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
  if ((field === 'quantity' || field === 'unitPrice' || field === 'totalPrice') && isFxReady) next.lineTotalLei = roundCurrency(next.totalPrice * (fxRate ?? 0));
  return next;
}

function removeEditableProduct(
  index: number,
  editableProducts: InvoicePreviewProduct[],
  ps: ReturnType<typeof useProductState>,
) {
  const toRemove = editableProducts[index];
  if (!toRemove) return;
  ps.setRemovedPreviewIds((r) => new Set(r).add(toRemove.previewId));
  ps.setImportActions((a) => {
    const next = { ...a };
    delete next[toRemove.previewId];
    return next;
  });
  ps.setManualActionPreviewIds((m) => {
    const next = new Set(m);
    next.delete(toRemove.previewId);
    return next;
  });
  ps.setEditableProducts((prev) => prev.filter((_, i) => i !== index));
  ps.setEditingIndex(null);
}

function useInvoiceImportActions(
  fs: ReturnType<typeof useInvoiceFileState>,
  ps: ReturnType<typeof useProductState>,
  onPendingJob: UseInvoiceImportProps['onPendingJob'],
  isFxReady: boolean,
  setImportProgress: React.Dispatch<React.SetStateAction<{ current: number; total: number }>>,
  setImportErrors: React.Dispatch<React.SetStateAction<string[]>>,
  hydratedSessionKeyRef: React.MutableRefObject<string | null>,
) {
  const handleFileSelect = useCallback(
    (file: File) => createFileSelectHandler(fs.submitInvoiceFile, fs.fxRate, ps, fs, onPendingJob)(file),
    [fs, ps, onPendingJob],
  );

  const resetState = useCallback(() => {
    hydratedSessionKeyRef.current = null;
    resetInvoiceImportState(fs.cancelActiveAttempt, fs, ps, setImportProgress, setImportErrors);
  }, [fs, ps, setImportProgress, setImportErrors, hydratedSessionKeyRef]);

  const handleRemoveProduct = useCallback(
    (index: number) => removeEditableProduct(index, ps.editableProducts, ps),
    [ps],
  );

  const handleProductFieldChange = useCallback((index: number, field: keyof InvoicePreviewProduct, value: string | number) => {
    ps.setEditableProducts((prev) => prev.map((p, i) => (
      i !== index ? p : updateEditableProduct(field, value, p, fs.fxRate, isFxReady)
    )));
  }, [ps, fs.fxRate, isFxReady]);

  return {
    handleFileSelect,
    resetState,
    handleRemoveProduct,
    handleProductFieldChange,
  };
}

function useInvoiceImportWorkflow(
  initialSession: UseInvoiceImportProps['initialSession'],
  fs: ReturnType<typeof useInvoiceFileState>,
  ps: ReturnType<typeof useProductState>,
  hydratedSessionKeyRef: React.MutableRefObject<string | null>,
  isFxReady: boolean,
  matchResults: (InvoiceMatchResult | null)[],
  getResolvedDefaultAction: (index: number) => InvoiceImportAction,
  onImport: UseInvoiceImportProps['onImport'],
  setImportErrors: React.Dispatch<React.SetStateAction<string[]>>,
  setImportProgress: React.Dispatch<React.SetStateAction<{ current: number; total: number }>>,
  t: ReturnType<typeof useTranslation>['t'],
) {
  const handleConfirmImport = useInvoiceConfirmImport({
    editableProducts: ps.editableProducts,
    invoiceData: fs.invoiceData,
    isFxReady,
    matchResults,
    importActions: ps.importActions,
    getResolvedDefaultAction,
    onImport,
    setStep: fs.setStep,
    setImportErrors,
    setImportProgress,
    t,
  });

  useInitialInvoiceSessionEffect(
    initialSession,
    fs.fxRate,
    fs.setFileName,
    fs.setInvoiceData,
    fs.setRawProducts,
    ps.setRemovedPreviewIds,
    ps.setEditableProducts,
    ps.setImportActions,
    fs.setError,
    fs.setStep,
    hydratedSessionKeyRef,
    mapToEditableProduct,
  );

  return { handleConfirmImport };
}

export function useInvoiceImport({ onOpenChange, onImport, products, initialSession, onPendingJob }: UseInvoiceImportProps): UseInvoiceImportReturn {
  const { t } = useTranslation();
  const fs = useInvoiceFileState(t);
  const ps = useProductState();
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const hydratedSessionKeyRef = useRef<string | null>(null);

  const { isFxReady, matchResults, rowFlags, getResolvedDefaultAction, importableRowCount } = useInvoiceDerivedState(
    products,
    ps.editableProducts,
    ps.importActions,
    ps.manualActionPreviewIds,
    fs.invoiceData,
    ps.alreadyImportedRowIds,
    ps.pricingComputedByRowId,
    fs.fxRate,
    fs.rawProducts,
    ps.removedPreviewIds,
    ps.setEditableProducts,
    ps.autoCategoryRef,
    ps.setAlreadyImportedRowIds,
    ps.setPricingComputedByRowId,
    ps.setImportActions,
    recomputeEditable,
  );

  const { handleFileSelect, resetState, handleRemoveProduct, handleProductFieldChange } = useInvoiceImportActions(fs, ps, onPendingJob, isFxReady, setImportProgress, setImportErrors, hydratedSessionKeyRef);

  const dialogHandlers = useInvoiceDialogHandlers(
    fs.step,
    onOpenChange,
    resetState,
    handleFileSelect,
    fs.setIsDragging,
    ps.setEditingIndex,
  );
  const { handleConfirmImport } = useInvoiceImportWorkflow(
    initialSession,
    fs,
    ps,
    hydratedSessionKeyRef,
    isFxReady,
    matchResults,
    getResolvedDefaultAction,
    onImport,
    setImportErrors,
    setImportProgress,
    t,
  );
  return buildInvoiceImportReturn(
    fs,
    ps,
    { isFxReady, matchResults, rowFlags, getResolvedDefaultAction, importableRowCount },
    dialogHandlers,
    importProgress,
    importErrors,
    handleFileSelect,
    handleRemoveProduct,
    handleProductFieldChange,
    handleConfirmImport,
    resetState,
    t,
  );
}
