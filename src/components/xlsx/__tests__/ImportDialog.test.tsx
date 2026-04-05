import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { ImportDialog } from '@/components/xlsx/ImportDialog';
import type { ImportResult as RunnerImportResult } from '@/lib/importRunnerTypes';
import type { ImportedProduct } from '@/lib/xlsx';
import type { Product } from '@/types';

vi.mock('@/lib/xlsx', async () => {
  const actual = await vi.importActual<typeof import('@/lib/xlsx')>('@/lib/xlsx');
  return {
    ...actual,
    parseXlsxFile: vi.fn(),
  };
});

vi.mock('@/lib/excelImportIdempotency', async () => {
  const actual = await vi.importActual<typeof import('@/lib/excelImportIdempotency')>('@/lib/excelImportIdempotency');
  return {
    ...actual,
    getAlreadyImportedExcelRowIds: vi.fn(),
  };
});

import { getAlreadyImportedExcelRowIds } from '@/lib/excelImportIdempotency';
import { parseXlsxFile } from '@/lib/xlsx';

let i18n: typeof import('@/i18n').default;

function makeImportedProduct(index: number): ImportedProduct {
  const barcode = `5901234567${String(index).padStart(4, '0')}`;

  return {
    Name: `Product ${index}`,
    Barcode: barcode,
    currentStock: 1,
    excelBatchId: 'batch-1',
    excelRowId: `Delivery:${index + 1}:${barcode}`,
  };
}

function renderDialog() {
  return render(
    <ImportDialog
      open
      onOpenChange={vi.fn()}
      onImport={vi.fn<(
        products: ImportedProduct[],
        onProgress?: (current: number, total: number) => void
      ) => Promise<RunnerImportResult>>()}
      products={[] as Product[]}
    />
  );
}

describe('ImportDialog', () => {
  beforeEach(async () => {
    ({ default: i18n } = await import('@/i18n'));
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set());
  });

  it('localizes invalid file type errors during upload', async () => {
    await i18n.changeLanguage('es');

    renderDialog();

    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    const invalidFile = new File(['plain text'], 'products.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText('Selecciona un archivo de Excel (.xlsx o .xls)')).toBeInTheDocument();
    });

    expect(vi.mocked(parseXlsxFile)).not.toHaveBeenCalled();
  });

  it('localizes fatal parser errors before preview opens', async () => {
    await i18n.changeLanguage('ro');
    vi.mocked(parseXlsxFile).mockResolvedValue({
      success: false,
      products: [],
      errors: [{
        row: 0,
        message: 'No sheets found in the workbook',
        messageKey: 'import.errors.noSheetsFound',
      }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
    });

    renderDialog();

    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    const workbookFile = new File(['xlsx'], 'delivery.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(fileInput, { target: { files: [workbookFile] } });

    await waitFor(() => {
      expect(screen.getByText('Nu au fost găsite foi în registrul de lucru')).toBeInTheDocument();
    });

    expect(screen.queryByText('No sheets found in the workbook')).not.toBeInTheDocument();
  });

  it('paginates large previews instead of mounting every row at once', async () => {
    vi.mocked(parseXlsxFile).mockResolvedValue({
      success: true,
      products: Array.from({ length: 55 }, (_, index) => makeImportedProduct(index + 1)),
      errors: [],
      warnings: [],
      totalRows: 55,
      validRows: 55,
    });

    renderDialog();

    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    const workbookFile = new File(['xlsx'], 'delivery.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(fileInput, { target: { files: [workbookFile] } });

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeInTheDocument();
    });

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(51);
    expect(screen.getByText('Product 50')).toBeInTheDocument();
    expect(screen.queryByText('Product 51')).not.toBeInTheDocument();
    expect(screen.getByText('Showing rows 1-50 of 55')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(screen.getByText('Product 51')).toBeInTheDocument();
    });

    expect(screen.queryByText('Product 1')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(6);
    expect(screen.getByText('Showing rows 51-55 of 55')).toBeInTheDocument();
  });
});
