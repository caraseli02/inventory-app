import { useEffect, useRef, useState, useMemo, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { updateProduct } from '../lib/api-provider';
import { uploadImage, isDataUrl } from '../lib/imageUpload';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '../lib/logger';
import type { TFunction } from 'i18next';
import type { Product } from '../types';

export type MarkupPercentage = 50 | 70 | 100;

export interface ProductEditFormData {
  name: string;
  barcode: string;
  category: string;
  markup: MarkupPercentage;
  expiryDate: string;
  imageUrl: string;
  minStockLevel: string;
  supplier: string;
}

export function getInitialFormData(product: Product): ProductEditFormData {
  return {
    name: product.fields.Name,
    barcode: product.fields.Barcode || '',
    category: product.fields.Category || 'General',
    markup: (product.fields.Markup as MarkupPercentage) || 70,
    expiryDate: product.fields['Expiry Date'] || '',
    imageUrl: product.fields.Image?.[0]?.url || '',
    minStockLevel: product.fields['Min Stock Level']?.toString() || '',
    supplier: product.fields.Supplier || '',
  };
}

export interface ProductEditState {
  formData: ProductEditFormData;
  setFormData: (data: ProductEditFormData) => void;
  isBarcodeEditable: boolean;
  basePrice: number | undefined;
  storePrice: number | undefined;
  currentStock: number;
  hasChanges: boolean;
  isFormValid: boolean;
  mutation: ReturnType<typeof useMutation<Product, Error, ProductEditFormData>>;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleDiscard: () => void;
  basicOpen: boolean;
  setBasicOpen: (open: boolean) => void;
  pricingOpen: boolean;
  setPricingOpen: (open: boolean) => void;
  stockOpen: boolean;
  setStockOpen: (open: boolean) => void;
  sourcePriceLei: string;
  setSourcePriceLei: (v: string) => void;
  transportFeeEur: string;
  setTransportFeeEur: (v: string) => void;
  exchangeRate: string;
  setExchangeRate: (v: string) => void;
  scannerOpen: boolean;
  setScannerOpen: (open: boolean) => void;
  cameraOpen: boolean;
  setCameraOpen: (open: boolean) => void;
}

async function runProductUpdate(
  data: ProductEditFormData,
  product: Product,
  t: TFunction,
): Promise<Product> {
  let imageUrl = data.imageUrl || undefined;
  if (imageUrl && isDataUrl(imageUrl)) {
    try {
      imageUrl = await uploadImage(imageUrl);
    } catch (uploadError) {
      logger.error('Failed to upload product image during update', {
        productId: product.id,
        productName: product.fields.Name,
        errorMessage: uploadError instanceof Error ? uploadError.message : String(uploadError),
        errorStack: uploadError instanceof Error ? uploadError.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      throw new Error(t('errors.imageUploadFailed', 'Failed to upload product image. Please try again or proceed without an image.'));
    }
  }
  let minStockLevel: number | undefined;
  if (data.minStockLevel) {
    const parsed = parseInt(data.minStockLevel, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(t('product.minStockLevelInvalid', 'Min Stock Level must be a non-negative number'));
    }
    minStockLevel = parsed;
  }
  return await updateProduct(product.id, {
    Name: data.name,
    Barcode: data.barcode || undefined,
    Category: data.category,
    Markup: data.markup,
    'Expiry Date': data.expiryDate || undefined,
    'Min Stock Level': minStockLevel,
    Supplier: data.supplier || undefined,
    Image: imageUrl,
  });
}

function getStorePrice(product: Product, markup: MarkupPercentage): number | undefined {
  switch (markup) {
    case 50: return product.fields['Price 50%'];
    case 70: return product.fields['Price 70%'];
    case 100: return product.fields['Price 100%'];
    default: return product.fields.Price;
  }
}

export function useProductEdit(
  product: Product,
  onOpenChange: (open: boolean) => void,
): ProductEditState {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const productRef = useRef(product);
  const [formData, setFormData] = useState<ProductEditFormData>(() => getInitialFormData(product));
  const [basicOpen, setBasicOpen] = useState(true);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [sourcePriceLei, setSourcePriceLei] = useState('');
  const [transportFeeEur, setTransportFeeEur] = useState('');
  const [exchangeRate, setExchangeRate] = useState('4.97');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    productRef.current = product;
  }, [product]);

  useEffect(() => {
    setFormData(getInitialFormData(productRef.current));
  }, [product.id]);

  const isBarcodeEditable = !product.fields.Barcode;
  const basePrice = product.fields.Price;
  const storePrice = getStorePrice(product, formData.markup);

  const initialData = useMemo(() => getInitialFormData(product), [product]);
  const hasChanges = useMemo(() => (
    formData.name !== initialData.name ||
    formData.barcode !== initialData.barcode ||
    formData.category !== initialData.category ||
    formData.markup !== initialData.markup ||
    formData.expiryDate !== initialData.expiryDate ||
    formData.imageUrl !== initialData.imageUrl ||
    formData.minStockLevel !== initialData.minStockLevel ||
    formData.supplier !== initialData.supplier
  ), [formData, initialData]);

  const isFormValid = formData.name.trim().length > 0;
  const currentStock = product.fields['Current Stock Level'] ?? 0;

  const mutation = useMutation<Product, Error, ProductEditFormData>({
    mutationFn: (data) => runProductUpdate(data, product, t),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['product', updated.fields.Barcode] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(t('toast.productUpdated'), { description: t('toast.productUpdatedMessage', { name: updated.fields.Name }) });
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error('Product update mutation failed', { productId: product.id, errorMessage: error instanceof Error ? error.message : String(error), errorStack: error instanceof Error ? error.stack : undefined, timestamp: new Date().toISOString() });
      toast.error(t('toast.updateFailed'), { description: error instanceof Error ? error.message : t('errors.unknownError') });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); mutation.mutate(formData); };
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };
  const handleDiscard = () => setFormData(getInitialFormData(product));

  return {
    formData, setFormData, isBarcodeEditable,
    basePrice, storePrice, currentStock, hasChanges, isFormValid,
    mutation, handleSubmit, handleChange, handleDiscard,
    basicOpen, setBasicOpen, pricingOpen, setPricingOpen, stockOpen, setStockOpen,
    sourcePriceLei, setSourcePriceLei, transportFeeEur, setTransportFeeEur, exchangeRate, setExchangeRate,
    scannerOpen, setScannerOpen, cameraOpen, setCameraOpen,
  };
}
