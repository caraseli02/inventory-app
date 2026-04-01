import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TFunction } from 'i18next';
import { runXlsxImport, buildXlsxImportToast } from '@/lib/xlsxImportRunner';
import type { ImportedProduct } from '@/lib/xlsx';
import type { Product } from '@/types';
import * as apiProvider from '@/lib/api-provider';

// Mock API functions
vi.mock('@/lib/api-provider', () => ({
  addStockMovement: vi.fn(),
  createProduct: vi.fn(),
  getProductByBarcode: vi.fn(),
  updateProduct: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock idempotency
vi.mock('@/lib/excelImportIdempotency', () => ({
  getAlreadyImportedExcelRowIds: vi.fn(() => Promise.resolve(new Set())),
  buildExcelRowNote: vi.fn(() => 'Test note'),
}));

const mockT = vi.fn((key: string, params?: Record<string, unknown>) => {
  if (params) return `${key} ${JSON.stringify(params)}`;
  return key;
}) as unknown as TFunction;

function makeProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'p1',
    createdTime: new Date('2026-03-31').toISOString(),
    fields: {
      Name: 'Milk',
      Barcode: '5901234567890',
      Price: 10,
      Category: 'Dairy',
      Supplier: 'Acme',
      ...overrides?.fields,
    },
    ...overrides,
  };
}

function makeImported(overrides?: Partial<ImportedProduct>): ImportedProduct {
  return {
    Name: 'Milk',
    Barcode: '5901234567890',
    Price: 10,
    Category: 'Dairy',
    Supplier: 'Acme',
    currentStock: 5,
    excelBatchId: 'batch-1',
    excelRowId: 'Sheet1:2:5901234567890',
    importAction: 'create',
    ...overrides,
  };
}

describe('runXlsxImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(apiProvider.addStockMovement).mockResolvedValue({} as any);
    vi.mocked(apiProvider.createProduct).mockResolvedValue(makeProduct());
    vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(makeProduct());
    vi.mocked(apiProvider.updateProduct).mockResolvedValue(makeProduct());
  });

  describe('create scenarios', () => {
    it('creates new product and adds stock when quantity present', async () => {
      const imported = [makeImported({ Barcode: '9999999999999', importAction: 'create' })];
      vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(null);
      vi.mocked(apiProvider.createProduct).mockResolvedValue(
        makeProduct({ id: 'new-product', fields: { Name: 'Milk', Barcode: '9999999999999' } })
      );

      const result = await runXlsxImport(imported, [], mockT);

      expect(result.successCount).toBe(1);
      expect(result.skipCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(apiProvider.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          Name: 'Milk',
          Barcode: '9999999999999',
        })
      );
      expect(apiProvider.addStockMovement).toHaveBeenCalledWith('new-product', 5, 'IN', expect.any(String));
    });

    it('creates new product without stock when quantity absent', async () => {
      const imported = [makeImported({ Barcode: '9999999999999', currentStock: undefined, importAction: 'create' })];
      vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(null);
      vi.mocked(apiProvider.createProduct).mockResolvedValue(makeProduct({ id: 'new-product' }));

      const result = await runXlsxImport(imported, [], mockT);

      expect(result.successCount).toBe(1);
      expect(apiProvider.createProduct).toHaveBeenCalled();
      expect(apiProvider.addStockMovement).not.toHaveBeenCalled();
    });

    it('skips already-imported unmatched row on re-import', async () => {
      const imported = [
        makeImported({
          Barcode: '9999999999999',
          excelRowId: 'Sheet1:5:9999999999999',
          importAction: 'create',
        }),
      ];
      vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(null);

      // Mock getAlreadyImportedExcelRowIds to return this row as already imported
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set(['Sheet1:5:9999999999999']));

      const result = await runXlsxImport(imported, [], mockT);

      expect(result.successCount).toBe(0);
      expect(result.skipCount).toBe(1);
      expect(result.xlsxDuplicateSkipCount).toBe(1);
      expect(apiProvider.createProduct).not.toHaveBeenCalled();
    });
  });

  describe('receive_stock scenarios', () => {
    it('receives stock for matched product', async () => {
      const imported = [makeImported({ existingProductId: 'p1', importAction: 'receive_stock' })];

      const result = await runXlsxImport(imported, [makeProduct()], mockT);

      expect(result.successCount).toBe(1);
      expect(apiProvider.addStockMovement).toHaveBeenCalledWith('p1', 5, 'IN', expect.any(String));
    });

    it('skips already-imported row on re-import', async () => {
      const imported = [
        makeImported({ existingProductId: 'p1', importAction: 'receive_stock', excelRowId: 'Sheet1:2:5901234567890' }),
      ];

      // Mock getAlreadyImportedExcelRowIds to return this row as already imported
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set(['Sheet1:2:5901234567890']));

      const result = await runXlsxImport(imported, [makeProduct()], mockT);

      expect(result.successCount).toBe(0);
      expect(result.skipCount).toBe(1);
      expect(result.xlsxDuplicateSkipCount).toBe(1);
      expect(apiProvider.addStockMovement).not.toHaveBeenCalled();
    });

    it('skips receive_stock when quantity is zero', async () => {
      const imported = [makeImported({ existingProductId: 'p1', currentStock: 0, importAction: 'receive_stock' })];

      const result = await runXlsxImport(imported, [makeProduct()], mockT);

      expect(result.successCount).toBe(0);
      expect(result.skipCount).toBe(1);
      expect(apiProvider.addStockMovement).not.toHaveBeenCalled();
    });

    it('skips receive_stock when quantity is negative', async () => {
      const imported = [makeImported({ existingProductId: 'p1', currentStock: -5, importAction: 'receive_stock' })];

      const result = await runXlsxImport(imported, [makeProduct()], mockT);

      expect(result.successCount).toBe(0);
      expect(result.skipCount).toBe(1);
      expect(apiProvider.addStockMovement).not.toHaveBeenCalled();
    });
  });

  describe('update scenarios', () => {
    it('updates product and receives stock for matched row with diffs', async () => {
      const imported = [
        makeImported({ existingProductId: 'p1', Price: 12, excelRowId: 'Sheet1:2:5901234567890', importAction: 'update' }),
      ];

      // Mock getAlreadyImportedExcelRowIds to return empty set (not imported yet)
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set());

      const result = await runXlsxImport(imported, [makeProduct()], mockT);

      expect(result.successCount).toBe(1);
      expect(apiProvider.updateProduct).toHaveBeenCalledWith('p1', { Price: 12 });
      expect(apiProvider.addStockMovement).toHaveBeenCalledWith('p1', 5, 'IN', expect.any(String));
    });

    it('updates product without diffs and receives stock', async () => {
      const imported = [
        makeImported({ existingProductId: 'p1', Price: 10, excelRowId: 'Sheet1:2:5901234567890', importAction: 'update' }),
      ];

      // Mock getAlreadyImportedExcelRowIds to return empty set (not imported yet)
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set());

      const result = await runXlsxImport(imported, [makeProduct()], mockT);

      expect(result.successCount).toBe(1);
      expect(apiProvider.updateProduct).not.toHaveBeenCalled(); // No diffs
      expect(apiProvider.addStockMovement).toHaveBeenCalled();
    });

    it('updates already-imported row with diffs but does not add stock again', async () => {
      const imported = [
        makeImported({ existingProductId: 'p1', Price: 12, excelRowId: 'Sheet1:2:5901234567890', importAction: 'update' }),
      ];

      // Mock getAlreadyImportedExcelRowIds to return this row as already imported
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set(['Sheet1:2:5901234567890']));

      const result = await runXlsxImport(imported, [makeProduct()], mockT);

      expect(result.successCount).toBe(1);
      expect(apiProvider.updateProduct).toHaveBeenCalledWith('p1', { Price: 12 });
      expect(apiProvider.addStockMovement).not.toHaveBeenCalled(); // Already imported, no stock
    });
  });

  describe('skip scenarios', () => {
    it('skips row when action is skip', async () => {
      const imported = [makeImported({ importAction: 'skip' })];

      const result = await runXlsxImport(imported, [makeProduct()], mockT);

      expect(result.successCount).toBe(0);
      expect(result.skipCount).toBe(1);
      expect(apiProvider.createProduct).not.toHaveBeenCalled();
      expect(apiProvider.updateProduct).not.toHaveBeenCalled();
      expect(apiProvider.addStockMovement).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles create product failure and continues', async () => {
      const imported = [
        makeImported({ Barcode: '9999', excelRowId: 'Sheet1:1:9999', importAction: 'create' }),
        makeImported({ Barcode: '9998', excelRowId: 'Sheet1:2:9998', importAction: 'create' }),
      ];
      vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(null);
      vi.mocked(apiProvider.createProduct)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(makeProduct({ id: 'second-product' }));

      // Mock getAlreadyImportedExcelRowIds to return empty set
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set());

      const result = await runXlsxImport(imported, [], mockT);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.failedProducts).toHaveLength(1);
      expect(result.failedProducts[0]?.name).toBe('Milk');
    });

    it('handles stock movement failure and returns partial success', async () => {
      const imported = [
        makeImported({ importAction: 'create', excelRowId: 'Sheet1:1:5901234567890', currentStock: 5 }),
      ];
      vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(null);
      vi.mocked(apiProvider.createProduct).mockResolvedValue(makeProduct({ id: 'new-product' }));
      vi.mocked(apiProvider.addStockMovement).mockRejectedValue(new Error('Stock error'));

      // Mock getAlreadyImportedExcelRowIds to return empty set
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set());

      const result = await runXlsxImport(imported, [], mockT);

      expect(result.successCount).toBe(0); // Not counted as complete success
      expect(result.partialProducts).toHaveLength(1);
      expect(result.partialProducts[0]?.name).toBe('Milk');
      expect(result.partialProducts[0]?.message).toContain('stock movement failed');
    });

    it('handles update failure gracefully', async () => {
      const imported = [makeImported({ existingProductId: 'p1', Price: 12, importAction: 'update' })];
      vi.mocked(apiProvider.updateProduct).mockRejectedValue(new Error('Update failed'));

      const result = await runXlsxImport(imported, [makeProduct()], mockT);

      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.failedProducts).toHaveLength(1);
    });
  });

  describe('product resolution', () => {
    it('resolves product by existingProductId when set', async () => {
      const imported = [
        makeImported({ existingProductId: 'p1', excelRowId: 'Sheet1:2:5901234567890', importAction: 'receive_stock' }),
      ];

      // Mock getAlreadyImportedExcelRowIds to return empty set
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set());

      const result = await runXlsxImport(imported, [makeProduct()], mockT);

      expect(result.successCount).toBe(1);
      expect(apiProvider.getProductByBarcode).not.toHaveBeenCalled(); // Should use existingProductId
      expect(apiProvider.addStockMovement).toHaveBeenCalledWith('p1', 5, 'IN', expect.any(String));
    });

    it('falls back to barcode lookup when existingProductId not found', async () => {
      const imported = [
        makeImported({ existingProductId: 'deleted-product', excelRowId: 'Sheet1:2:5901234567890', importAction: 'receive_stock' }),
      ];
      const allProducts = [makeProduct()];

      // Mock getAlreadyImportedExcelRowIds to return empty set
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set());

      const result = await runXlsxImport(imported, allProducts, mockT);

      expect(result.successCount).toBe(1);
      expect(apiProvider.getProductByBarcode).toHaveBeenCalledWith('5901234567890');
    });

    it('handles receive_stock action for deleted product', async () => {
      const imported = [
        makeImported({ existingProductId: 'deleted-product', importAction: 'receive_stock' }),
      ];
      vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(null);

      const result = await runXlsxImport(imported, [], mockT);

      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.failedProducts[0]?.error).toContain('Matched product no longer exists');
    });

    it('handles update action for deleted product', async () => {
      const imported = [
        makeImported({ existingProductId: 'deleted-product', importAction: 'update' }),
      ];
      vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(null);

      const result = await runXlsxImport(imported, [], mockT);

      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.failedProducts[0]?.error).toContain('Matched product no longer exists');
    });
  });

  describe('edge cases', () => {
    it('handles empty barcode gracefully', async () => {
      const imported = [
        makeImported({ Barcode: '', excelRowId: 'Sheet1:2:', importAction: 'create' }),
      ];
      vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(null);
      vi.mocked(apiProvider.createProduct).mockResolvedValue(makeProduct({ id: 'new-product' }));

      // Mock getAlreadyImportedExcelRowIds to return empty set
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set());

      const result = await runXlsxImport(imported, [], mockT);

      expect(result.successCount).toBe(1);
      expect(apiProvider.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          Barcode: undefined,
        })
      );
    });

    it('handles undefined barcode gracefully', async () => {
      const imported = [
        makeImported({ Barcode: undefined, excelRowId: 'Sheet1:2:', importAction: 'create' }),
      ];
      vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(null);
      vi.mocked(apiProvider.createProduct).mockResolvedValue(makeProduct({ id: 'new-product' }));

      // Mock getAlreadyImportedExcelRowIds to return empty set
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set());

      const result = await runXlsxImport(imported, [], mockT);

      expect(result.successCount).toBe(1);
      expect(apiProvider.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          Barcode: undefined,
        })
      );
    });

    it('handles create action for already-imported unmatched row', async () => {
      const imported = [
        makeImported({
          Barcode: '9999999999999',
          excelRowId: 'Sheet1:5:9999999999999',
          importAction: 'create',
        }),
      ];
      vi.mocked(apiProvider.getProductByBarcode).mockResolvedValue(null);

      // Mock getAlreadyImportedExcelRowIds to return this row as already imported
      const { getAlreadyImportedExcelRowIds } = await import('@/lib/excelImportIdempotency');
      vi.mocked(getAlreadyImportedExcelRowIds).mockResolvedValue(new Set(['Sheet1:5:9999999999999']));

      const result = await runXlsxImport(imported, [], mockT);

      expect(result.successCount).toBe(0);
      expect(result.skipCount).toBe(1);
      expect(result.xlsxDuplicateSkipCount).toBe(1);
      expect(apiProvider.createProduct).not.toHaveBeenCalled();
    });
  });
});

describe('buildXlsxImportToast', () => {
  it('builds success toast with counts', () => {
    const result = {
      successCount: 10,
      skipCount: 2,
      errorCount: 0,
      invoiceDuplicateSkipCount: 0,
      xlsxDuplicateSkipCount: 1,
      failedProducts: [],
      partialProducts: [],
    };

    const toast = buildXlsxImportToast(result, mockT);

    expect(toast.toastType).toBe('success');
    expect(toast.title).toBe('import.success');
    expect(toast.message).toContain('10');
    expect(toast.message).toContain('1');
  });

  it('builds warning toast for partial success', () => {
    const result = {
      successCount: 5,
      skipCount: 0,
      errorCount: 2,
      invoiceDuplicateSkipCount: 0,
      xlsxDuplicateSkipCount: 0,
      failedProducts: [{ name: 'Product 1', error: 'Error 1' }],
      partialProducts: [{ name: 'Product 2', message: 'Partial error' }],
    };

    const toast = buildXlsxImportToast(result, mockT);

    expect(toast.toastType).toBe('warning');
    expect(toast.title).toBe('import.success');
    expect(toast.message).toContain('Product 1');
    expect(toast.message).toContain('Product 2');
  });

  it('builds error toast for complete failure', () => {
    const result = {
      successCount: 0,
      skipCount: 0,
      errorCount: 3,
      invoiceDuplicateSkipCount: 0,
      xlsxDuplicateSkipCount: 0,
      failedProducts: [
        { name: 'Product 1', error: 'Error 1' },
        { name: 'Product 2', error: 'Error 2' },
        { name: 'Product 3', error: 'Error 3' },
        { name: 'Product 4', error: 'Error 4' },
      ],
      partialProducts: [],
    };

    const toast = buildXlsxImportToast(result, mockT);

    expect(toast.toastType).toBe('error');
    expect(toast.title).toBe('import.failed');
    expect(toast.message).toContain('Product 1');
    expect(toast.message).toContain('... and 1 more');
  });

  it('builds info toast for all skipped', () => {
    const result = {
      successCount: 0,
      skipCount: 5,
      errorCount: 0,
      invoiceDuplicateSkipCount: 0,
      xlsxDuplicateSkipCount: 0,
      failedProducts: [],
      partialProducts: [],
    };

    const toast = buildXlsxImportToast(result, mockT);

    expect(toast.toastType).toBe('info');
    expect(toast.title).toBe('import.allSkipped');
    expect(toast.message).toContain('5');
  });
});
