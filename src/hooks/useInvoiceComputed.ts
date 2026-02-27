import { useMemo, useCallback, useEffect } from 'react';
import type { Product } from '@/types';
import { getDefaultInvoiceImportAction, type InvoiceImportAction } from '@/lib/invoiceImportDiffs';
import { buildInvoiceProductUpdatePayload } from '@/lib/invoiceImportDiffs';
import { normalizeForMatch, buildImportErrorMessage } from './useInvoiceImport.helpers';
import type { InvoicePreviewProduct, InvoiceMatchResult, PricingByRowId, RowFlag } from './useInvoiceImport.types';

export function buildBarcodeIndex(products: Product[]): Map<string, Product> {
  const m = new Map<string, Product>();
  products.forEach((p) => { const b = p.fields.Barcode?.trim(); if (b) m.set(b, p); });
  return m;
}

export function buildNameIndex(products: Product[]): Map<string, Product | null> {
  const m = new Map<string, Product | null>();
  products.forEach((p) => {
    const n = normalizeForMatch(p.fields.Name);
    if (!n) return;
    if (m.has(n)) { m.set(n, null); return; }
    m.set(n, p);
  });
  return m;
}

export function computeMatchResults(
  editable: InvoicePreviewProduct[],
  barcodeIdx: Map<string, Product>,
  nameIdx: Map<string, Product | null>,
): (InvoiceMatchResult | null)[] {
  return editable.map((p) => {
    const barcode = p.barcode?.trim();
    if (barcode) { const m = barcodeIdx.get(barcode); if (m) return { product: m, type: 'barcode' as const }; }
    if (!barcode) { const m = nameIdx.get(normalizeForMatch(p.name)); if (m) return { product: m, type: 'name' as const }; }
    return null;
  });
}

export function computeRowFlags(
  editable: InvoicePreviewProduct[],
  matches: (InvoiceMatchResult | null)[],
  pricingById: PricingByRowId,
  importedIds: Set<string>,
  supplier: string | undefined,
): RowFlag[] {
  return editable.map((p, i) => {
    const match = matches[i];
    const rowId = p.rowId || `row-${i + 1}`;
    const computed = pricingById[rowId];
    const isAlreadyImported = importedIds.has(rowId);
    const updatePayload = match && computed
      ? buildInvoiceProductUpdatePayload(match.product, { Price: computed.base_price_eur, price50: computed.price_50, price70: computed.price_70, price100: computed.price_100, Category: p.category || 'General', Supplier: supplier })
      : {};
    const updateKeys = Object.keys(updatePayload);
    const hasDiffs = updateKeys.length > 0;
    const hasPriceDiffs = updateKeys.some((k) => k === 'Price' || k === 'Price 50%' || k === 'Price 70%' || k === 'Price 100%');
    return { rowId, isAlreadyImported, hasDiffs, hasPriceDiffs };
  });
}

export { buildImportErrorMessage };

export function useProductIndexes(products: Product[]) {
  const barcodeIndex = useMemo(() => buildBarcodeIndex(products), [products]);
  const nameIndex = useMemo(() => buildNameIndex(products), [products]);
  return { barcodeIndex, nameIndex };
}

export function useMatchResults(
  editableProducts: InvoicePreviewProduct[],
  barcodeIndex: Map<string, Product>,
  nameIndex: Map<string, Product | null>,
) {
  return useMemo(() => computeMatchResults(editableProducts, barcodeIndex, nameIndex), [editableProducts, barcodeIndex, nameIndex]);
}

export function useRowFlags(
  editableProducts: InvoicePreviewProduct[],
  matchResults: (InvoiceMatchResult | null)[],
  pricingComputedByRowId: PricingByRowId,
  alreadyImportedRowIds: Set<string>,
  supplier: string | undefined,
) {
  return useMemo(() => computeRowFlags(editableProducts, matchResults, pricingComputedByRowId, alreadyImportedRowIds, supplier), [editableProducts, matchResults, pricingComputedByRowId, alreadyImportedRowIds, supplier]);
}

export function useResolvedDefaultAction(
  matchResults: (InvoiceMatchResult | null)[],
  rowFlags: RowFlag[],
): (index: number) => InvoiceImportAction {
  return useCallback((index: number): InvoiceImportAction => {
    const match = matchResults[index];
    const flags = rowFlags[index];
    return getDefaultInvoiceImportAction({ hasMatch: Boolean(match), isAlreadyImported: Boolean(flags?.isAlreadyImported), hasDiffs: Boolean(flags?.isAlreadyImported ? flags?.hasPriceDiffs : flags?.hasDiffs) });
  }, [matchResults, rowFlags]);
}

export function useSyncImportActions(
  editableProducts: InvoicePreviewProduct[],
  manualActionPreviewIds: Set<string>,
  getResolvedDefaultAction: (index: number) => InvoiceImportAction,
  setImportActions: React.Dispatch<React.SetStateAction<Record<string, InvoiceImportAction>>>,
) {
  useEffect(() => {
    setImportActions((prev) => {
      const next: Record<string, InvoiceImportAction> = {};
      editableProducts.forEach((p, i) => {
        const previous = prev[p.previewId];
        if (manualActionPreviewIds.has(p.previewId) && (previous === 'skip' || previous === 'update' || previous === 'create' || previous === 'receive_stock')) {
          next[p.previewId] = previous; return;
        }
        next[p.previewId] = getResolvedDefaultAction(i);
      });
      return next;
    });
  }, [editableProducts, getResolvedDefaultAction, manualActionPreviewIds, setImportActions]);
}
