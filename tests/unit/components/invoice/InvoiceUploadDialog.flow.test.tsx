import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { InvoiceUploadDialog } from '@/components/invoice/InvoiceUploadDialog';
import type { ImportedProduct } from '@/lib/xlsx';
import type { Product } from '@/types';

vi.mock('@/lib/invoiceOCR', async () => {
  const actual = await vi.importActual<typeof import('@/lib/invoiceOCR')>('@/lib/invoiceOCR');
  return {
    ...actual,
    extractInvoiceData: vi.fn(),
  };
});

vi.mock('@/lib/invoiceImportApi', () => ({
  previewInvoicePricing: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  suggestProductDetails: vi.fn().mockResolvedValue(null),
}));

import { extractInvoiceData } from '@/lib/invoiceOCR';
import { previewInvoicePricing } from '@/lib/invoiceImportApi';

describe('InvoiceUploadDialog flow', () => {
  it('runs upload -> preview -> import -> complete and calls onImport', async () => {
    vi.mocked(extractInvoiceData).mockResolvedValue({
      success: true,
      data: {
        products: [
          {
            rowId: 'row-1',
            name: 'Invoice Test Product',
            quantity: 2,
            unitPrice: 10,
            totalPrice: 20,
            barcode: '1234567890123',
            weightKgCandidate: 0.5,
          },
        ],
        supplier: 'Test Supplier',
        invoiceNumber: 'INV-100',
        invoiceDate: '2026-02-17',
        totalAmount: 20,
      },
    });

    vi.mocked(previewInvoicePricing).mockResolvedValue({
      rows: [
        {
          row_id: 'row-1',
          status: 'ok',
          computed: {
            base_price_eur: 1.11,
            transport_eur: 0.2,
            price_50: 1.66,
            price_70: 1.89,
            price_100: 2.22,
          },
        },
      ],
      summary: {
        ok_count: 1,
        needs_input_count: 0,
      },
    });

    const onImport = vi.fn<(
      products: ImportedProduct[],
      onProgress?: (current: number, total: number) => void
    ) => Promise<void>>().mockImplementation(async (products, onProgress) => {
      onProgress?.(1, products.length);
    });

    render(
      <InvoiceUploadDialog
        open
        onOpenChange={vi.fn()}
        onImport={onImport}
        products={[] as Product[]}
      />
    );

    const fileInput = document.getElementById('invoice-upload') as HTMLInputElement;
    const file = new File([new Blob(['%PDF-1.4'])], 'invoice.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Successfully extracted 1 products/i)).toBeInTheDocument();
    });

    const fxInput = screen.getByPlaceholderText(/Enter rate/i);
    fireEvent.change(fxInput, { target: { value: '19.5' } });

    const importButton = await screen.findByRole('button', { name: /Import 1 Products/i });
    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(previewInvoicePricing).toHaveBeenCalledTimes(1);
      expect(onImport).toHaveBeenCalledTimes(1);
    });

    const importedProducts = onImport.mock.calls[0][0];
    expect(importedProducts).toHaveLength(1);
    expect(importedProducts[0]).toMatchObject({
      Name: 'Invoice Test Product',
      Barcode: '1234567890123',
      importSource: 'invoice',
      invoiceRowId: 'row-1',
      Price: 1.11,
      price50: 1.66,
      price70: 1.89,
      price100: 2.22,
    });

    await waitFor(() => {
      expect(screen.getByText(/Import Complete!/i)).toBeInTheDocument();
    });
  });
});
