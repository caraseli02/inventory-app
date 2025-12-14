import { useState, useEffect, useRef, useId, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createProduct, addStockMovement } from '../../lib/api';
import { suggestProductDetails } from '../../lib/ai';
import { uploadImage, isDataUrl } from '../../lib/imageUpload';
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
import { ProductImage } from '@/components/ui/product-image';
import CameraCaptureDialog from '../camera/CameraCaptureDialog';
import { Camera, Package, AlertTriangle } from 'lucide-react';

type MarkupPercentage = 50 | 70 | 100;

interface CreateProductFormProps {
  barcode: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function CreateProductForm({ barcode, onSuccess, onCancel }: CreateProductFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'General',
    price: '',
    markup: 70 as MarkupPercentage,
    expiryDate: '',
    initialStock: '1',
    imageUrl: '',
  });
  const [nameError, setNameError] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
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

  // Calculate store price based on markup
  const basePrice = formData.price ? parseFloat(formData.price) : null;
  const storePrice = basePrice != null && !isNaN(basePrice)
    ? basePrice * (1 + formData.markup / 100)
    : null;

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const parsedPrice = data.price.trim() ? parseFloat(data.price) : undefined;
      const safePrice = Number.isFinite(parsedPrice) ? parsedPrice : undefined;

      // Upload image if it's a data URL (from camera capture)
      let imageUrl = data.imageUrl || undefined;
      if (imageUrl && isDataUrl(imageUrl)) {
        try {
          imageUrl = await uploadImage(imageUrl);
        } catch (uploadError) {
          logger.error('Failed to upload product image during creation', {
            barcode,
            errorMessage: uploadError instanceof Error ? uploadError.message : String(uploadError),
            errorStack: uploadError instanceof Error ? uploadError.stack : undefined,
            timestamp: new Date().toISOString(),
          });
          throw new Error(
            t('errors.imageUploadFailed', 'Failed to upload product image. Please try again or proceed without an image.')
          );
        }
      }

      const newProduct = await createProduct({
        Name: data.name,
        Barcode: barcode,
        Category: data.category,
        Price: safePrice,
        Markup: data.markup,
        'Expiry Date': data.expiryDate || undefined,
        Image: imageUrl,
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

    // Manual validation
    const nameValue = formData.name.trim();
    if (!nameValue) {
      setNameError(true);
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

  // Check if form is valid for submission
  const isFormValid = formData.name.trim().length > 0;

  return (
    <Card className="w-full max-w-lg mx-auto animate-in slide-in-from-bottom-5 duration-300 shadow-lg border-2 border-stone-200 relative">
      {/* Loading Overlay */}
      {mutation.isPending && (
        <div className="absolute inset-0 bg-white/98 backdrop-blur-sm z-50 flex flex-col rounded-xl overflow-hidden pointer-events-auto">
          <div className="h-1 bg-stone-200 w-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[var(--color-forest)] to-[var(--color-forest-dark)] animate-[progress_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
          </div>
          <div className="flex-1 p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="flex justify-center">
              <Skeleton className="w-32 h-32 rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="flex flex-col items-center gap-3 pt-4">
              <div className="w-10 h-10 border-4 border-stone-200 border-t-[var(--color-forest)] rounded-full animate-spin" />
              <p className="text-stone-700 font-semibold text-base">{t('product.createAndStock')}...</p>
              <p className="text-stone-500 text-sm">{t('product.pleaseWait')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
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
          {/* Product Image Section */}
          <div className="flex flex-col items-center gap-3 pb-4 border-b border-stone-200">
            {formData.imageUrl ? (
              <ProductImage
                src={formData.imageUrl}
                alt={formData.name || t('product.preview')}
                size="xl"
                showZoom
              />
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCameraOpen(true)}
                className="w-40 h-40 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 hover:bg-stone-100 hover:border-stone-400 transition-colors flex flex-col items-center justify-center gap-2 text-stone-500"
              >
                <Package className="h-10 w-10" />
                <span className="text-xs font-medium">{t('product.tapToAddImage')}</span>
              </Button>
            )}
            {formData.imageUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCameraOpen(true)}
                className="border-stone-300"
              >
                <Camera className="h-4 w-4 mr-1.5" />
                {t('camera.retake')}
              </Button>
            )}
          </div>

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
              <p className="text-xs text-stone-500 mt-1.5">{t('product.barcodeHelp')}</p>
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
              {nameError ? (
                <p className="mt-1.5 text-sm text-red-600">{t('product.nameRequired')}</p>
              ) : (
                <p className="text-xs text-stone-500 mt-1.5">{t('product.nameHelp')}</p>
              )}
            </div>
          </div>

          {/* Product Details Section */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
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
                  <SelectItem value="Conserve">{t('categories.Conserve')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-stone-500 mt-1.5">{t('product.categoryHelp')}</p>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
            <h3 className="font-semibold text-stone-900">{t('product.pricing')}</h3>

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
              <p className="text-xs text-stone-500 mt-1.5">{t('product.priceHelp')}</p>
            </div>

            {/* Markup Selector */}
            <div>
              <Label className="text-stone-700 font-semibold text-sm">{t('markup.label')}</Label>
              <p className="text-xs text-stone-500 mt-1 mb-2">{t('markup.selectTier')}</p>
              <div className="flex rounded-lg border-2 border-stone-200 bg-stone-50 p-1">
                {([50, 70, 100] as MarkupPercentage[]).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, markup: option })}
                    className={`
                      flex-1 h-10 font-semibold transition-all
                      ${formData.markup === option
                        ? 'bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-dark)] hover:text-white'
                        : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                      }
                    `}
                  >
                    {option}%
                  </Button>
                ))}
              </div>
            </div>

            {/* Store Price Display */}
            {basePrice != null && storePrice != null && (
              <div className="p-3 bg-[var(--color-forest)]/10 border-2 border-[var(--color-forest)]/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-700 font-medium">{t('product.storePrice')}</span>
                  <span className="text-xl font-bold text-[var(--color-forest)]">€{storePrice.toFixed(2)}</span>
                </div>
                <p className="text-xs text-[var(--color-forest)] mt-1">
                  {t('markup.formula', {
                    markup: formData.markup,
                    base: basePrice.toFixed(2),
                    store: storePrice.toFixed(2)
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Stock & Expiry Section */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
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
              <p className="text-xs text-stone-500 mt-1.5">{t('product.initialStockHelp')}</p>
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
              <p className="text-xs text-stone-500 mt-1.5">{t('product.expiryDateHelp')}</p>
            </div>
          </div>

          {/* Image URL Section */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
            <div>
              <Label htmlFor="imageUrl" className="text-stone-700 font-semibold text-sm">{t('product.imageUrl')}</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="imageUrl"
                  type="url"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  placeholder={t('product.imageUrlPlaceholder')}
                  className="flex-1 h-11 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCameraOpen(true)}
                  className="h-11 w-11 p-0 border-2 border-stone-300 hover:bg-stone-100 hover:border-[var(--color-lavender)]"
                >
                  <Camera className="w-5 h-5 text-stone-600" />
                </Button>
              </div>
              <p className="text-xs text-stone-500 mt-1.5">{t('product.imageHelp')}</p>
            </div>
          </div>
        </form>

        {mutation.isError && (
          <div className="mt-6 text-red-700 text-sm bg-red-50 p-4 rounded-lg border-2 border-red-200 font-medium flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span>{mutation.error.message || t('errors.productCreationFailed')}</span>
          </div>
        )}
      </CardContent>

      {/* Footer */}
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
          disabled={mutation.isPending || !isFormValid}
          className="flex-1 font-bold bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] hover:opacity-90 text-white h-12 shadow-md disabled:opacity-50"
        >
          {t('product.createAndStock')}
        </Button>
      </CardFooter>

      {/* Camera Dialog */}
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(imageDataUrl) => {
          setFormData({ ...formData, imageUrl: imageDataUrl });
        }}
      />
    </Card>
  );
};

export default CreateProductForm;
