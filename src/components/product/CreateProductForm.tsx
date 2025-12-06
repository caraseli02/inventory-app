import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { createProduct, addStockMovement } from '../../lib/api';
import { suggestProductDetails } from '../../lib/ai';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '../../lib/logger';

interface CreateProductFormProps {
  barcode: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CreateProductForm = ({ barcode, onSuccess, onCancel }: CreateProductFormProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    category: 'General',
    price: '',
    expiryDate: '',
    initialStock: '1',
    imageUrl: '', // New state for image
  });

  const [aiLoading, setAiLoading] = useState(false);

  // Auto-fill on mount
  useEffect(() => {
    const autoFill = async () => {
      setAiLoading(true);
      try {
        const suggestion = await suggestProductDetails(barcode);
        if (suggestion) {
          setFormData(prev => ({
            ...prev,
            name: suggestion.name || prev.name,
            category: suggestion.category || prev.category,
            imageUrl: suggestion.imageUrl || prev.imageUrl,
          }));
        }
      } catch (err) {
        logger.warn('AI auto-fill failed during product creation', {
          barcode,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorType: err instanceof Error ? err.constructor.name : typeof err,
          timestamp: new Date().toISOString(),
        });
        // AI failure is non-critical - user can manually enter product details
      } finally {
        setAiLoading(false);
      }
    };
    autoFill();
  }, [barcode]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const parsedPrice = data.price.trim() ? parseFloat(data.price) : undefined;
      const safePrice = Number.isFinite(parsedPrice) ? parsedPrice : undefined;

      // Step 1: Create Product
      const newProduct = await createProduct({
        Name: data.name,
        Barcode: barcode,
        Category: data.category,
        Price: safePrice,
        'Expiry Date': data.expiryDate || undefined,
        Image: data.imageUrl || undefined,
      });

      // Step 2: Add Initial Stock (if > 0)
      const initialQty = parseInt(data.initialStock);
      if (initialQty > 0) {
        try {
          await addStockMovement(newProduct.id, initialQty, 'IN');
        } catch (stockError) {
          logger.error('Failed to create initial stock movement after product creation', {
            productId: newProduct.id,
            productName: newProduct.fields.Name,
            initialQty,
            barcode,
            errorMessage: stockError instanceof Error ? stockError.message : String(stockError),
            errorStack: stockError instanceof Error ? stockError.stack : undefined,
            timestamp: new Date().toISOString(),
          });
          throw new Error(
            `Product created (${newProduct.fields.Name}) but initial stock failed. Please add stock manually or contact support.`
          );
        }
      }

      return newProduct;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['product', barcode] });
      onSuccess();
    },
    onError: (error) => {
      logger.error('Product creation mutation failed', {
        barcode,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-lg p-6 border-2 border-gray-200 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">New Product</h2>
        {aiLoading && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border-2 border-amber-200">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
            Searching...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Image Preview */}
        {formData.imageUrl && (
          <div className="flex justify-center mb-4">
            <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100 relative">
              <img
                src={formData.imageUrl}
                alt="Product Preview"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute bottom-0 w-full bg-gray-900/60 text-white text-[10px] text-center py-1">
                Preview
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-gray-700 text-sm font-medium mb-1.5">Barcode</label>
          <input
            type="text"
            value={barcode}
            disabled
            className="w-full bg-gray-50 border-2 border-gray-300 rounded-lg p-3 text-gray-600 cursor-not-allowed text-sm"
          />
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-medium mb-1.5">Product Name</label>
          <div className="relative">
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Organic Bananas"
              className="w-full bg-white border-2 border-gray-300 rounded-lg p-3 text-gray-900 focus:border-gray-400 focus:ring-1 focus:ring-gray-900/20 outline-none transition-all pr-10 text-sm"
            />
            {!aiLoading && !formData.name && (
              <button
                type="button"
                onClick={() => {/* Trigger manual re-fetch if needed */ }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Auto-fill"
              >
                ✨
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1.5">Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full bg-white border-2 border-gray-300 rounded-lg p-3 text-gray-900 focus:border-gray-400 focus:ring-1 focus:ring-gray-900/20 outline-none text-sm"
            >
              <option value="General">General</option>
              <option value="Produce">Produce</option>
              <option value="Dairy">Dairy</option>
              <option value="Meat">Meat</option>
              <option value="Pantry">Pantry</option>
              <option value="Snacks">Snacks</option>
              <option value="Beverages">Beverages</option>
              <option value="Household">Household</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1.5">Price</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500 text-sm">$</span>
              <input
                type="number"
                name="price"
                step="0.01"
                value={formData.price}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full bg-white border-2 border-gray-300 rounded-lg p-3 pl-7 text-gray-900 focus:border-gray-400 focus:ring-1 focus:ring-gray-900/20 outline-none text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1.5">Initial Stock</label>
            <input
              type="number"
              name="initialStock"
              value={formData.initialStock}
              onChange={handleChange}
              className="w-full bg-white border-2 border-gray-300 rounded-lg p-3 text-gray-900 focus:border-gray-400 focus:ring-1 focus:ring-gray-900/20 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1.5">Expiry Date</label>
            <input
              type="date"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
              className="w-full bg-white border-2 border-gray-300 rounded-lg p-3 text-gray-900 focus:border-gray-400 focus:ring-1 focus:ring-gray-900/20 outline-none text-sm"
            />
          </div>
        </div>

        {/* Hidden Input for Image URL (Optional: or let user see/edit it) */}
        <input type="hidden" name="imageUrl" value={formData.imageUrl} />

        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors flex justify-center items-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              'Create & Stock'
            )}
          </button>
        </div>

        {mutation.isError && (
          <div className="text-red-700 text-sm text-center bg-red-50 p-3 rounded-lg border-2 border-red-200">
            {mutation.error.message || 'Failed to create product.'}
          </div>
        )}
      </form>
    </div>
  );
};

export default CreateProductForm;
