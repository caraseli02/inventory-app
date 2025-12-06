import { useQuery } from '@tanstack/react-query';
import { getProductByBarcode } from '../lib/api';

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
