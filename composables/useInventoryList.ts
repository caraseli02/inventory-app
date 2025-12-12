import { computed, reactive } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getAllProducts } from '@/lib/api'

export type SortField = 'name' | 'stock' | 'price' | 'category'
export type SortDirection = 'asc' | 'desc'

export interface InventoryFilters {
  searchQuery: string
  category: string
  lowStockOnly: boolean
  sortField: SortField
  sortDirection: SortDirection
}

export const useInventoryList = () => {
  const filters = reactive<InventoryFilters>({
    searchQuery: '',
    category: '',
    lowStockOnly: false,
    sortField: 'name',
    sortDirection: 'asc',
  })

  const query = useQuery({
    queryKey: ['products', 'all'],
    queryFn: getAllProducts,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  })

  const filteredAndSortedProducts = computed(() => {
    const data = query.data.value
    if (!data) return []

    let result = [...data]

    if (filters.searchQuery.trim()) {
      const searchLower = filters.searchQuery.toLowerCase().trim()
      result = result.filter(
        (product) =>
          product.fields.Name.toLowerCase().includes(searchLower) ||
          (product.fields.Barcode?.toLowerCase().includes(searchLower) ?? false)
      )
    }

    if (filters.category) {
      result = result.filter((product) => product.fields.Category === filters.category)
    }

    if (filters.lowStockOnly) {
      result = result.filter((product) => {
        const stockValue = product.fields['Current Stock Level']
        const minValue = product.fields['Min Stock Level']

        const currentStock = typeof stockValue === 'number' && Number.isFinite(stockValue) ? stockValue : 0
        const minStock = typeof minValue === 'number' && Number.isFinite(minValue) ? minValue : 0

        return currentStock < minStock && minStock > 0
      })
    }

    const withSortKeys = result.map((product) => {
      let sortKey: string | number

      switch (filters.sortField) {
        case 'name':
          sortKey = product.fields.Name.toLowerCase()
          break
        case 'stock': {
          const stock = product.fields['Current Stock Level']
          sortKey = typeof stock === 'number' && Number.isFinite(stock) ? stock : 0
          break
        }
        case 'price': {
          const price = product.fields.Price
          sortKey = typeof price === 'number' && Number.isFinite(price) ? price : 0
          break
        }
        case 'category':
          sortKey = (product.fields.Category ?? '').toLowerCase()
          break
        default:
          sortKey = ''
      }

      return { product, sortKey }
    })

    withSortKeys.sort((a, b) => {
      const aValue = a.sortKey
      const bValue = b.sortKey

      let comparison = 0
      if (aValue < bValue) comparison = -1
      if (aValue > bValue) comparison = 1

      return filters.sortDirection === 'asc' ? comparison : -comparison
    })

    return withSortKeys.map(({ product }) => product)
  })

  const categories = computed(() => {
    const data = query.data.value
    if (!data) return []
    const uniqueCategories = new Set(
      data
        .map((p) => p.fields.Category)
        .filter((cat): cat is string => cat != null && cat.trim() !== '')
    )
    return Array.from(uniqueCategories).sort()
  })

  const updateFilter = <K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]) => {
    filters[key] = value as InventoryFilters[K]
  }

  const resetFilters = () => {
    filters.searchQuery = ''
    filters.category = ''
    filters.lowStockOnly = false
    filters.sortField = 'name'
    filters.sortDirection = 'asc'
  }

  return {
    products: filteredAndSortedProducts,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    filters,
    updateFilter,
    resetFilters,
    categories,
    totalProducts: computed(() => query.data.value?.length ?? 0),
    filteredCount: computed(() => filteredAndSortedProducts.value.length),
  }
}
