import { describe, expect, it } from 'vitest';

import { buildXlsxPreviewRows } from '@/lib/xlsx/preview';
import type { ImportedProduct } from '@/lib/xlsx';
import type { Product } from '@/types';

function makeProduct(overrides?: Partial<Product['fields']>): Product {
  return {
    id: 'p1',
    createdTime: new Date('2026-03-29').toISOString(),
    fields: {
      Name: 'Milk',
      Barcode: '5901234567890',
      Price: 10,
      'Price 50%': 15,
      'Price 70%': 17,
      'Price 100%': 20,
      Category: 'Dairy',
      Supplier: 'Acme',
      ...overrides,
    },
  };
}

function makeImported(overrides?: Partial<ImportedProduct>): ImportedProduct {
  return {
    Name: 'Milk',
    Barcode: '5901234567890',
    Price: 10,
    price50: 15,
    price70: 17,
    price100: 20,
    Category: 'Dairy',
    Supplier: 'Acme',
    currentStock: 5,
    excelBatchId: 'batch-1',
    excelRowId: 'Sheet1:2:5901234567890',
    ...overrides,
  };
}

describe('buildXlsxPreviewRows', () => {
  it('defaults matched unchanged rows to receive_stock', () => {
    const rows = buildXlsxPreviewRows([makeImported()], [makeProduct()], new Set());

    expect(rows[0]?.importAction).toBe('receive_stock');
    expect(rows[0]?.matchedProduct?.id).toBe('p1');
    expect(rows[0]?.blockingError).toBeUndefined();
  });

  it('defaults matched changed rows to update', () => {
    const rows = buildXlsxPreviewRows([
      makeImported({ Price: 11, price50: 16, price70: 18, price100: 21 }),
    ], [makeProduct()], new Set());

    expect(rows[0]?.hasDiffs).toBe(true);
    expect(rows[0]?.importAction).toBe('update');
  });

  it('defaults already-imported unchanged rows to skip', () => {
    const rows = buildXlsxPreviewRows(
      [makeImported()],
      [makeProduct()],
      new Set(['Sheet1:2:5901234567890'])
    );

    expect(rows[0]?.isAlreadyImported).toBe(true);
    expect(rows[0]?.importAction).toBe('skip');
  });

  it('allows rows without barcode to create new products', () => {
    const rows = buildXlsxPreviewRows([
      makeImported({ Barcode: undefined, excelRowId: 'Sheet1:2:' }),
    ], [makeProduct()], new Set());

    expect(rows[0]?.matchedProduct).toBeNull();
    expect(rows[0]?.importAction).toBe('create');
    expect(rows[0]?.blockingError).toBeUndefined();
  });

  describe('no match scenarios', () => {
    it('defaults unmatched rows to create', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Barcode: '9999999999999' })],
        [makeProduct()],
        new Set()
      );

      expect(rows[0]?.matchedProduct).toBeNull();
      expect(rows[0]?.importAction).toBe('create');
    });

    it('defaults already-imported unmatched rows to skip', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Barcode: '9999999999999', excelRowId: 'Sheet1:5:9999999999999' })],
        [makeProduct()],
        new Set(['Sheet1:5:9999999999999'])
      );

      expect(rows[0]?.matchedProduct).toBeNull();
      expect(rows[0]?.isAlreadyImported).toBe(true);
      expect(rows[0]?.importAction).toBe('skip');
    });
  });

  describe('diff-specific scenarios', () => {
    it('defaults matched rows with price diffs to update', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Price: 12 })],
        [makeProduct({ Price: 10 })],
        new Set()
      );

      expect(rows[0]?.hasDiffs).toBe(true);
      expect(rows[0]?.importAction).toBe('update');
    });

    it('defaults matched rows with supplier diffs to update', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Supplier: 'NewCo' })],
        [makeProduct({ Supplier: 'Acme' })],
        new Set()
      );

      expect(rows[0]?.hasDiffs).toBe(true);
      expect(rows[0]?.importAction).toBe('update');
    });

    it('ignores General category diffs (non-meaningful)', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Category: 'General' })],
        [makeProduct({ Category: 'Dairy' })],
        new Set()
      );

      expect(rows[0]?.hasDiffs).toBe(false);
      expect(rows[0]?.importAction).toBe('receive_stock');
    });

    it('defaults matched rows with category diffs to update', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Category: 'Beverages' })],
        [makeProduct({ Category: 'Dairy' })],
        new Set()
      );

      expect(rows[0]?.hasDiffs).toBe(true);
      expect(rows[0]?.importAction).toBe('update');
    });

    it('defaults already-imported rows with price diffs to update', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Price: 12, excelRowId: 'Sheet1:2:5901234567890' })],
        [makeProduct({ Price: 10 })],
        new Set(['Sheet1:2:5901234567890'])
      );

      expect(rows[0]?.isAlreadyImported).toBe(true);
      expect(rows[0]?.hasDiffs).toBe(true);
      expect(rows[0]?.importAction).toBe('update');
    });
  });

  describe('edge cases', () => {
    it('trims whitespace from barcodes before matching', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Barcode: '  5901234567890  ' })],
        [makeProduct()],
        new Set()
      );

      expect(rows[0]?.matchedProduct?.id).toBe('p1');
      expect(rows[0]?.product.Barcode).toBe('5901234567890');
    });

    it('treats empty string barcode as missing', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Barcode: '', excelRowId: 'Sheet1:2:' })],
        [makeProduct()],
        new Set()
      );

      expect(rows[0]?.matchedProduct).toBeNull();
      expect(rows[0]?.importAction).toBe('create');
      expect(rows[0]?.blockingError).toBeUndefined();
    });

    it('handles missing excelRowId gracefully', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Barcode: '5901234567890', excelRowId: undefined })],
        [makeProduct()],
        new Set()
      );

      expect(rows[0]?.previewId).toBeDefined();
      expect(rows[0]?.isAlreadyImported).toBe(false);
    });
  });

  describe('idempotency scenarios', () => {
    it('allows first import of a batch row', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported()],
        [makeProduct()],
        new Set()
      );

      expect(rows[0]?.isAlreadyImported).toBe(false);
      expect(rows[0]?.importAction).toBe('receive_stock');
    });

    it('skips re-import of already imported batch row', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported()],
        [makeProduct()],
        new Set(['Sheet1:2:5901234567890'])
      );

      expect(rows[0]?.isAlreadyImported).toBe(true);
      expect(rows[0]?.importAction).toBe('skip');
    });

    it('allows update on already imported row when there are diffs', () => {
      const rows = buildXlsxPreviewRows(
        [makeImported({ Price: 12 })],
        [makeProduct({ Price: 10 })],
        new Set(['Sheet1:2:5901234567890'])
      );

      expect(rows[0]?.isAlreadyImported).toBe(true);
      expect(rows[0]?.hasDiffs).toBe(true);
      expect(rows[0]?.importAction).toBe('update');
    });
  });
});
