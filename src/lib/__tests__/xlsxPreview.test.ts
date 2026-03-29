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

  it('blocks rows without barcode for the canonical path', () => {
    const rows = buildXlsxPreviewRows([
      makeImported({ Barcode: undefined, excelRowId: 'Sheet1:2:' }),
    ], [makeProduct()], new Set());

    expect(rows[0]?.blockingError).toContain('Barcode is required');
  });
});
