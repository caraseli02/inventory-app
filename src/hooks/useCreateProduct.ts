import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createProduct, addStockMovement } from '../lib/api-provider';
import { suggestProductDetails } from '../lib/ai';
import { uploadImage, isDataUrl } from '../lib/imageUpload';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '../lib/logger';
import type { MarkupPercentage } from '../types';

export type AiStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error';

export interface CreateProductFormData {
  name: string;
  category: string;
  price: string;
  markup: MarkupPercentage;
  expiryDate: string;
  initialStock: string;
  imageUrl: string;
}

export interface UseCreateProductResult {
  formData: CreateProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<CreateProductFormData>>;
  nameError: boolean;
  setNameError: React.Dispatch<React.SetStateAction<boolean>>;
  cameraOpen: boolean;
  setCameraOpen: (open: boolean) => void;
  displayAiStatus: AiStatus;
  basePrice: number | null;
  storePrice: number | null;
  isFormValid: boolean;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

const INITIAL_FORM_DATA: CreateProductFormData = {
  name: '',
  category: 'General',
  price: '',
  markup: 70,
  expiryDate: '',
  initialStock: '1',
  imageUrl: '',
};

function toErrInfo(err: unknown) {
  return {
    errorMessage: err instanceof Error ? err.message : String(err),
    errorStack: err instanceof Error ? err.stack : undefined,
  };
}

async function createProductWithStock(
  barcode: string,
  data: CreateProductFormData,
) {
  const parsedPrice = data.price.trim() ? parseFloat(data.price) : undefined;
  const safePrice = Number.isFinite(parsedPrice) ? parsedPrice : undefined;
  let imageUrl = data.imageUrl || undefined;
  if (imageUrl && isDataUrl(imageUrl)) {
    try {
      imageUrl = await uploadImage(imageUrl);
    } catch (uploadError) {
      logger.error('Failed to upload product image during creation', {
        barcode,
        ...toErrInfo(uploadError),
        timestamp: new Date().toISOString(),
      });
      throw new Error('Failed to upload product image. Please try again or proceed without an image.');
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
        ...toErrInfo(stockError),
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Product created (${newProduct.fields.Name}) but initial stock failed. Please add stock manually or contact support.`);
    }
  }
  return newProduct;
}

function runAiAutoFill(
  barcode: string,
  setFormData: React.Dispatch<React.SetStateAction<CreateProductFormData>>,
  setAiStatus: React.Dispatch<React.SetStateAction<AiStatus>>,
): () => void {
  let isCancelled = false;
  const autoFill = async () => {
    setAiStatus('loading');
    try {
      const suggestion = await suggestProductDetails(barcode);
      if (isCancelled) return;
      if (suggestion) {
        setFormData(prev => ({
          ...prev,
          name: suggestion.name || prev.name,
          category: suggestion.category || prev.category,
          imageUrl: suggestion.imageUrl || prev.imageUrl,
        }));
        setAiStatus('found');
      } else {
        setAiStatus('not_found');
      }
    } catch (err) {
      if (isCancelled) return;
      logger.warn('AI auto-fill failed during product creation', {
        barcode,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        timestamp: new Date().toISOString(),
      });
      setAiStatus('error');
    }
  };
  void autoFill();
  return () => { isCancelled = true; };
}

export function useCreateProduct(
  barcode: string,
  onSuccess: () => void,
): UseCreateProductResult {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<CreateProductFormData>(INITIAL_FORM_DATA);
  const [nameError, setNameError] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle');

  useEffect(() => {
    if (!barcode.trim()) return;
    return runAiAutoFill(barcode, setFormData, setAiStatus);
  }, [barcode]);

  const basePrice = formData.price ? parseFloat(formData.price) : null;
  const storePrice = basePrice != null && !isNaN(basePrice) ? basePrice * (1 + formData.markup / 100) : null;

  const mutation = useMutation({
    mutationFn: (data: CreateProductFormData) => createProductWithStock(barcode, data),
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
    if (mutation.isPending) return;
    const nameValue = formData.name.trim();
    if (!nameValue) {
      setNameError(true);
      nameInputRef.current?.focus();
      toast.error(t('toast.validationError'), { description: t('product.nameRequired') });
      return;
    }
    setNameError(false);
    mutation.mutate(formData);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return {
    formData, setFormData,
    nameError, setNameError,
    cameraOpen, setCameraOpen,
    displayAiStatus: barcode.trim() ? aiStatus : 'idle',
    basePrice, storePrice,
    isFormValid: formData.name.trim().length > 0,
    nameInputRef,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    handleSubmit, handleChange,
  };
}
