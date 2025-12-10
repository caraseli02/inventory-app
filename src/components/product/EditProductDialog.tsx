import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { updateProduct } from '../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '../../lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Product } from '../../types';

interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditProductDialog = ({ product, open, onOpenChange }: EditProductDialogProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Initialize form with current product values
  const [formData, setFormData] = useState({
    name: product.fields.Name,
    category: product.fields.Category || 'General',
    price: product.fields.Price?.toString() || '',
    expiryDate: product.fields['Expiry Date'] || '',
    imageUrl: product.fields.Image?.[0]?.url || '',
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const parsedPrice = data.price.trim() ? parseFloat(data.price) : undefined;
      const safePrice = Number.isFinite(parsedPrice) ? parsedPrice : undefined;

      return await updateProduct(product.id, {
        Name: data.name,
        Category: data.category,
        Price: safePrice,
        'Expiry Date': data.expiryDate || undefined,
        Image: data.imageUrl || undefined,
      });
    },
    onSuccess: (updatedProduct) => {
      // Invalidate queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['product', product.fields.Barcode] });
      queryClient.invalidateQueries({ queryKey: ['products'] });

      toast.success(t('toast.productUpdated'), {
        description: t('toast.productUpdatedMessage', { name: updatedProduct.fields.Name }),
      });

      onOpenChange(false);
    },
    onError: (error) => {
      logger.error('Product update mutation failed', {
        productId: product.id,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      toast.error(t('toast.updateFailed'), {
        description: error instanceof Error ? error.message : t('errors.unknownError'),
      });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!fixed !inset-0 !left-0 !top-0 !right-0 !bottom-0 w-full h-full !max-w-full !max-h-full !translate-x-0 !translate-y-0 p-0 gap-0 !rounded-none relative sm:!inset-0 sm:!left-0 sm:!top-0 sm:!translate-x-0 sm:!translate-y-0 sm:!max-w-full sm:!rounded-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Loading Overlay */}
        {mutation.isPending && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-stone-200 border-t-[var(--color-forest)] rounded-full animate-spin"></div>
              <p className="text-stone-900 font-semibold text-lg">{t('product.saveChanges')}...</p>
            </div>
          </div>
        )}

        <div className="h-full flex flex-col overflow-hidden">
          <DialogHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200 px-6 py-6 flex-shrink-0">
            <DialogTitle className="text-2xl font-bold text-stone-900">{t('dialogs.editProduct.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6">

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto" id="edit-product-form">
          {formData.imageUrl && (
            <div className="flex flex-col items-center gap-2 pb-4 border-b border-stone-200">
              <div className="w-40 h-40 rounded-2xl overflow-hidden border-2 border-stone-300 bg-gradient-to-br from-stone-50 to-stone-100 relative shadow-md">
                <img
                  src={formData.imageUrl}
                  alt={t('product.preview')}
                  className="w-full h-full object-contain p-2"
                  onError={(e) => {
                    const img = e.target;
                    if (img instanceof HTMLImageElement) {
                      img.style.display = 'none';
                    }
                  }}
                />
              </div>
              <span className="text-xs text-stone-500 font-medium">{t('product.preview')}</span>
            </div>
          )}

          {/* Product Identification Section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="barcode" className="text-stone-700 font-semibold text-sm">{t('product.barcode')}</Label>
              <Input
                id="barcode"
                type="text"
                value={product.fields.Barcode}
                disabled
                className="mt-2 bg-stone-50 border-2 border-stone-300 text-stone-600 cursor-not-allowed"
              />
              <p className="text-xs text-stone-500 mt-1.5">{t('product.barcodeCannotChange')}</p>
            </div>

            <div>
              <Label htmlFor="name" className="text-stone-700 font-semibold text-sm">
                {t('product.name')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder={t('product.namePlaceholder')}
                className="mt-2 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]"
              />
            </div>
          </div>

          {/* Product Details Section */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category" className="text-stone-700 font-semibold text-sm">{t('product.category')}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="mt-2 border-2 border-stone-300 focus:ring-[var(--color-lavender)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">{t('categories.General')}</SelectItem>
                    <SelectItem value="Produce">{t('categories.Produce')}</SelectItem>
                    <SelectItem value="Dairy">{t('categories.Dairy')}</SelectItem>
                    <SelectItem value="Meat">{t('categories.Meat')}</SelectItem>
                    <SelectItem value="Pantry">{t('categories.Pantry')}</SelectItem>
                    <SelectItem value="Snacks">{t('categories.Snacks')}</SelectItem>
                    <SelectItem value="Beverages">{t('categories.Beverages')}</SelectItem>
                    <SelectItem value="Household">{t('categories.Household')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="price" className="text-stone-700 font-semibold text-sm">{t('product.price')}</Label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 font-semibold">€</span>
                  <Input
                    id="price"
                    type="number"
                    name="price"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="pl-8 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Details Section */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
            <div>
              <Label htmlFor="expiryDate" className="text-stone-700 font-semibold text-sm">{t('product.expiryDate')}</Label>
              <Input
                id="expiryDate"
                type="date"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                className="mt-2 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]"
              />
            </div>

            <div>
              <Label htmlFor="imageUrl" className="text-stone-700 font-semibold text-sm">{t('product.imageUrl')}</Label>
              <Input
                id="imageUrl"
                type="url"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                placeholder={t('product.imageUrlPlaceholder')}
                className="mt-2 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]"
              />
            </div>
          </div>
        </form>

        {mutation.isError && (
          <div className="mt-6 text-red-700 text-sm bg-red-50 p-4 rounded-lg border-2 border-red-200 font-medium flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <span>{mutation.error instanceof Error ? mutation.error.message : t('product.updateFailed')}</span>
          </div>
        )}
          </div>

          <DialogFooter className="bg-gradient-to-br from-stone-50 to-stone-100/50 p-6 border-t-2 border-stone-200 flex gap-3 flex-shrink-0">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="flex-1 border-2 border-stone-300 hover:bg-stone-100 font-semibold h-12"
              disabled={mutation.isPending}
            >
              {t('product.cancel')}
            </Button>
            <Button
              type="submit"
              form="edit-product-form"
              disabled={mutation.isPending}
              className="flex-1 font-bold bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] hover:opacity-90 text-white h-12 shadow-md"
            >
              {mutation.isPending ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                t('product.saveChanges')
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;
