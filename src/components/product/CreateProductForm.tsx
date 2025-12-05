import { useState } from 'react';
import { createProduct, addStockMovement } from '../../lib/api';
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
    initialStock: '1', // Default to 1
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Step 1: Create Product
      const newProduct = await createProduct({
        Name: data.name,
        Barcode: barcode,
        Category: data.category,
        Price: data.price ? parseFloat(data.price) : 0,
        'Expiry Date': data.expiryDate || undefined,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 animate-in slide-in-from-bottom-5 duration-300">
      <h2 className="text-2xl font-bold text-white mb-6">Create New Product</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Organic Bananas"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
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
