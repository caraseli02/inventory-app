/**
 * Unit Tests: Filter Utilities
 *
 * Tests for inventory filter helper functions.
 */

import { describe, it, expect, vi } from 'vitest'
import { hasActiveFilters, createClearFilterHandler } from '@/lib/filters'
import type { InventoryFilters } from '@/hooks/useInventoryList'

describe('Filter Utilities', () => {
  describe('hasActiveFilters', () => {
    const defaultFilters: InventoryFilters = {
      searchQuery: '',
      category: '',
      lowStockOnly: false,
      sortField: 'name',
      sortDirection: 'asc',
    }

    it('should return false for default filter state', () => {
      expect(hasActiveFilters(defaultFilters)).toBe(false)
    })

    it('should return true when searchQuery is set', () => {
      expect(
        hasActiveFilters({
          ...defaultFilters,
          searchQuery: 'test',
        })
      ).toBe(true)
    })

    it('should return true when category is set', () => {
      expect(
        hasActiveFilters({
          ...defaultFilters,
          category: 'Beverages',
        })
      ).toBe(true)
    })

    it('should return true when lowStockOnly is true', () => {
      expect(
        hasActiveFilters({
          ...defaultFilters,
          lowStockOnly: true,
        })
      ).toBe(true)
    })

    it('should return true when sortField is not "name"', () => {
      expect(
        hasActiveFilters({
          ...defaultFilters,
          sortField: 'price',
        })
      ).toBe(true)
    })

    it('should return true when sortDirection is not "asc"', () => {
      expect(
        hasActiveFilters({
          ...defaultFilters,
          sortDirection: 'desc',
        })
      ).toBe(true)
    })

    it('should return true when multiple filters are active', () => {
      expect(
        hasActiveFilters({
          searchQuery: 'milk',
          category: 'Dairy',
          lowStockOnly: true,
          sortField: 'stock',
          sortDirection: 'desc',
        })
      ).toBe(true)
    })

    it('should handle empty strings correctly', () => {
      expect(
        hasActiveFilters({
          ...defaultFilters,
          searchQuery: '',
          category: '',
        })
      ).toBe(false)
    })

    it('should handle whitespace-only search as active', () => {
      // This tests current behavior - whitespace is truthy
      expect(
        hasActiveFilters({
          ...defaultFilters,
          searchQuery: '   ',
        })
      ).toBe(true)
    })
  })

  describe('createClearFilterHandler', () => {
    it('should clear searchQuery', () => {
      const onFilterChange = vi.fn()
      const clearFilter = createClearFilterHandler(onFilterChange)

      clearFilter('searchQuery')

      expect(onFilterChange).toHaveBeenCalledWith('searchQuery', '')
    })

    it('should clear category', () => {
      const onFilterChange = vi.fn()
      const clearFilter = createClearFilterHandler(onFilterChange)

      clearFilter('category')

      expect(onFilterChange).toHaveBeenCalledWith('category', '')
    })

    it('should clear lowStockOnly', () => {
      const onFilterChange = vi.fn()
      const clearFilter = createClearFilterHandler(onFilterChange)

      clearFilter('lowStockOnly')

      expect(onFilterChange).toHaveBeenCalledWith('lowStockOnly', false)
    })

    it('should reset sortField and sortDirection together', () => {
      const onFilterChange = vi.fn()
      const clearFilter = createClearFilterHandler(onFilterChange)

      clearFilter('sortField')

      expect(onFilterChange).toHaveBeenCalledWith('sortField', 'name')
      expect(onFilterChange).toHaveBeenCalledWith('sortDirection', 'asc')
    })

    it('should reset sortDirection by also resetting sortField', () => {
      const onFilterChange = vi.fn()
      const clearFilter = createClearFilterHandler(onFilterChange)

      clearFilter('sortDirection')

      expect(onFilterChange).toHaveBeenCalledWith('sortField', 'name')
      expect(onFilterChange).toHaveBeenCalledWith('sortDirection', 'asc')
    })

    it('should call onFilterChange exactly once for simple filters', () => {
      const onFilterChange = vi.fn()
      const clearFilter = createClearFilterHandler(onFilterChange)

      clearFilter('searchQuery')
      expect(onFilterChange).toHaveBeenCalledTimes(1)

      onFilterChange.mockClear()
      clearFilter('category')
      expect(onFilterChange).toHaveBeenCalledTimes(1)

      onFilterChange.mockClear()
      clearFilter('lowStockOnly')
      expect(onFilterChange).toHaveBeenCalledTimes(1)
    })

    it('should call onFilterChange twice for sort filters', () => {
      const onFilterChange = vi.fn()
      const clearFilter = createClearFilterHandler(onFilterChange)

      clearFilter('sortField')
      expect(onFilterChange).toHaveBeenCalledTimes(2)

      onFilterChange.mockClear()
      clearFilter('sortDirection')
      expect(onFilterChange).toHaveBeenCalledTimes(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined values in filter state', () => {
      const filters = {
        searchQuery: undefined as unknown as string,
        category: undefined as unknown as string,
        lowStockOnly: undefined as unknown as boolean,
        sortField: 'name' as const,
        sortDirection: 'asc' as const,
      }

      // Undefined is falsy, so should return false for active filters
      expect(hasActiveFilters(filters)).toBe(false)
    })

    it('should return a new function each time createClearFilterHandler is called', () => {
      const onFilterChange = vi.fn()
      const clearFilter1 = createClearFilterHandler(onFilterChange)
      const clearFilter2 = createClearFilterHandler(onFilterChange)

      expect(clearFilter1).not.toBe(clearFilter2)
    })

    it('should maintain closure over onFilterChange', () => {
      const onFilterChange1 = vi.fn()
      const onFilterChange2 = vi.fn()

      const clearFilter1 = createClearFilterHandler(onFilterChange1)
      const clearFilter2 = createClearFilterHandler(onFilterChange2)

      clearFilter1('searchQuery')
      clearFilter2('category')

      expect(onFilterChange1).toHaveBeenCalledWith('searchQuery', '')
      expect(onFilterChange1).not.toHaveBeenCalledWith('category', '')
      expect(onFilterChange2).toHaveBeenCalledWith('category', '')
      expect(onFilterChange2).not.toHaveBeenCalledWith('searchQuery', '')
    })
  })
})
