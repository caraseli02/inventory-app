import { describe, expect, it } from 'vitest';

import {
  buildInvoiceKey,
  buildInvoiceRowNote,
  parseInvoiceRowNote,
} from '@/lib/invoiceIdempotency';

describe('invoiceIdempotency', () => {
  it('builds invoice key only when supplier and invoice number exist', () => {
    expect(buildInvoiceKey({ supplier: 'Acme', invoiceNumber: 'INV-1' })).toBe('Acme::INV-1');
    expect(buildInvoiceKey({ supplier: 'Acme', invoiceNumber: '' })).toBeNull();
    expect(buildInvoiceKey({ supplier: '', invoiceNumber: 'INV-1' })).toBeNull();
  });

  it('builds and parses row note with escaped delimiters/newlines', () => {
    const note = buildInvoiceRowNote({
      supplier: 'ACME | Fresh\nFoods',
      invoiceNumber: 'INV|42',
      rowId: 'row=1|A',
    });

    expect(note).toBeTruthy();

    expect(parseInvoiceRowNote(note)).toEqual({
      supplier: 'ACME | Fresh Foods',
      invoiceNumber: 'INV|42',
      rowId: 'row=1|A',
    });
  });

  it('returns null for unrelated or malformed notes', () => {
    expect(parseInvoiceRowNote('manual adjustment')).toBeNull();
    expect(parseInvoiceRowNote('invoice_import|supplier=x|invoice=y')).toBeNull();
    expect(parseInvoiceRowNote(null)).toBeNull();
  });
});
