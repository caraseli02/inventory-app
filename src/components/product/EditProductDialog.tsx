import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { updateProduct } from '../../lib/api';
import { uploadImage, isDataUrl } from '../../lib/imageUpload';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '../../lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import BarcodeScannerDialog from '../scanner/BarcodeScannerDialog';
import CameraCaptureDialog from '../camera/CameraCaptureDialog';
import { ScanBarcode, Camera, ImageOff } from 'lucide-react';
import type { Product } from '../../types';

type MarkupPercentage = 50 | 70 | 100;

interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Helper to create initial form data from product */
const getInitialFormData = (product: Product) => ({
  name: product.fields.Name,
  barcode: product.fields.Barcode || '',
  category: product.fields.Category || 'General',
  markup: (product.fields.Markup as MarkupPercentage) || 70,
  expiryDate: product.fields['Expiry Date'] || '',
  imageUrl: product.fields.Image?.[0]?.url || '',
});

const EditProductDialog = ({ product, open, onOpenChange }: EditProductDialogProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Track which product the form is for (to reset on product change)
  const [trackedProductId, setTrackedProductId] = useState(product.id);

  // Initialize form with current product values
  const [formData, setFormData] = useState(getInitialFormData(product));

  // Reset form when product changes (React-recommended pattern: store prev props)
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (product.id !== trackedProductId) {
    setTrackedProductId(product.id);
    setFormData(getInitialFormData(product));
  }

  // Check if barcode is editable (only when empty)
  const isBarcodeEditable = !product.fields.Barcode;

  // Scanner and camera dialog states
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [prevImageUrl, setPrevImageUrl] = useState(formData.imageUrl);

  // Reset image load failure state when image URL changes
  if (formData.imageUrl !== prevImageUrl) {
    setPrevImageUrl(formData.imageUrl);
    setImageLoadFailed(false);
  }

  // Get store price based on selected markup
  const getStorePrice = (markupValue: MarkupPercentage): number | undefined => {
    switch (markupValue) {
      case 50:
        return product.fields['Price 50%'];
      case 70:
        return product.fields['Price 70%'];
      case 100:
        return product.fields['Price 100%'];
      default:
        return product.fields.Price;
    }
  };

  const basePrice = product.fields.Price;
  const storePrice = getStorePrice(formData.markup);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Upload image if it's a data URL (from camera capture)
      let imageUrl = data.imageUrl || undefined;
      if (imageUrl && isDataUrl(imageUrl)) {
        imageUrl = await uploadImage(imageUrl);
      }

      return await updateProduct(product.id, {
        Name: data.name,
        Barcode: data.barcode || undefined, // Only update if provided
        Category: data.category,
        Markup: data.markup,
        'Expiry Date': data.expiryDate || undefined,
        Image: imageUrl,
      });
    },
    onSuccess: (updatedProduct) => {
      // Invalidate queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['product', updatedProduct.fields.Barcode] });
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
        // Prevent parent dialog from closing when nested dialogs (scanner/camera) are open
        onPointerDownOutside={(e) => {
          if (scannerOpen || cameraOpen) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (scannerOpen || cameraOpen) {
            e.preventDefault();
          }
        }}
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
            <DialogDescription className="text-stone-600 text-sm">
              {t('dialogs.editProduct.description', 'Edit product details and save changes')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto" id="edit-product-form">
          {formData.imageUrl && (
            <div className="flex flex-col items-center gap-2 pb-4 border-b border-stone-200">
              <div className="w-40 h-40 rounded-2xl overflow-hidden border-2 border-stone-300 bg-gradient-to-br from-stone-50 to-stone-100 relative shadow-md">
                {imageLoadFailed ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
                    <ImageOff className="h-10 w-10 mb-2" />
                    <span className="text-xs text-center px-2">{t('product.imageLoadFailed', 'Image failed to load')}</span>
                  </div>
                ) : (
                  <img
                    src={formData.imageUrl}
                    alt={t('product.preview')}
                    className="w-full h-full object-contain p-2"
                    onLoad={() => setImageLoadFailed(false)}
                    onError={() => {
                      setImageLoadFailed(true);
                      logger.warn('Product image failed to load', {
                        productId: product.id,
                        imageUrl: formData.imageUrl,
                        timestamp: new Date().toISOString(),
                      });
                    }}
                  />
                )}
              </div>
              <span className="text-xs text-stone-500 font-medium">{t('product.preview')}</span>
            </div>
          )}

          {/* Product Identification Section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="barcode" className="text-stone-700 font-semibold text-sm">{t('product.barcode')}</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="barcode"
                  type="text"
                  name="barcode"
                  value={isBarcodeEditable ? formData.barcode : (product.fields.Barcode || '')}
                  onChange={isBarcodeEditable ? handleChange : undefined}
                  disabled={!isBarcodeEditable}
                  placeholder={isBarcodeEditable ? '1234567890123' : ''}
                  className={`flex-1 border-2 ${
                    isBarcodeEditable
                      ? 'border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]'
                      : 'bg-stone-50 border-stone-300 text-stone-600 cursor-not-allowed'
                  }`}
                />
                {isBarcodeEditable && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setScannerOpen(true)}
                    className="h-10 px-3 border-2 border-stone-300 hover:bg-stone-100 hover:border-[var(--color-lavender)]"
                  >
                    <ScanBarcode className="w-5 h-5 text-stone-600" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-1.5">
                {isBarcodeEditable
                  ? t('product.barcodeAddNow')
                  : t('product.barcodeCannotChange')
                }
              </p>
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
                  <SelectItem value="Conserve">{t('categories.Conserve')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
            <h3 className="font-semibold text-stone-900">{t('product.pricing')}</h3>

            {/* Base Price (read-only) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-stone-700 font-semibold text-sm">{t('product.basePrice')}</Label>
                <div className="mt-2 px-3 py-2 bg-stone-100 border-2 border-stone-200 rounded-md text-stone-600">
                  {basePrice != null ? `€${basePrice.toFixed(2)}` : '—'}
                </div>
                <p className="text-xs text-stone-500 mt-1">{t('product.basePriceHelp')}</p>
              </div>
              <div>
                <Label className="text-stone-700 font-semibold text-sm">{t('product.storePrice')}</Label>
                <div className="mt-2 px-3 py-2 bg-[var(--color-forest)]/10 border-2 border-[var(--color-forest)]/30 rounded-md text-[var(--color-forest)] font-bold text-lg">
                  {storePrice != null ? `€${storePrice.toFixed(2)}` : '—'}
                </div>
                <p className="text-xs text-stone-500 mt-1">{t('product.storePriceHelp')}</p>
              </div>
            </div>

            {/* Markup Selector */}
            <div>
              <Label className="text-stone-700 font-semibold text-sm">{t('markup.label')}</Label>
              <p className="text-xs text-stone-500 mt-1 mb-2">
                {t('markup.explanation', 'Select markup tier to set the store price. Higher markup = higher profit margin.')}
              </p>
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
              {basePrice != null && storePrice != null && (
                <p className="text-xs text-[var(--color-forest)] font-medium mt-2">
                  {t('markup.formula', '{{markup}}% markup: €{{base}} → €{{store}}', {
                    markup: formData.markup,
                    base: basePrice.toFixed(2),
                    store: storePrice.toFixed(2)
                  })}
                </p>
              )}
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
              <div className="flex gap-2 mt-2">
                <Input
                  id="imageUrl"
                  type="url"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  placeholder={t('product.imageUrlPlaceholder')}
                  className="flex-1 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCameraOpen(true)}
                  className="h-10 px-3 border-2 border-stone-300 hover:bg-stone-100 hover:border-[var(--color-lavender)]"
                >
                  <Camera className="w-5 h-5 text-stone-600" />
                </Button>
              </div>
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

        {/* Nested dialogs - must be inside DialogContent to prevent click-outside issues */}
        <BarcodeScannerDialog
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onScanSuccess={(barcode) => {
            setFormData({ ...formData, barcode });
          }}
        />

        <CameraCaptureDialog
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={(imageDataUrl) => {
            setFormData({ ...formData, imageUrl: imageDataUrl });
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;
