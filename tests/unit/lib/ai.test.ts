/**
 * Unit Tests: AI Product Suggestions
 *
 * Tests for the OpenFoodFacts integration and category mapping.
 * Uses mocking to avoid actual API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOFFResponse, createEmptyOFFResponse } from '@/test/factories'

// Mock the openFoodFacts module
vi.mock('@/lib/ai/openFoodFacts', () => ({
  fetchFromOFF: vi.fn(),
}))

describe('AI Product Suggestions', () => {
  let mockFetchFromOFF: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    const offModule = await import('@/lib/ai/openFoodFacts')
    mockFetchFromOFF = offModule.fetchFromOFF as ReturnType<typeof vi.fn>
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('suggestProductDetails', () => {
    it('should return product details when found in OpenFoodFacts', async () => {
      mockFetchFromOFF.mockResolvedValue(createOFFResponse())

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Test OFF Product')
      expect(result?.source).toBe('OpenFoodFacts')
    })

    it('should return null when product not found', async () => {
      mockFetchFromOFF.mockResolvedValue(createEmptyOFFResponse())

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('0000000000000')

      expect(result).toBeNull()
    })

    it('should include image URL when available', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          image_url: 'https://images.openfoodfacts.org/products/123.jpg',
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.imageUrl).toBe(
        'https://images.openfoodfacts.org/products/123.jpg'
      )
    })

    it('should return null when API returns status 0', async () => {
      mockFetchFromOFF.mockResolvedValue({
        status: 0,
        product: { product_name: 'Should not be returned' },
      })

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result).toBeNull()
    })

    it('should return null when product object is null', async () => {
      mockFetchFromOFF.mockResolvedValue({
        status: 1,
        product: null,
      })

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result).toBeNull()
    })
  })

  describe('Category Mapping', () => {
    it('should map beverages category correctly', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:beverages', 'en:carbonated-drinks'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Beverages')
    })

    it('should map snacks category correctly', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:snacks', 'en:chips'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Snacks')
    })

    it('should map meat category correctly', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:meats', 'en:beef'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Meat')
    })

    it('should map dairy category correctly', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:dairies', 'en:milk'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Dairy')
    })

    it('should map produce category correctly', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:produce', 'en:vegetables'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Produce')
    })

    it('should map household category correctly', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:household-supplies', 'en:cleaning'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Household')
    })

    it('should default to General for unknown categories', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:unknown-category', 'en:mysterious-item'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('General')
    })

    it('should default to General when no categories provided', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: [],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('General')
    })

    it('should handle partial match for snack', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:salty-snacks-and-crackers'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Snacks')
    })

    it('should handle partial match for drink/beverage', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:soft-drinks'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Beverages')
    })

    it('should handle partial match for cheese (dairy)', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:cheese-products'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Dairy')
    })

    it('should handle partial match for fruit/vegetable (produce)', async () => {
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:fresh-fruits'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Produce')
    })

    it('should prioritize exact matches over partial matches', async () => {
      // en:beverages should match before partial 'snack' check
      mockFetchFromOFF.mockResolvedValue(
        createOFFResponse({
          categories_tags: ['en:beverages', 'en:snack-beverages'],
        })
      )

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result?.category).toBe('Beverages')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetchFromOFF.mockRejectedValue(new Error('Network error'))

      const { suggestProductDetails } = await import('@/lib/ai')

      await expect(suggestProductDetails('1234567890123')).rejects.toThrow(
        'Network error'
      )
    })

    it('should handle null API response', async () => {
      mockFetchFromOFF.mockResolvedValue(null)

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result).toBeNull()
    })

    it('should handle undefined API response', async () => {
      mockFetchFromOFF.mockResolvedValue(undefined)

      const { suggestProductDetails } = await import('@/lib/ai')
      const result = await suggestProductDetails('1234567890123')

      expect(result).toBeNull()
    })
  })
})
