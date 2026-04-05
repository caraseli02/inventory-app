import { type ChangeEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ProductImage } from '@/components/ui/product-image';
import BarcodeScannerDialog from '../scanner/BarcodeScannerDialog';
import CameraCaptureDialog from '../camera/CameraCaptureDialog';
import { ScanBarcode, Camera, Package, AlertTriangle, ChevronDown, ArrowLeft, Truck } from 'lucide-react';
import type { Product } from '../../types';
import { useProductEdit, type MarkupPercentage, type ProductEditFormData } from '../../hooks/useProductEdit';
import { PricingSection } from './PricingSection';

const CATEGORIES = ['General', 'Produce', 'Dairy', 'Meat', 'Pantry', 'Snacks', 'Beverages', 'Household', 'Conserve', 'Cereale'] as const;

interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BasicInfoProps {
  formData: ProductEditFormData;
  setFormData: (data: ProductEditFormData) => void;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  product: Product;
  isBarcodeEditable: boolean;
  setScannerOpen: (open: boolean) => void;
  basicOpen: boolean;
  setBasicOpen: (open: boolean) => void;
}

function BasicInfoSection({ formData, setFormData, handleChange, product, isBarcodeEditable, setScannerOpen, basicOpen, setBasicOpen }: BasicInfoProps) {
  const { t } = useTranslation();

  // Memoize category change handler to avoid creating new function on every render
  const handleCategoryChange = useCallback((cat: string) => {
    setFormData({ ...formData, category: cat });
  }, [formData, setFormData]);

  // Memoize scanner open handler
  const handleOpenScanner = useCallback(() => {
    setScannerOpen(true);
  }, [setScannerOpen]);

  return (
    <Collapsible open={basicOpen} onOpenChange={setBasicOpen}>
      <div className="bg-white rounded-xl border-2 border-stone-200 overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between px-4 sm:px-5 py-4 hover:bg-stone-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--icon-info-bg)' }}>
              <Package className="w-4 h-4" style={{ color: 'var(--icon-info-text)' }} />
            </div>
            <span className="font-semibold text-stone-900">{t('dialogs.editProduct.sectionBasic', 'Basic Information')}</span>
          </div>
          <ChevronDown className={`w-5 h-5 text-stone-400 transition-transform duration-200 ${basicOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-stone-100 pt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-stone-700 font-semibold text-sm">{t('product.name')} <span className="text-red-500">*</span></Label>
                <Input id="name" type="text" name="name" required value={formData.name} onChange={handleChange} placeholder={t('product.namePlaceholder')} className="mt-2 h-11 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]" />
              </div>
              <div>
                <Label htmlFor="barcode" className="text-stone-700 font-semibold text-sm">{t('product.barcode')}</Label>
                <div className="flex gap-2 mt-2">
                  <Input id="barcode" type="text" name="barcode" value={isBarcodeEditable ? formData.barcode : (product.fields.Barcode || '')} onChange={isBarcodeEditable ? handleChange : undefined} disabled={!isBarcodeEditable} placeholder={isBarcodeEditable ? '1234567890123' : ''} className={`flex-1 h-11 border-2 ${isBarcodeEditable ? 'border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]' : 'bg-stone-50 border-stone-200 text-stone-500 cursor-not-allowed'}`} />
                  {isBarcodeEditable && (
                    <Button type="button" variant="outline" onClick={handleOpenScanner} className="h-11 w-11 p-0 border-2 border-stone-300 hover:bg-stone-100">
                      <ScanBarcode className="w-5 h-5 text-stone-600" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-1.5">{isBarcodeEditable ? t('product.barcodeAddNow', 'Scan or enter barcode now') : t('product.barcodeCannotChange', 'Barcode cannot be changed once set')}</p>
              </div>
            </div>
            <div>
              <Label className="text-stone-700 font-semibold text-sm">{t('product.category')}</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CATEGORIES.map((cat) => (
                  <Button key={cat} type="button" variant={formData.category === cat ? 'default' : 'outline'} size="sm"
                    onClick={handleCategoryChange.bind(null, cat)}
                    className={`px-3 py-1.5 h-8 rounded-full font-medium transition-all ${formData.category === cat ? 'bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-dark)] border-transparent' : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'}`}
                  >
                    {t(`categories.${cat}`, cat)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface StockSectionProps {
  formData: ProductEditFormData;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  currentStock: number;
  setCameraOpen: (open: boolean) => void;
  stockOpen: boolean;
  setStockOpen: (open: boolean) => void;
}

function StockSupplySection({ formData, handleChange, currentStock, setCameraOpen, stockOpen, setStockOpen }: StockSectionProps) {
  const { t } = useTranslation();
  return (
    <Collapsible open={stockOpen} onOpenChange={setStockOpen}>
      <div className="bg-white rounded-xl border-2 border-stone-200 overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between px-4 sm:px-5 py-4 hover:bg-stone-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--icon-warning-bg)' }}>
              <Truck className="w-4 h-4" style={{ color: 'var(--icon-warning-text)' }} />
            </div>
            <span className="font-semibold text-stone-900">{t('dialogs.editProduct.sectionStock', 'Stock & Supply')}</span>
            <Badge variant="secondary" className="text-xs ml-2" style={{ backgroundColor: 'var(--icon-success-bg)', color: 'var(--icon-success-text)' }}>{currentStock} {t('product.inStock')}</Badge>
          </div>
          <ChevronDown className={`w-5 h-5 text-stone-400 transition-transform duration-200 ${stockOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-stone-100 pt-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-stone-700 font-semibold text-sm">{t('product.currentStock', 'Current Stock')}</Label>
                <div className="mt-2 h-11 px-3 flex items-center bg-stone-50 border-2 border-stone-200 rounded-lg">
                  <span className="text-lg font-semibold text-stone-900">{currentStock}</span>
                </div>
                <p className="text-xs text-stone-500 mt-1.5">{t('product.currentStockHelp', 'Managed via stock movements')}</p>
              </div>
              <div>
                <Label htmlFor="minStockLevel" className="text-stone-700 font-semibold text-sm">{t('product.minStockLevel', 'Min Stock Level')}</Label>
                <Input id="minStockLevel" type="number" name="minStockLevel" min={0} value={formData.minStockLevel} onChange={handleChange} placeholder="0" className="mt-2 h-11 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]" />
              </div>
              <div>
                <Label htmlFor="expiryDate" className="text-stone-700 font-semibold text-sm">{t('product.expiryDate')}</Label>
                <Input id="expiryDate" type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} className="mt-2 h-11 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]" />
              </div>
            </div>
            <div>
              <Label htmlFor="supplier" className="text-stone-700 font-semibold text-sm">{t('product.supplier', 'Supplier')}</Label>
              <Input id="supplier" type="text" name="supplier" value={formData.supplier} onChange={handleChange} placeholder={t('product.supplierPlaceholder', 'Enter supplier name')} className="mt-2 h-11 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]" />
            </div>
            <div>
              <Label htmlFor="imageUrl" className="text-stone-700 font-semibold text-sm">{t('product.imageUrl')}</Label>
              <div className="flex gap-2 mt-2">
                <Input id="imageUrl" type="url" name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder={t('product.imageUrlPlaceholder')} className="flex-1 h-11 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)]" />
                <Button type="button" variant="outline" onClick={() => setCameraOpen(true)} className="h-11 w-11 p-0 border-2 border-stone-300 hover:bg-stone-100">
                  <Camera className="w-5 h-5 text-stone-600" />
                </Button>
              </div>
              <p className="text-xs text-stone-500 mt-1.5">{t('product.imageHelp', 'Paste image URL or use camera')}</p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function EditProductDialog({ product, open, onOpenChange }: EditProductDialogProps) {
  const { t } = useTranslation();
  const state = useProductEdit(product, onOpenChange);
  const { formData, setFormData, isBarcodeEditable, basePrice, storePrice, currentStock, hasChanges, isFormValid, mutation, handleSubmit, handleChange, handleDiscard, basicOpen, setBasicOpen, pricingOpen, setPricingOpen, stockOpen, setStockOpen, sourcePriceLei, setSourcePriceLei, transportFeeEur, setTransportFeeEur, exchangeRate, setExchangeRate, scannerOpen, setScannerOpen, cameraOpen, setCameraOpen } = state;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !inset-0 !left-0 !top-0 !right-0 !bottom-0 w-full h-full !max-w-full !max-h-full !translate-x-0 !translate-y-0 p-0 gap-0 !rounded-none flex flex-col overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()} onPointerDownOutside={(e) => { if (scannerOpen || cameraOpen) e.preventDefault(); }} onInteractOutside={(e) => { if (scannerOpen || cameraOpen) e.preventDefault(); }} aria-describedby="edit-product-description">
        {mutation.isPending && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-stone-200 border-t-[var(--color-forest)] rounded-full animate-spin"></div>
              <p className="text-stone-900 font-semibold text-lg">{t('product.saveChanges')}...</p>
            </div>
          </div>
        )}

        <div className="bg-white border-b-2 border-stone-200 px-4 sm:px-6 py-4 shrink-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{t('dialogs.editProduct.title', 'Edit Product')}</DialogTitle>
            <DialogDescription id="edit-product-description">{t('dialogs.editProduct.description', 'Edit product details and save changes')}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="p-2 hover:bg-stone-100 -ml-2">
                <ArrowLeft className="w-5 h-5 text-stone-600" />
              </Button>
              {formData.imageUrl ? (
                <ProductImage src={formData.imageUrl} alt={formData.name || t('product.preview')} size="sm" className="w-12 h-12 flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-stone-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-stone-900 truncate">{product.fields.Name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-stone-200 text-xs">{t(`categories.${formData.category}`, formData.category)}</Badge>
                  <span className="text-xs text-stone-500">•</span>
                  <span className="text-xs text-stone-500">{currentStock} {t('product.inStock')}</span>
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0 hidden sm:block">
              {storePrice != null && (<><div className="text-2xl font-bold text-[var(--color-forest)]">€{storePrice.toFixed(2)}</div><div className="text-xs text-stone-500">{t('product.storePrice')}</div></>)}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 pb-6" id="edit-product-form">
            <div className="bg-white rounded-xl border-2 border-stone-200 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-sm font-semibold text-stone-700">{t('product.quickActions', 'Quick Actions')}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {([50, 70, 100] as MarkupPercentage[]).map((option) => (
                    <Button key={option} type="button" variant={formData.markup === option ? 'default' : 'outline'} size="sm"
                      onClick={() => setFormData({ ...formData, markup: option })}
                      className={`px-3 py-1.5 h-8 font-medium transition-all ${formData.markup === option ? 'bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-dark)] border-[var(--color-forest)]' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}
                    >
                      {option}%
                    </Button>
                  ))}
                  <div className="w-px h-6 bg-stone-200 mx-1 hidden sm:block" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setCameraOpen(true)} className="h-8 px-3 border-stone-200 text-stone-600 hover:bg-stone-50">
                    <Camera className="w-4 h-4 mr-1.5" />{t('camera.photo', 'Photo')}
                  </Button>
                  {isBarcodeEditable && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setScannerOpen(true)} className="h-8 px-3 border-stone-200 text-stone-600 hover:bg-stone-50">
                      <ScanBarcode className="w-4 h-4 mr-1.5" />{t('scanner.scan', 'Scan')}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <BasicInfoSection formData={formData} setFormData={setFormData} handleChange={handleChange} product={product} isBarcodeEditable={isBarcodeEditable} setScannerOpen={setScannerOpen} basicOpen={basicOpen} setBasicOpen={setBasicOpen} />
            <PricingSection basePrice={basePrice} storePrice={storePrice} markup={formData.markup} onMarkupChange={(m) => setFormData({ ...formData, markup: m })} pricingOpen={pricingOpen} onPricingOpenChange={setPricingOpen} sourcePriceLei={sourcePriceLei} setSourcePriceLei={setSourcePriceLei} transportFeeEur={transportFeeEur} setTransportFeeEur={setTransportFeeEur} exchangeRate={exchangeRate} setExchangeRate={setExchangeRate} />
            <StockSupplySection formData={formData} handleChange={handleChange} currentStock={currentStock} setCameraOpen={setCameraOpen} stockOpen={stockOpen} setStockOpen={setStockOpen} />

            {mutation.isError && (
              <div className="text-red-700 text-sm bg-red-50 p-4 rounded-xl border-2 border-red-200 font-medium flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <span>{mutation.error instanceof Error ? mutation.error.message : t('product.updateFailed')}</span>
              </div>
            )}
          </form>
        </div>

        <div className="shrink-0 bg-white border-t-2 border-stone-200 px-4 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            {hasChanges ? (
              <>
                <span className="text-sm text-stone-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-warning)' }}></span>
                  {t('product.unsavedChanges', 'Unsaved changes')}
                </span>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="ghost" onClick={handleDiscard} disabled={mutation.isPending} className="text-stone-600 hover:bg-stone-100">{t('product.discard', 'Discard')}</Button>
                  <Button type="submit" form="edit-product-form" disabled={mutation.isPending || !isFormValid} className="px-5 bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] hover:opacity-90 text-white font-semibold shadow-md disabled:opacity-50">
                    {mutation.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : t('product.saveChanges')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div></div>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-stone-300 text-stone-700 hover:bg-stone-100">{t('product.close', 'Close')}</Button>
              </>
            )}
          </div>
        </div>

        <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScanSuccess={(barcode) => setFormData({ ...formData, barcode })} />
        <CameraCaptureDialog open={cameraOpen} onOpenChange={setCameraOpen} onCapture={(imageDataUrl) => setFormData({ ...formData, imageUrl: imageDataUrl })} />
      </DialogContent>
    </Dialog>
  );
}

export default EditProductDialog;
