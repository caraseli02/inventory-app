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
      queryClient.setQueryData(['product', product.fields.Barcode], (old: any) => {
        if (!old) return old;
        const change = type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity);
        return {
          ...old,
          fields: {
            ...old.fields,
            'Current Stock': (old.fields['Current Stock'] || 0) + change,
          },
        };
      });

      return { previousProduct };
    },
    onError: (err, _newTodo, context: any) => {
      logger.error('Stock mutation failed', { error: err, productId: product.id });
      alert(`Failed to update stock: ${err.message || 'Unknown error'}`);
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
    <div className="w-full max-w-lg mx-auto bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-slate-700 animate-in fade-in duration-500">
      {/* Header Image / Color */}
      <div className={`h-32 relative ${mode === 'add' ? 'bg-gradient-to-br from-emerald-600 to-teal-600' : 'bg-gradient-to-br from-red-600 to-orange-600'}`}>
        <div className="absolute top-4 right-4 bg-black/30 backdrop-blur px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white border border-white/20">
          {mode === 'add' ? 'Check-in Mode' : 'Check-out Mode'}
        </div>
        <div className="absolute -bottom-10 left-6 w-24 h-24 bg-slate-700 rounded-xl border-4 border-slate-800 shadow-lg flex items-center justify-center text-4xl overflow-hidden">
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
      </div>

      <div className="pt-12 pb-6 px-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">{product.fields.Name}</h2>
            <span className="text-slate-400 text-sm">{product.fields.Category}</span>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-bold text-emerald-400">
              {product.fields['Current Stock'] ?? 0}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-widest">In Stock</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
            <div className="text-xs text-slate-500 mb-1">Price</div>
            <div className="text-white font-medium">${product.fields.Price?.toFixed(2) ?? '0.00'}</div>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
            <div className="text-xs text-slate-500 mb-1">Expires</div>
            <div className="text-white font-medium">{product.fields['Expiry Date'] ?? 'N/A'}</div>
          </div>
        </div>

        <div className="flex gap-4 mb-8">
          {mode === 'remove' && (
            <button
              onClick={() => handleStockChange('OUT')}
              disabled={loadingAction !== null}
              className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-xl font-bold transition-all active:scale-95 flex flex-col items-center justify-center"
            >
              {loadingAction === 'OUT' ? <span className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full mb-1"></span> : <span className="text-2xl mb-1">-</span>}
              <span className="text-xs uppercase tracking-wider">Remove</span>
            </button>
          )}

          <div className="w-24">
            <div className="relative h-full">
              <input
                type="number"
                min="1"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full h-full bg-slate-900 border border-slate-600 rounded-xl text-center text-white font-bold text-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="absolute -bottom-5 left-0 w-full text-center text-[10px] text-slate-500 uppercase tracking-widest">Qty</span>
            </div>
          </div>

          {mode === 'add' && (
            <button
              onClick={() => handleStockChange('IN')}
              disabled={loadingAction !== null}
              className="flex-1 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/50 rounded-xl font-bold transition-all active:scale-95 flex flex-col items-center justify-center"
            >
              {loadingAction === 'IN' ? <span className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full mb-1"></span> : <span className="text-2xl mb-1">+</span>}
              <span className="text-xs uppercase tracking-wider">Add Stock</span>
            </button>
          )}
        </div>

        {/* Recent Activity Section */}
        <div className="border-t border-slate-700 pt-6">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <span>Recent Activity</span>
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">Last 10</span>
          </h3>
          <div className="space-y-3">
            {history?.map((move) => (
              <div key={move.id} className="flex justify-between items-center text-sm p-3 bg-slate-900/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${move.fields.Type === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  <span className="text-slate-300">{move.fields.Date}</span>
                </div>
                <div className={`font-mono font-bold ${move.fields.Type === 'IN' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {move.fields.Type === 'IN' ? '+' : '-'}{Math.abs(move.fields.Quantity)}
                </div>
              </div>
            ))}
            {!history?.length && <div className="text-slate-500 text-sm text-center italic">No recent movements</div>}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 p-4 border-t border-slate-700 flex justify-center">
        <button onClick={onScanNew} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
          Scan Another Product
        </button>
      </div>
    </div>
  );
};

export default ProductDetail;
