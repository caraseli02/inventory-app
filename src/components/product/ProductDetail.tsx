import { useState } from 'react';
import { addStockMovement, getStockMovements } from '../../lib/api';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast';
import type { Product } from '../../types';
import { logger } from '../../lib/logger';
import { BoxIcon, MinusIcon, PlusIcon } from '../ui/Icons';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface ProductDetailProps {
  product: Product;
  onScanNew: () => void;
  mode: 'add' | 'remove';
}

type StockMutationContext = {
  previousProduct: Product | undefined;
};

const ProductDetail = ({ product, onScanNew, mode }: ProductDetailProps) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [loadingAction, setLoadingAction] = useState<'IN' | 'OUT' | null>(null);

  const [stockQuantity, setStockQuantity] = useState<string>('1');
  const SAFE_STOCK_THRESHOLD = 50;

  const displayCategory = product.fields.Category || 'Uncategorized';
  const displayPrice =
    product.fields.Price != null ? `€${product.fields.Price.toFixed(2)}` : 'N/A';
  const expiryDisplay = product.fields['Expiry Date'] || 'No expiry date';

  const stockMutation = useMutation({
    mutationFn: async ({ quantity, type }: { quantity: number; type: 'IN' | 'OUT' }) => {
      logger.info('Initiating stock mutation', { productId: product.id, quantity, type });
      return addStockMovement(product.id, quantity, type);
    },
    onMutate: async ({ type, quantity }): Promise<StockMutationContext> => {
      setLoadingAction(type);
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['product', product.fields.Barcode] });

      // Snapshot previous value
      const previousProduct = queryClient.getQueryData<Product>(['product', product.fields.Barcode]);

      // Optimistically update
      queryClient.setQueryData(['product', product.fields.Barcode], (old: Product | undefined) => {
        if (!old) return old;
        const change = type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity);
        return {
          ...old,
          fields: {
            ...old.fields,
            'Current Stock': (old.fields?.['Current Stock'] ?? 0) + change,
          },
        };
      });

      return { previousProduct };
    },
    onSuccess: (_data, { type, quantity }) => {
      const action = type === 'IN' ? 'added to' : 'removed from';
      showToast(
        'success',
        'Stock updated',
        `${quantity} item${quantity > 1 ? 's' : ''} ${action} inventory`,
        3000
      );
    },
    onError: (err, _variables, context: StockMutationContext | undefined) => {
      logger.error('Stock mutation failed', { error: err, productId: product.id });
      showToast(
        'error',
        'Failed to update stock',
        err.message || 'Unknown error occurred. Please try again.',
        4000
      );
      // Rollback
      if (context?.previousProduct) {
        queryClient.setQueryData(['product', product.fields.Barcode], context.previousProduct);
      }
    },
    onSettled: () => {
      setLoadingAction(null);
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['product', product.fields.Barcode] });
      // Also refetch history
      queryClient.invalidateQueries({ queryKey: ['history', product.id] });
    },
  });

  const handleStockChange = (type: 'IN' | 'OUT') => {
    const qty = parseInt(stockQuantity);
    if (isNaN(qty) || qty <= 0) {
      logger.warn('Invalid stock quantity entered', { quantity: stockQuantity });
      showToast('warning', 'Invalid quantity', 'Please enter a valid positive quantity', 3000);
      return;
    }

    if (qty > SAFE_STOCK_THRESHOLD) {
      const confirmed = window.confirm(
        `Large Stock Update Warning\n\nYou are about to ${type === 'IN' ? 'add' : 'remove'} ${qty} items.\n\nIs this correct?`
      );
      if (!confirmed) {
        logger.info('Large stock update cancelled by user', { quantity: qty });
        return;
      }
    }

    stockMutation.mutate({ quantity: qty, type });
  };

  // Fetch History
  const { data: history } = useQuery({
    queryKey: ['history', product.id],
    queryFn: () => getStockMovements(product.id),
    enabled: !!product.id,
  });

  return (
    <Card className="w-full max-w-lg mx-auto animate-in fade-in duration-500 shadow-lg border-stone-200">
      <CardHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-stone-200 shadow-sm">
                {product.fields.Image && product.fields.Image.length > 0 ? (
                  <img
                    src={product.fields.Image[0].url}
                    alt={product.fields.Name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target;
                      if (img instanceof HTMLImageElement) {
                        img.style.display = 'none';
                        img.nextElementSibling?.classList.remove('hidden');
                      }
                    }}
                  />
                ) : (
                  <BoxIcon className="h-8 w-8 text-stone-400" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-stone-900 leading-tight mb-1">{product.fields.Name}</h2>
                <Badge variant="secondary" className="bg-stone-100 text-stone-700 border-stone-300">
                  {displayCategory}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-light text-stone-900">
              {product.fields['Current Stock'] ?? 0}
            </div>
            <div className="text-xs text-stone-500 uppercase tracking-widest font-semibold mt-1">In Stock</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 py-6 max-h-[calc(100dvh-240px)] md:max-h-none overflow-y-auto">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-stone-50 to-white border-2 border-stone-200">
            <CardContent className="p-4">
              <div className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-2">Price</div>
              <div className="text-stone-900 font-semibold text-lg">{displayPrice}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-stone-50 to-white border-2 border-stone-200">
            <CardContent className="p-4">
              <div className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-2">Expiry</div>
              <div className="text-stone-900 font-semibold text-sm">{expiryDisplay}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3 mb-6">
          {mode === 'remove' && (
            <Button
              onClick={() => handleStockChange('OUT')}
              disabled={loadingAction !== null}
              variant="destructive"
              size="lg"
              className="flex-1"
            >
              {loadingAction === 'OUT' ? (
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
              ) : (
                <>
                  <MinusIcon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Remove</span>
                </>
              )}
            </Button>
          )}

          <div className="w-24">
            <Input
              type="number"
              min="1"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className="h-14 text-center text-lg font-bold border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)]"
            />
          </div>

          {mode === 'add' && (
            <Button
              onClick={() => handleStockChange('IN')}
              disabled={loadingAction !== null}
              size="lg"
              className="flex-1"
            >
              {loadingAction === 'IN' ? (
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Add</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* Recent Activity Section */}
        <div className="border-t-2 border-stone-200 pt-6">
          <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">Recent Activity</h3>
          <div className="space-y-2">
            {history?.map((move) => (
              <div key={move.id} className="flex justify-between items-center text-sm p-3 bg-stone-50 rounded-lg border border-stone-200">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={move.fields.Type === 'IN' ? 'default' : 'destructive'}
                    className={`w-2 h-2 p-0 rounded-full ${move.fields.Type === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`}
                  />
                  <span className="text-stone-600 font-medium">{move.fields.Date}</span>
                </div>
                <div className={`font-mono font-bold ${move.fields.Type === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {move.fields.Type === 'IN' ? '+' : '-'}{Math.abs(move.fields.Quantity)}
                </div>
              </div>
            ))}
            {!history?.length && (
              <div className="text-stone-500 text-sm text-center italic py-4">No recent movements</div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-gradient-to-br from-stone-50 to-stone-100/50 p-4 border-t-2 border-stone-200">
        <Button
          onClick={onScanNew}
          className="w-full h-12 bg-stone-900 hover:bg-stone-800 text-white font-semibold"
        >
          Scan Another Product
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductDetail;
