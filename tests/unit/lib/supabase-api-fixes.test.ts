import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as supabaseApi from '../../../src/lib/supabase-api';
import { supabase } from '../../../src/lib/supabase';
import { eventStore } from '../../../src/lib/event-store/store';
import { checkLowStockPolicy } from '../../../src/lib/eda/policies/reorder-policy';

// Mock dependencies
vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    })),
  },
}));

vi.mock('../../../src/lib/event-store/store', () => ({
  eventStore: {
    append: vi.fn().mockResolvedValue({ id: 'evt-1' }),
  },
}));

vi.mock('../../../src/lib/eda/policies/reorder-policy', () => ({
  checkLowStockPolicy: vi.fn(),
}));

// Mock Logger to suppress noise
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Supabase API Fixes (Event Ordering & Error Resilience)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('updateProduct', () => {
    const productId = 'prod-1';
    const updateData = { Name: 'New Name' };

    // Setup mocks for a standard successful flow
    const setupSuccessMocks = () => {
      // Mock fetch current row
      const currentRow = { id: productId, name: 'Old Name', barcode: '123' };
      // Mock update response
      const updatedRow = { id: productId, name: 'New Name', barcode: '123' };

      const singleMock = vi.fn()
        .mockResolvedValueOnce({ data: currentRow, error: null }) // First call (fetch)
        .mockResolvedValueOnce({ data: updatedRow, error: null }); // Second call (update)

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: singleMock
        })
      });

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: singleMock
          })
        })
      });

      // @ts-expect-error - Mocking
      supabase.from.mockImplementation((table) => {
        if (table === 'products') {
          return { select: selectMock, update: updateMock };
        }
        if (table === 'stock_movements') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        return {};
      });
    };

    it('should NOT append event if DB update fails', async () => {
      // Mock fetch success
      const currentRow = { id: productId, name: 'Old Name', barcode: '123' };
      const fetchSingleMock = vi.fn().mockResolvedValue({ data: currentRow, error: null });

      // Mock update FAILURE
      const updateSingleMock = vi.fn().mockResolvedValue({ data: null, error: new Error('DB Update Failed') });

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: fetchSingleMock
        })
      });

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: updateSingleMock
          })
        })
      });

      // @ts-expect-error - Mocking
      supabase.from.mockImplementation((table) => {
        if (table === 'products') return { select: selectMock, update: updateMock };
        return {};
      });

      await expect(supabaseApi.updateProduct(productId, updateData)).rejects.toThrow('DB Update Failed');

      // CRITICAL CHECK: Event should NOT have been appended
      expect(eventStore.append).not.toHaveBeenCalled();
    });

    it('should append event AFTER successful DB update', async () => {
      setupSuccessMocks();

      await supabaseApi.updateProduct(productId, updateData);

      // Verify DB was called
      expect(supabase.from).toHaveBeenCalledWith('products');
      // Verify Event was appended
      expect(eventStore.append).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ProductUpdated',
        aggregateId: productId
      }));
    });
  });

  describe('addStockMovement', () => {
    const productId = 'prod-1';
    const quantity = 10;
    const type = 'IN';

    const setupMocks = (dbError: Error | null = null, policyError: Error | null = null) => {
      const mockMovement = { id: 'move-1', product_id: productId, quantity: 10, type: 'IN', date: '2023-01-01' };

      const singleMock = vi.fn().mockResolvedValue({ data: dbError ? null : mockMovement, error: dbError });
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: singleMock
        })
      });

      // @ts-expect-error - Mocking
      supabase.from.mockReturnValue({ insert: insertMock });

      if (policyError) {
        // @ts-expect-error - Mocking
        checkLowStockPolicy.mockRejectedValue(policyError);
      } else {
        // @ts-expect-error - Mocking
        checkLowStockPolicy.mockResolvedValue(undefined);
      }
    };

    it('should NOT append event if DB insert fails', async () => {
      setupMocks(new Error('DB Insert Failed'));

      await expect(supabaseApi.addStockMovement(productId, quantity, type)).rejects.toThrow('DB Insert Failed');

      expect(eventStore.append).not.toHaveBeenCalled();
    });

    it('should succeed even if checkLowStockPolicy throws', async () => {
      setupMocks(null, new Error('Policy Error'));

      // Should NOT throw
      const result = await supabaseApi.addStockMovement(productId, quantity, type);

      expect(result).toBeDefined();
      expect(eventStore.append).toHaveBeenCalled(); // DB succeeded, so event should fire
      expect(checkLowStockPolicy).toHaveBeenCalled(); // Policy was called
    });
  });

  describe('createProduct', () => {
    it('should NOT append event if DB insert fails', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Insert Failed') })
        })
      });
      // @ts-expect-error - Mocking
      supabase.from.mockReturnValue({ insert: insertMock });

      await expect(supabaseApi.createProduct({ Name: 'Test' })).rejects.toThrow('DB Insert Failed');

      expect(eventStore.append).not.toHaveBeenCalled();
    });
  });
});
