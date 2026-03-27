import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

import { InvoiceUploadDialog } from '@/components/invoice/InvoiceUploadDialog';
import i18n from '@/i18n';
import type { ImportedProduct } from '@/lib/xlsx';
import type { Product } from '@/types';

vi.mock('@/lib/invoiceOCR', async () => {
  const actual = await vi.importActual<typeof import('@/lib/invoiceOCR')>('@/lib/invoiceOCR');
  return {
    ...actual,
    extractInvoiceData: vi.fn(),
    getInvoiceExtractionStatus: vi.fn(),
  };
});

vi.mock('@/lib/invoiceImportApi', () => ({
  previewInvoicePricing: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  suggestProductDetails: vi.fn().mockResolvedValue(null),
}));

import { extractInvoiceData, getInvoiceExtractionStatus } from '@/lib/invoiceOCR';
import { previewInvoicePricing } from '@/lib/invoiceImportApi';

describe('InvoiceUploadDialog flow', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
  });

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

    expect(screen.queryByText(/LEI/i)).not.toBeInTheDocument();
    expect(screen.getByText('€0.52')).toBeInTheDocument();
    expect(screen.getByText('€1.03')).toBeInTheDocument();

    const fxInput = screen.getByPlaceholderText(/Enter rate/i);
    expect((fxInput as HTMLInputElement).value).toBe('19.5');

    const importButton = await screen.findByRole('button', { name: /Import 1 Products/i });
    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);

    await waitFor(() => {
      // Preview pricing may run multiple times while preview state settles
      // (preload + FX/default-action recalculation) and again on confirm import.
      expect(vi.mocked(previewInvoicePricing).mock.calls.length).toBeGreaterThanOrEqual(2);
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

  it('keeps removed preview rows removed when FX rate changes', async () => {
    vi.mocked(extractInvoiceData).mockResolvedValue({
      success: true,
      data: {
        products: [
          {
            rowId: 'row-1',
            name: 'Invoice Test Product A',
            quantity: 1,
            unitPrice: 10,
            totalPrice: 10,
            barcode: '1234567890123',
            weightKgCandidate: 0.5,
          },
          {
            rowId: 'row-2',
            name: 'Invoice Test Product B',
            quantity: 1,
            unitPrice: 10,
            totalPrice: 10,
            barcode: '1234567890124',
            weightKgCandidate: 0.5,
          },
        ],
        supplier: 'Test Supplier',
        invoiceNumber: 'INV-101',
        invoiceDate: '2026-02-17',
        totalAmount: 20,
      },
    });

    render(
      <InvoiceUploadDialog
        open
        onOpenChange={vi.fn()}
        onImport={vi.fn()}
        products={[] as Product[]}
      />
    );

    const fileInput = document.getElementById('invoice-upload') as HTMLInputElement;
    const file = new File([new Blob(['%PDF-1.4'])], 'invoice.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Successfully extracted 2 products/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Invoice Test Product A')).toBeInTheDocument();
    expect(screen.getByText('Invoice Test Product B')).toBeInTheDocument();

    const removeButtons = screen.getAllByTitle(/Remove product/i);
    fireEvent.click(removeButtons[0]!);

    await waitFor(() => {
      expect(screen.queryByText('Invoice Test Product A')).not.toBeInTheDocument();
    });

    const fxInput = screen.getByPlaceholderText(/Enter rate/i);
    fireEvent.change(fxInput, { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.queryByText('Invoice Test Product A')).not.toBeInTheDocument();
      expect(screen.getByText('Invoice Test Product B')).toBeInTheDocument();
    });
  });

  it('does not remove sibling rows when OCR returns duplicate rowId values', async () => {
    vi.mocked(extractInvoiceData).mockResolvedValue({
      success: true,
      data: {
        products: [
          {
            rowId: 'row-dup',
            name: 'Invoice Duplicate A',
            quantity: 1,
            unitPrice: 10,
            totalPrice: 10,
            barcode: '1234567890123',
            weightKgCandidate: 0.5,
          },
          {
            rowId: 'row-dup',
            name: 'Invoice Duplicate B',
            quantity: 1,
            unitPrice: 10,
            totalPrice: 10,
            barcode: '1234567890124',
            weightKgCandidate: 0.5,
          },
        ],
        supplier: 'Test Supplier',
        invoiceNumber: 'INV-102',
        invoiceDate: '2026-02-17',
        totalAmount: 20,
      },
    });

    render(
      <InvoiceUploadDialog
        open
        onOpenChange={vi.fn()}
        onImport={vi.fn()}
        products={[] as Product[]}
      />
    );

    const fileInput = document.getElementById('invoice-upload') as HTMLInputElement;
    const file = new File([new Blob(['%PDF-1.4'])], 'invoice.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Successfully extracted 2 products/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Invoice Duplicate A')).toBeInTheDocument();
    expect(screen.getByText('Invoice Duplicate B')).toBeInTheDocument();

    const removeButtons = screen.getAllByTitle(/Remove product/i);
    fireEvent.click(removeButtons[0]!);

    await waitFor(() => {
      expect(screen.queryByText('Invoice Duplicate A')).not.toBeInTheDocument();
      expect(screen.getByText('Invoice Duplicate B')).toBeInTheDocument();
    });

    const fxInput = screen.getByPlaceholderText(/Enter rate/i);
    fireEvent.change(fxInput, { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.queryByText('Invoice Duplicate A')).not.toBeInTheDocument();
      expect(screen.getByText('Invoice Duplicate B')).toBeInTheDocument();
    });
  });

  it('polls accepted extraction jobs and opens preview on terminal success', async () => {
    vi.mocked(extractInvoiceData).mockResolvedValue({
      success: false,
      pending: true,
      jobId: 'ext-123',
      jobStatus: 'queued',
      statusUrl: '/invoice/extraction-jobs/ext-123',
      retryAfterSeconds: 0,
    });

    vi.mocked(getInvoiceExtractionStatus).mockResolvedValue({
      success: true,
      data: {
        products: [
          {
            rowId: 'row-1',
            name: 'Async Invoice Product',
            quantity: 1,
            unitPrice: 10,
            totalPrice: 10,
            barcode: '1234567890999',
            weightKgCandidate: 0.5,
          },
        ],
        supplier: 'Async Supplier',
        invoiceNumber: 'INV-ASYNC-1',
        invoiceDate: '2026-03-27',
        totalAmount: 10,
      },
    });

    render(
      <InvoiceUploadDialog
        open
        onOpenChange={vi.fn()}
        onImport={vi.fn()}
        products={[] as Product[]}
      />
    );

    const fileInput = document.getElementById('invoice-upload') as HTMLInputElement;
    const file = new File([new Blob(['%PDF-1.4'])], 'invoice.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(vi.mocked(getInvoiceExtractionStatus)).toHaveBeenCalledWith('/invoice/extraction-jobs/ext-123');
      expect(screen.getByText(/Successfully extracted 1 products/i)).toBeInTheDocument();
      expect(screen.getByText('Async Invoice Product')).toBeInTheDocument();
    });
  });

  it('ignores stale async completions after the dialog closes', async () => {
    let resolveOldJob: ((value: Awaited<ReturnType<typeof getInvoiceExtractionStatus>>) => void) | undefined;

    vi.mocked(extractInvoiceData).mockResolvedValueOnce({
      success: false,
      pending: true,
      jobId: 'ext-old',
      jobStatus: 'queued',
      statusUrl: '/invoice/extraction-jobs/ext-old',
      retryAfterSeconds: 0,
    });

    vi.mocked(getInvoiceExtractionStatus).mockImplementation(() => new Promise((resolve) => {
      resolveOldJob = resolve as typeof resolveOldJob;
    }));

    function Wrapper() {
      const [open, setOpen] = useState(true);
      return (
        <InvoiceUploadDialog
          open={open}
          onOpenChange={setOpen}
          onImport={vi.fn()}
          products={[] as Product[]}
        />
      );
    }

    render(
      <Wrapper />
    );

    const fileInput = document.getElementById('invoice-upload') as HTMLInputElement;
    const oldFile = new File([new Blob(['%PDF-1.4 old'])], 'invoice-old.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [oldFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Processing invoice/i)).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByRole('button', { name: /Close/i });
    fireEvent.click(closeButtons[closeButtons.length - 1]!);

    resolveOldJob?.({
      success: true,
      data: {
        products: [
          {
            rowId: 'row-old',
            name: 'Old Invoice Product',
            quantity: 1,
            unitPrice: 8,
            totalPrice: 8,
            barcode: '1234567890222',
            weightKgCandidate: 0.5,
          },
        ],
        supplier: 'Old Supplier',
        invoiceNumber: 'INV-OLD',
        invoiceDate: '2026-03-27',
        totalAmount: 8,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText(/Import from Invoice/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Old Invoice Product')).not.toBeInTheDocument();
  });
});
