import { useState } from 'react';
import { addStockMovement, getStockMovements } from '../../lib/api';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import type { Product } from '../../types';
import { logger } from '../../lib/logger';

interface ProductDetailProps {
  product: Product;
  onScanNew: () => void;
  mode: 'add' | 'remove';
}

const ProductDetail = ({ product, onScanNew, mode }: ProductDetailProps) => {
  const queryClient = useQueryClient();
  const [loadingAction, setLoadingAction] = useState<'IN' | 'OUT' | null>(null);

  const [stockQuantity, setStockQuantity] = useState<string>('1');
  const SAFE_STOCK_THRESHOLD = 50;

  const displayCategory = product.fields.Category || 'Uncategorized';
  const displayPrice =
    product.fields.Price != null ? `$${product.fields.Price.toFixed(2)}` : 'N/A';
  const expiryDisplay = product.fields['Expiry Date'] || 'No expiry date';

  const stockMutation = useMutation({
    mutationFn: async ({ quantity, type }: { quantity: number; type: 'IN' | 'OUT' }) => {
      logger.info('Initiating stock mutation', { productId: product.id, quantity, type });
      return addStockMovement(product.id, quantity, type);
    },
    onMutate: async ({ type, quantity }) => {
      setLoadingAction(type);
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['product', product.fields.Barcode] });

      // Snapshot previous value
      const previousProduct = queryClient.getQueryData(['product', product.fields.Barcode]);

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
    onError: (err, _newTodo, context: unknown) => {
      logger.error('Stock mutation failed', { error: err, productId: product.id });
      alert(`Failed to update stock: ${err.message || 'Unknown error'}`);
      // Rollback
      if ((context as { previousProduct: Product | undefined })?.previousProduct) {
        queryClient.setQueryData(['product', product.fields.Barcode], (context as { previousProduct: Product | undefined }).previousProduct);
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
      alert("Please enter a valid positive quantity.");
      return;
    }

    if (qty > SAFE_STOCK_THRESHOLD) {
      const confirmed = window.confirm(
        `⚠️ Large Stock Update Warning ⚠️\n\nYou are about to ${type === 'IN' ? 'add' : 'remove'} ${qty} items.\n\nIs this correct?`
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
    <div className="w-full max-w-lg mx-auto bg-white rounded-lg overflow-hidden border border-gray-200 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-3xl overflow-hidden flex-shrink-0">
                {product.fields.Image && product.fields.Image.length > 0 ? (
                  <img
                    src={product.fields.Image[0].url}
                    alt={product.fields.Name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : (
                  <span>🍔</span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 leading-tight">{product.fields.Name}</h2>
                <span className="text-sm text-gray-500">{displayCategory}</span>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-light text-gray-900">
              {product.fields['Current Stock'] ?? 0}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-widest font-medium">Stock</div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">Price</div>
            <div className="text-gray-900 font-medium">{displayPrice}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">Expiry</div>
            <div className="text-gray-900 font-medium text-sm">{expiryDisplay}</div>
          </div>
        </div>

        <div className="flex gap-3 mb-8">
          {mode === 'remove' && (
            <button
              onClick={() => handleStockChange('OUT')}
              disabled={loadingAction !== null}
              className="flex-1 py-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-semibold transition-colors active:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingAction === 'OUT' ? <span className="animate-spin h-4 w-4 border-2 border-red-700 border-t-transparent rounded-full"></span> : <span className="text-lg">−</span>}
              <span className="hidden sm:inline text-sm">Remove</span>
            </button>
          )}

          <div className="w-20">
            <input
              type="number"
              min="1"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className="w-full h-14 bg-gray-50 border border-gray-300 rounded-lg text-center text-gray-900 font-semibold text-lg focus:border-gray-400 focus:ring-1 focus:ring-gray-900/20 outline-none"
            />
          </div>

          {mode === 'add' && (
            <button
              onClick={() => handleStockChange('IN')}
              disabled={loadingAction !== null}
              className="flex-1 py-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-semibold transition-colors active:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingAction === 'IN' ? <span className="animate-spin h-4 w-4 border-2 border-emerald-700 border-t-transparent rounded-full"></span> : <span className="text-lg">+</span>}
              <span className="hidden sm:inline text-sm">Add</span>
            </button>
          )}
        </div>

        {/* Recent Activity Section */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Recent Activity</h3>
          <div className="space-y-2">
            {history?.map((move) => (
              <div key={move.id} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${move.fields.Type === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  <span className="text-gray-600">{move.fields.Date}</span>
                </div>
                <div className={`font-mono font-semibold ${move.fields.Type === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {move.fields.Type === 'IN' ? '+' : '-'}{Math.abs(move.fields.Quantity)}
                </div>
              </div>
            ))}
            {!history?.length && <div className="text-gray-500 text-sm text-center italic py-2">No recent movements</div>}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-center">
        <button onClick={onScanNew} className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors">
          ← Scan Another Product
        </button>
      </div>
    </div>
  );
};

export default ProductDetail;
