/**
 * Unit Tests: useLowStockAlerts Hook
 *
 * Tests the low stock detection and alert logic.
 * Uses mock data to verify the hook's calculation logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TestWrapper, createTestQueryClient } from '@/test/test-utils'
import { createProduct, createLowStockProduct } from '@/test/factories'

// Mock the API provider
vi.mock('@/lib/api-provider', () => ({
  getAllProducts: vi.fn(),
}))

// Import after mocking
import { getAllProducts } from '@/lib/api-provider'
import { useLowStockAlerts } from '@/hooks/useLowStockAlerts'

const mockGetAllProducts = getAllProducts as ReturnType<typeof vi.fn>

describe('useLowStockAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Low Stock Detection', () => {
    it('should identify products below minimum stock', async () => {
      const lowProduct = createProduct({
        fields: {
          Name: 'Low Stock Item',
          'Current Stock Level': 3,
          'Min Stock Level': 10,
        },
      })
      mockGetAllProducts.mockResolvedValue([lowProduct])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lowStockProducts).toHaveLength(1)
      expect(result.current.hasAlerts).toBe(true)
      expect(result.current.lowStockCount).toBe(1)
    })

    it('should exclude products at or above minimum stock', async () => {
      const normalProduct = createProduct({
        fields: {
          Name: 'Normal Stock',
          'Current Stock Level': 15,
          'Min Stock Level': 10,
        },
      })
      const exactProduct = createProduct({
        fields: {
          Name: 'Exact Stock',
          'Current Stock Level': 10,
          'Min Stock Level': 10,
        },
      })
      mockGetAllProducts.mockResolvedValue([normalProduct, exactProduct])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lowStockProducts).toHaveLength(0)
      expect(result.current.hasAlerts).toBe(false)
    })

    it('should exclude products without minimum stock defined', async () => {
      const noMinStock = createProduct({
        fields: {
          Name: 'No Min Stock',
          'Current Stock Level': 2,
          'Min Stock Level': undefined,
        },
      })
      mockGetAllProducts.mockResolvedValue([noMinStock])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lowStockProducts).toHaveLength(0)
    })

    it('should exclude products with zero minimum stock', async () => {
      const zeroMinStock = createProduct({
        fields: {
          Name: 'Zero Min Stock',
          'Current Stock Level': 0,
          'Min Stock Level': 0,
        },
      })
      mockGetAllProducts.mockResolvedValue([zeroMinStock])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lowStockProducts).toHaveLength(0)
    })
  })

  describe('Stock Deficit Calculation', () => {
    it('should calculate correct stock deficit', async () => {
      const lowProduct = createProduct({
        fields: {
          Name: 'Low Product',
          'Current Stock Level': 3,
          'Min Stock Level': 10,
        },
      })
      mockGetAllProducts.mockResolvedValue([lowProduct])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lowStockProducts[0].stockDeficit).toBe(7)
    })

    it('should handle zero current stock', async () => {
      const outOfStock = createProduct({
        fields: {
          Name: 'Out of Stock',
          'Current Stock Level': 0,
          'Min Stock Level': 5,
        },
      })
      mockGetAllProducts.mockResolvedValue([outOfStock])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lowStockProducts[0].stockDeficit).toBe(5)
    })

    it('should handle negative current stock', async () => {
      const negativeStock = createProduct({
        fields: {
          Name: 'Negative Stock',
          'Current Stock Level': -5,
          'Min Stock Level': 10,
        },
      })
      mockGetAllProducts.mockResolvedValue([negativeStock])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Deficit should be 10 - (-5) = 15
      expect(result.current.lowStockProducts[0].stockDeficit).toBe(15)
    })
  })

  describe('Sorting', () => {
    it('should sort by deficit descending (highest first)', async () => {
      const products = [
        createProduct({
          id: 'low',
          fields: {
            Name: 'Small Deficit',
            'Current Stock Level': 8,
            'Min Stock Level': 10,
          },
        }),
        createProduct({
          id: 'critical',
          fields: {
            Name: 'Large Deficit',
            'Current Stock Level': 0,
            'Min Stock Level': 20,
          },
        }),
        createProduct({
          id: 'medium',
          fields: {
            Name: 'Medium Deficit',
            'Current Stock Level': 5,
            'Min Stock Level': 15,
          },
        }),
      ]
      mockGetAllProducts.mockResolvedValue(products)

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should be sorted: 20 deficit, 10 deficit, 2 deficit
      expect(result.current.lowStockProducts[0].stockDeficit).toBe(20)
      expect(result.current.lowStockProducts[1].stockDeficit).toBe(10)
      expect(result.current.lowStockProducts[2].stockDeficit).toBe(2)
    })
  })

  describe('Loading and Error States', () => {
    it('should show loading state initially', async () => {
      mockGetAllProducts.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.lowStockProducts).toEqual([])
    })

    it('should handle API errors', async () => {
      mockGetAllProducts.mockRejectedValue(new Error('API Error'))

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.lowStockProducts).toEqual([])
    })

    it('should handle empty product list', async () => {
      mockGetAllProducts.mockResolvedValue([])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lowStockProducts).toEqual([])
      expect(result.current.hasAlerts).toBe(false)
    })
  })

  describe('Data Validation', () => {
    it('should handle invalid stock values gracefully', async () => {
      // Product with non-number stock values
      const invalidProduct = createProduct({
        fields: {
          Name: 'Invalid Data',
          'Current Stock Level': 'invalid' as unknown as number,
          'Min Stock Level': 10,
        },
      })
      mockGetAllProducts.mockResolvedValue([invalidProduct])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should treat invalid as 0, so deficit is 10
      expect(result.current.lowStockProducts).toHaveLength(1)
      expect(result.current.lowStockProducts[0].stockDeficit).toBe(10)
    })

    it('should handle undefined stock values', async () => {
      const undefinedStock = createProduct({
        fields: {
          Name: 'Undefined Stock',
          'Current Stock Level': undefined,
          'Min Stock Level': 5,
        },
      })
      mockGetAllProducts.mockResolvedValue([undefinedStock])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should treat undefined as 0, so deficit is 5
      expect(result.current.lowStockProducts).toHaveLength(1)
      expect(result.current.lowStockProducts[0].stockDeficit).toBe(5)
    })
  })

  describe('Invariants', () => {
    it('should maintain invariant: lowStockCount equals lowStockProducts.length', async () => {
      const products = [
        createLowStockProduct({ id: '1' }),
        createLowStockProduct({ id: '2' }),
        createLowStockProduct({ id: '3' }),
      ]
      mockGetAllProducts.mockResolvedValue(products)

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lowStockCount).toBe(
        result.current.lowStockProducts.length
      )
    })

    it('should maintain invariant: hasAlerts equals (lowStockProducts.length > 0)', async () => {
      mockGetAllProducts.mockResolvedValue([])

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useLowStockAlerts(), {
        wrapper: ({ children }) => (
          <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
        ),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.hasAlerts).toBe(
        result.current.lowStockProducts.length > 0
      )
    })
  })
})
