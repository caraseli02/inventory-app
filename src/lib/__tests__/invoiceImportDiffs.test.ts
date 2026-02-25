import { describe, expect, it } from 'vitest';

import {
  buildInvoiceProductUpdatePayload,
  getDefaultInvoiceImportAction,
  hasMeaningfulInvoiceDiffs,
} from '@/lib/invoiceImportDiffs';
import type { Product } from '@/types';

function makeProduct(overrides?: Partial<Product['fields']>): Product {
  return {
    id: 'p1',
    createdTime: new Date('2026-02-25').toISOString(),
    fields: {
      Name: 'Milk',
      Price: 1.25,
      'Price 50%': 1.88,
      'Price 70%': 2.13,
      'Price 100%': 2.5,
      Category: 'Dairy',
      Supplier: 'Supplier A',
      ...overrides,
    },
  };
}

describe('invoiceImportDiffs', () => {
  it('selects default actions by match/diff/idempotency matrix', () => {
    expect(getDefaultInvoiceImportAction({ hasMatch: false, isAlreadyImported: false, hasDiffs: false })).toBe('create');
    expect(getDefaultInvoiceImportAction({ hasMatch: true, isAlreadyImported: false, hasDiffs: false })).toBe('receive_stock');
    expect(getDefaultInvoiceImportAction({ hasMatch: true, isAlreadyImported: false, hasDiffs: true })).toBe('update');
    expect(getDefaultInvoiceImportAction({ hasMatch: true, isAlreadyImported: true, hasDiffs: true })).toBe('update');
  });

  it('ignores tiny numeric differences within tolerance', () => {
    const existing = makeProduct();
    const imported = {
      Price: 1.25005,
      price50: 1.88001,
      price70: 2.13009,
      price100: 2.50001,
      Category: 'General',
      Supplier: '',
    };

    expect(hasMeaningfulInvoiceDiffs(existing, imported)).toBe(false);
    expect(buildInvoiceProductUpdatePayload(existing, imported)).toEqual({});
  });

  it('treats non-default category and supplier changes as meaningful', () => {
    const existing = makeProduct({ Category: 'General', Supplier: 'Old Supplier' });
    const imported = {
      Price: 1.35,
      price50: 2.03,
      price70: 2.3,
      price100: 2.7,
      Category: 'Dairy',
      Supplier: 'New Supplier',
    };

    expect(hasMeaningfulInvoiceDiffs(existing, imported)).toBe(true);
    expect(buildInvoiceProductUpdatePayload(existing, imported)).toEqual({
      Price: 1.35,
      'Price 50%': 2.03,
      'Price 70%': 2.3,
      'Price 100%': 2.7,
      Category: 'Dairy',
      Supplier: 'New Supplier',
    });
  });

  it('does not overwrite curated category with General', () => {
    const existing = makeProduct({ Category: 'Produce' });
    const imported = { Category: 'General' };

    expect(hasMeaningfulInvoiceDiffs(existing, imported)).toBe(false);
    expect(buildInvoiceProductUpdatePayload(existing, imported)).toEqual({});
  });
});
