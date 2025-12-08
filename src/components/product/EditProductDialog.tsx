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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-stone-900">{t('dialogs.editProduct.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5" id="edit-product-form">
          {formData.imageUrl && (
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-stone-300 bg-stone-100 relative shadow-sm">
                <img
                  src={formData.imageUrl}
                  alt={t('product.preview')}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const img = e.target;
                    if (img instanceof HTMLImageElement) {
                      img.style.display = 'none';
                    }
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="barcode" className="text-stone-700 font-semibold">{t('product.barcode')}</Label>
            <Input
              id="barcode"
              type="text"
              value={product.fields.Barcode}
              disabled
              className="mt-1.5 bg-stone-50 border-2 border-stone-300 text-stone-600 cursor-not-allowed"
            />
            <p className="text-xs text-stone-500 mt-1">{t('product.barcodeCannotChange')}</p>
          </div>

          <div>
            <Label htmlFor="name" className="text-stone-700 font-semibold">{t('product.name')}</Label>
            <Input
              id="name"
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder={t('product.namePlaceholder')}
              className="mt-1.5 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category" className="text-stone-700 font-semibold">{t('product.category')}</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="mt-1.5 border-2 border-stone-300 focus:ring-[var(--color-lavender)]">
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
              <Label htmlFor="price" className="text-stone-700 font-semibold">{t('product.price')}</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-3 text-stone-500 font-medium">€</span>
                <Input
                  id="price"
                  type="number"
                  name="price"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder={t('product.pricePlaceholder')}
                  className="pl-7 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)]"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="expiryDate" className="text-stone-700 font-semibold">{t('product.expiryDate')}</Label>
            <Input
              id="expiryDate"
              type="date"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
              className="mt-1.5 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)]"
            />
          </div>

          <div>
            <Label htmlFor="imageUrl" className="text-stone-700 font-semibold">{t('product.imageUrl')}</Label>
            <Input
              id="imageUrl"
              type="url"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder={t('product.imageUrlPlaceholder')}
              className="mt-1.5 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)]"
            />
          </div>
        </form>

        {mutation.isError && (
          <div className="text-red-700 text-sm text-center bg-red-50 p-3 rounded-lg border-2 border-red-200 font-medium">
            {mutation.error instanceof Error ? mutation.error.message : t('product.updateFailed')}
          </div>
        )}

        <DialogFooter className="gap-3">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="border-2 border-stone-300 hover:bg-stone-100"
            disabled={mutation.isPending}
          >
            {t('product.cancel')}
          </Button>
          <Button
            type="submit"
            form="edit-product-form"
            disabled={mutation.isPending}
            className="font-bold bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] hover:opacity-90 text-white"
          >
            {mutation.isPending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              t('product.saveChanges')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;
