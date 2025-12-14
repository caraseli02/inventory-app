import { useState, useEffect, useRef, useId, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createProduct, addStockMovement } from '../../lib/api';
import { suggestProductDetails } from '../../lib/ai';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '../../lib/logger';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';

interface CreateProductFormProps {
  barcode: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CreateProductForm = ({ barcode, onSuccess, onCancel }: CreateProductFormProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'General',
    price: '',
    expiryDate: '',
    initialStock: '1',
    imageUrl: '',
  });
  const [nameError, setNameError] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);

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

      const newProduct = await createProduct({
        Name: data.name,
        Barcode: barcode,
        Category: data.category,
        Price: safePrice,
        'Expiry Date': data.expiryDate || undefined,
        Image: data.imageUrl || undefined,
      });

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
    onSuccess: (newProduct) => {
      queryClient.invalidateQueries({ queryKey: ['product', barcode] });
      toast.success(t('toast.productCreated'), {
        description: t('toast.productCreatedMessage', { name: newProduct.fields.Name }),
      });
      onSuccess();
    },
    onError: (error) => {
      logger.error('Product creation mutation failed', {
        barcode,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      toast.error(t('toast.error'), {
        description: error instanceof Error ? error.message : t('errors.unknownError'),
      });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent double submission
    if (mutation.isPending) return;

    // Manual validation since we use formNoValidate to avoid browser focus errors
    const nameValue = formData.name.trim();
    if (!nameValue) {
      setNameError(true);
      // Focus the name input and show toast
      nameInputRef.current?.focus();
      toast.error(t('toast.validationError'), {
        description: t('product.nameRequired'),
      });
      return;
    }
    setNameError(false);

    mutation.mutate(formData);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Card className="w-full max-w-lg mx-auto animate-in slide-in-from-bottom-5 duration-300 shadow-lg border-2 border-stone-200 relative">
      {/* Loading Overlay - Skeleton with progress indicator */}
      {mutation.isPending && (
        <div className="absolute inset-0 bg-white/98 backdrop-blur-sm z-50 flex flex-col rounded-xl overflow-hidden pointer-events-auto">
          {/* Progress bar at top */}
          <div className="h-1 bg-stone-200 w-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-stone-500 to-stone-700 animate-[progress_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
          </div>

          {/* Skeleton content */}
          <div className="flex-1 p-6 space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>

            {/* Image skeleton */}
            <div className="flex justify-center">
              <Skeleton className="w-32 h-32 rounded-2xl" />
            </div>

            {/* Form fields skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 rounded-md" />
                <Skeleton className="h-10 rounded-md" />
              </div>
            </div>

            {/* Status message */}
            <div className="flex flex-col items-center gap-3 pt-4">
              <div className="w-10 h-10 border-4 border-stone-200 border-t-stone-700 rounded-full animate-spin" />
              <p className="text-stone-700 font-semibold text-base">{t('product.createAndStock')}...</p>
              <p className="text-stone-500 text-sm">{t('product.pleaseWait')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Compact header - max 50px on mobile */}
      <CardHeader className={`bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200 px-4 py-2 sm:px-6 sm:py-4 ${mutation.isPending ? 'invisible' : ''}`}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg sm:text-2xl font-bold text-stone-900">
              {t('product.createProduct')}
            </CardTitle>
            {aiLoading && (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-2 border-amber-200 shadow-sm text-xs">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse mr-1.5"></span>
                {t('product.searching')}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className={`px-6 py-6 max-h-[calc(100dvh-280px)] md:max-h-none overflow-y-auto ${mutation.isPending ? 'invisible' : ''}`}>
          <form onSubmit={handleSubmit} className="space-y-6" id={formId}>
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
                value={barcode}
                disabled
                className="mt-2 h-11 bg-stone-50 border-2 border-stone-300 text-stone-600 cursor-not-allowed"
              />
            </div>

            <div>
              <Label htmlFor="name" className={`text-stone-700 font-semibold text-sm ${nameError ? 'text-red-600' : ''}`}>
                {t('product.name')} <span className="text-red-500">*</span>
              </Label>
              <Input
                ref={nameInputRef}
                id="name"
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, name: value }));
                  if (nameError && value.trim()) {
                    setNameError(false);
                  }
                }}
                placeholder={t('product.namePlaceholder')}
                className={`mt-2 h-11 border-2 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)] ${
                  nameError ? 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500' : 'border-stone-300'
                }`}
              />
              {nameError && (
                <p className="mt-1 text-sm text-red-600">{t('product.nameRequired')}</p>
              )}
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
                  <SelectTrigger className="mt-2 h-11 border-2 border-stone-300 focus:ring-[var(--color-lavender)]">
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
                    className="h-11 pl-8 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stock & Expiry Section */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="initialStock" className="text-stone-700 font-semibold text-sm">{t('product.initialStock')}</Label>
                <Input
                  id="initialStock"
                  type="number"
                  name="initialStock"
                  min="0"
                  value={formData.initialStock}
                  onChange={handleChange}
                  className="mt-2 h-11 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]"
                />
              </div>
              <div>
                <Label htmlFor="expiryDate" className="text-stone-700 font-semibold text-sm">{t('product.expiryDate')}</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  name="expiryDate"
                  value={formData.expiryDate}
                  onChange={handleChange}
                  className="mt-2 h-11 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]"
                />
              </div>
            </div>
          </div>
        </form>

        {mutation.isError && (
          <div className="mt-6 text-red-700 text-sm bg-red-50 p-4 rounded-lg border-2 border-red-200 font-medium flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <span>{mutation.error.message || t('errors.productCreationFailed')}</span>
          </div>
        )}
        </CardContent>

        {/* Compact footer - no Cancel on mobile */}
        <CardFooter className={`bg-gradient-to-br from-stone-50 to-stone-100/50 p-4 sm:p-6 border-t-2 border-stone-200 flex gap-3 fixed md:static bottom-0 w-full ${mutation.isPending ? 'invisible' : ''}`}>
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="hidden sm:flex flex-1 border-2 border-stone-300 hover:bg-stone-100 font-semibold h-12"
          >
            {t('product.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            formNoValidate
            disabled={mutation.isPending}
            className="flex-1 font-bold bg-gradient-to-br from-stone-900 to-stone-800 hover:opacity-90 text-white h-12 shadow-md disabled:opacity-50"
          >
            {t('product.createAndStock')}
          </Button>
        </CardFooter>
    </Card>
  );
};

export default CreateProductForm;
