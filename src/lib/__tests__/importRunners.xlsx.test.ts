import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiProviderMock = vi.hoisted(() => ({
  addStockMovement: vi.fn(),
  createProduct: vi.fn(),
  getProductByBarcode: vi.fn(),
  updateProduct: vi.fn(),
}));

const excelIdempotencyMock = vi.hoisted(() => ({
  getAlreadyImportedExcelRowIds: vi.fn(),
  buildExcelRowNote: vi.fn(),
}));

vi.mock('@/lib/api-provider', () => apiProviderMock);
vi.mock('@/lib/excelImportIdempotency', () => excelIdempotencyMock);

import { runXlsxImport } from '@/lib/importRunners';
import type { Product } from '@/types';
import type { ImportedProduct } from '@/lib/xlsx';

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
    Price: 11,
    price50: 16,
    price70: 18,
    price100: 21,
    Category: 'Dairy',
    Supplier: 'Acme',
    currentStock: 5,
    importAction: 'update',
    existingProductId: 'p1',
    excelBatchId: 'batch-1',
    excelRowId: 'Delivery:2:5901234567890',
    ...overrides,
  };
}

describe('runXlsxImport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    excelIdempotencyMock.getAlreadyImportedExcelRowIds.mockResolvedValue(new Set());
    excelIdempotencyMock.buildExcelRowNote.mockReturnValue('excel_import|batch=batch-1|row=Delivery:2:5901234567890|barcode=5901234567890');
    apiProviderMock.updateProduct.mockResolvedValue(makeProduct({ Price: 11, 'Price 50%': 16, 'Price 70%': 18, 'Price 100%': 21 }));
    apiProviderMock.addStockMovement.mockResolvedValue({ id: 'm1' });
    apiProviderMock.getProductByBarcode.mockResolvedValue(makeProduct());
    apiProviderMock.createProduct.mockResolvedValue(makeProduct());
  });

  it('updates matched products and records stock with an Excel note', async () => {
    const result = await runXlsxImport(
      [makeImported()],
      [makeProduct()],
      ((key: string) => key) as never,
    );

    expect(result.successCount).toBe(1);
    expect(apiProviderMock.updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({
      Price: 11,
      'Price 50%': 16,
      'Price 70%': 18,
      'Price 100%': 21,
    }));
    expect(apiProviderMock.addStockMovement).toHaveBeenCalledWith(
      'p1',
      5,
      'IN',
      'excel_import|batch=batch-1|row=Delivery:2:5901234567890|barcode=5901234567890',
    );
  });

  it('skips duplicate batch rows for receive_stock actions', async () => {
    excelIdempotencyMock.getAlreadyImportedExcelRowIds.mockResolvedValue(new Set(['Delivery:2:5901234567890']));

    const result = await runXlsxImport(
      [makeImported({ Price: 10, price50: 15, price70: 17, price100: 20, importAction: 'receive_stock' })],
      [makeProduct()],
      ((key: string) => key) as never,
    );

    expect(result.successCount).toBe(0);
    expect(result.skipCount).toBe(1);
    expect(result.xlsxDuplicateSkipCount).toBe(1);
    expect(apiProviderMock.addStockMovement).not.toHaveBeenCalled();
  });
});
