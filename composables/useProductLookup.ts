import { useQuery } from '@tanstack/vue-query'
import { getProductByBarcode } from '@/lib/api'

export const useProductLookup = (barcode: string | null) => {
  const query = useQuery({
    queryKey: ['product', barcode],
    queryFn: () => {
      if (!barcode) return null
      return getProductByBarcode(barcode)
    },
    enabled: !!barcode,
    retry: false,
    staleTime: 1000 * 60 * 5,
  })

  return query
}
