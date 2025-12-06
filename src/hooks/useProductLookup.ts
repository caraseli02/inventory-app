import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProductByBarcode } from '../lib/api';
import { logger } from '../lib/logger';

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

  // Log errors separately since onError callback isn't available
  useEffect(() => {
    if (query.error) {
      logger.error('Product lookup failed', {
        barcode,
        errorMessage: query.error instanceof Error ? query.error.message : String(query.error),
        errorType: query.error instanceof Error ? query.error.constructor.name : typeof query.error,
      });
    }
  }, [query.error, barcode]);

  return query;
};
