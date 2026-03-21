import { describe, expect, it } from 'vitest'

import { getPreviewId } from '../../../src/hooks/useInvoiceImport.helpers'
import type { InvoiceProduct } from '../../../src/lib/invoiceOCR'

describe('getPreviewId', () => {
  it('keeps duplicate OCR rowId entries unique by appending index', () => {
    const duplicateRow: InvoiceProduct = {
      rowId: 'row-42',
      name: 'Test Product',
      quantity: 1,
      unitPrice: 1,
      totalPrice: 1,
    }

    expect(getPreviewId(duplicateRow, 0)).toBe('row:row-42:idx:0')
    expect(getPreviewId(duplicateRow, 1)).toBe('row:row-42:idx:1')
  })

  it('falls back to index-only id when rowId is empty after trim', () => {
    const blankRow: InvoiceProduct = {
      rowId: '   ',
      name: 'Blank Row',
      quantity: 1,
      unitPrice: 1,
      totalPrice: 1,
    }

    expect(getPreviewId(blankRow, 7)).toBe('idx:7')
  })
})
