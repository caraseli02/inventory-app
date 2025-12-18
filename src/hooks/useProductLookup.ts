import { useQuery } from '@tanstack/react-query';
import { getProductByBarcode } from '../lib/api-provider';

/**
 * React Query hook for looking up products by barcode
 *
 * Features:
 * - Automatic caching with 5-minute stale time
 * - Only queries when barcode is provided (enabled: !!barcode)
 * - No automatic retries (prevents retry loops on 404)
 * - Returns standard useQuery interface (data, isLoading, error, etc.)
 *
 * @param barcode - Barcode string to lookup, or null to skip query
 * @returns TanStack Query result with Product data or null
 *
 * @example
 * const { data: product, isLoading, error } = useProductLookup(scannedCode);
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage />;
 * if (product) return <ProductDetail product={product} />;
 */
export const useProductLookup = (barcode: string | null) => {
  const query = useQuery({
    queryKey: ['product', barcode],
    queryFn: () => {
      if (!barcode) return null;
      return getProductByBarcode(barcode);
    },
    enabled: !!barcode, // Only run if barcode is present
    retry: false, // Don't retry on 404s (conceptually)
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return query;
};
