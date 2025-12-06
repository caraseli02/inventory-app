import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { createProduct, addStockMovement } from '../../lib/api';
import { suggestProductDetails } from '../../lib/ai';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
        console.error("AI Auto-fill failed", err);
      } finally {
        setAiLoading(false);
      }
    };
    autoFill();
  }, [barcode]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Step 1: Create Product
      const newProduct = await createProduct({
        Name: data.name,
        Barcode: barcode,
        Category: data.category,
        Price: data.price ? parseFloat(data.price) : 0,
        'Expiry Date': data.expiryDate || undefined,
        Image: data.imageUrl || undefined,
      });

      // Step 2: Add Initial Stock (if > 0)
      const initialQty = parseInt(data.initialStock);
      if (initialQty > 0) {
        await addStockMovement(newProduct.id, initialQty, 'IN');
      }

      return newProduct;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['product', barcode] });
      onSuccess();
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
    <div className="w-full max-w-lg mx-auto bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Create New Product</h2>
        {aiLoading && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-medium border border-blue-500/20">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
            AI Fetching...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Image Preview */}
        {formData.imageUrl && (
          <div className="flex justify-center mb-4">
            <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-slate-600 bg-white relative">
              <img
                src={formData.imageUrl}
                alt="Product Preview"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] text-center py-1">
                AI Preview
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-slate-400 text-sm mb-1">Barcode</label>
          <input
            type="text"
            value={barcode}
            disabled
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-slate-300 text-sm mb-1">Product Name</label>
          <div className="relative">
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Organic Bananas"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all pr-10"
            />
            {!aiLoading && !formData.name && (
              <button
                type="button"
                onClick={() => {/* Trigger manual re-fetch if needed */ }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                title="Auto-fill"
              >
                ✨
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1">Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
            <label className="block text-slate-300 text-sm mb-1">Price</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-slate-500">$</span>
              <input
                type="number"
                name="price"
                step="0.01"
                value={formData.price}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 pl-7 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1">Initial Stock</label>
            <input
              type="number"
              name="initialStock"
              value={formData.initialStock}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1">Expiry Date (Optional)</label>
            <input
              type="date"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Hidden Input for Image URL (Optional: or let user see/edit it) */}
        <input type="hidden" name="imageUrl" value={formData.imageUrl} />

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-colors flex justify-center items-center"
          >
            {mutation.isPending ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              'Create & Stock'
            )}
          </button>
        </div>

        {mutation.isError && (
          <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">
            {mutation.error.message || 'Failed to create product.'}
          </div>
        )}
      </form>
    </div>
  );
};

export default CreateProductForm;
