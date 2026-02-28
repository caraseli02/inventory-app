import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { QueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useProductLookup } from './useProductLookup';
import { useRecentProducts } from './useRecentProducts';
import { addStockMovement, ValidationError, NetworkError, AuthorizationError } from '../lib/api-provider';
import { getProductDisplayPrice } from './useMarkupSetting';
import { clearPersistedCheckoutCart, loadPersistedCheckoutCart, persistCheckoutCart } from '../lib/checkoutCartStorage';
import { logger } from '../lib/logger';
import { checkoutReducer, initialState } from '../components/checkout/checkoutReducer';
import type { CheckoutState, CheckoutAction } from '../components/checkout/checkoutReducer';
import type { CartItem, Product } from '../types';
import type { InputMode } from '../components/search/InputModeToggle';

export type { CheckoutState, CheckoutAction };

interface RunCheckoutArgs {
  cart: CartItem[];
  dispatch: React.Dispatch<CheckoutAction>;
  playSound: (type: 'success' | 'error') => void;
  queryClient: QueryClient;
  t: TFunction;
}

interface HandleLookupResultArgs {
  scannedCode: string | null;
  barcodeSource: 'scanner' | 'quick-add' | null;
  product: Product | null | undefined;
  isLoading: boolean;
  error: Error | null;
  processedBarcodeRef: React.MutableRefObject<string | null>;
  handleAddToCart: (p: Product) => boolean;
  playSound: (type: 'success' | 'error') => void;
  dispatch: React.Dispatch<CheckoutAction>;
  t: TFunction;
}

// ── Module-level pure helpers ─────────────────────────────────────────────────

function initCheckoutState(base: CheckoutState): CheckoutState {
  const persisted = loadPersistedCheckoutCart();
  if (!persisted) return base;
  return {
    ...base,
    cart: persisted.map(({ product, quantity }): CartItem => ({ product, quantity })),
  };
}

export function computeCartTotals(pendingItems: CartItem[]): { total: number; missingPrices: number; fallbackPrices: number } {
  return pendingItems.reduce(
    (result, item) => {
      const displayPrice = getProductDisplayPrice(item.product.fields);
      const activeMarkup = (item.product.fields.Markup ?? 70) as number;
      const tierPrice =
        activeMarkup === 50
          ? item.product.fields['Price 50%']
          : activeMarkup === 70
            ? item.product.fields['Price 70%']
            : activeMarkup === 100
              ? item.product.fields['Price 100%']
              : undefined;
      const usedBaseFallback =
        displayPrice != null && tierPrice == null && item.product.fields.Price != null;
      const price = displayPrice;
      if (price != null) result.total += price * item.quantity;
      if (price == null) result.missingPrices += 1;
      if (usedBaseFallback) result.fallbackPrices += 1;
      return result;
    },
    { total: 0, missingPrices: 0, fallbackPrices: 0 }
  );
}

export function validateCartStock(items: CartItem[], t: TFunction): Array<{ name: string; quantity: number; available: number }> {
  const insufficient: Array<{ name: string; quantity: number; available: number }> = [];
  for (const item of items) {
    const available = item.product.fields['Current Stock Level'] ?? 0;
    if (item.quantity > available) {
      insufficient.push({ name: item.product.fields.Name, quantity: item.quantity, available });
    }
  }
  // t is used by callers to format messages; accepted here for symmetry
  void t;
  return insufficient;
}

function classifyLookupError(error: unknown, t: TFunction): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('timeout')) {
    return t('toast.networkError');
  }
  if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('authentication')) {
    return t('toast.authError');
  }
  return t('toast.productNotFound');
}

function addProductToCart(
  productToAdd: Product,
  cart: CartItem[],
  playSound: (type: 'success' | 'error') => void,
  t: TFunction,
  dispatch: React.Dispatch<CheckoutAction>
): boolean {
  const existingItem = cart.find(item => item.product.id === productToAdd.id);
  const isNewItem = !existingItem;
  const newQuantity = existingItem ? existingItem.quantity + 1 : 1;
  const availableStock = productToAdd.fields['Current Stock Level'] ?? 0;
  if (newQuantity > availableStock) {
    playSound('error');
    toast.error(t('cart.insufficientStock', { available: availableStock }), {
      description: t('cart.insufficientStockDescription', { name: productToAdd.fields.Name, requested: newQuantity, available: availableStock }),
    });
    return false;
  }
  dispatch({ type: 'ADD_TO_CART', product: productToAdd, insufficientStockMessage: t('cart.insufficientStock', { available: availableStock }), zeroStockMessage: t('cart.zeroStock') });
  playSound('success');
  dispatch({ type: 'SET_LAST_ADDED', productName: productToAdd.fields.Name });
  if (isNewItem) {
    toast.success(t('cart.itemAdded'), { description: t('cart.itemAddedDescription', { name: productToAdd.fields.Name }) });
  } else {
    toast.success(t('cart.quantityUpdated'), { description: t('cart.quantityUpdatedDescription', { name: productToAdd.fields.Name, quantity: newQuantity }) });
  }
  return true;
}

function handleLookupResult(args: HandleLookupResultArgs): void {
  const { scannedCode, barcodeSource, product, isLoading, error, processedBarcodeRef, handleAddToCart, playSound, dispatch, t } = args;
  if (!scannedCode) return;
  if (processedBarcodeRef.current === scannedCode) return;
  if (product) {
    processedBarcodeRef.current = scannedCode;
    handleAddToCart(product);
    dispatch({ type: 'LOOKUP_SUCCESS' });
    if (barcodeSource === 'scanner') dispatch({ type: 'SET_CART_EXPANDED', expanded: false });
    processedBarcodeRef.current = null;
    return;
  }
  if (!isLoading && !product && !error) {
    processedBarcodeRef.current = scannedCode;
    playSound('error');
    logger.warn('Product not found in checkout', { barcode: scannedCode, timestamp: new Date().toISOString() });
    dispatch({ type: 'LOOKUP_ERROR', error: t('toast.productNotFound') });
    return;
  }
  if (error) {
    playSound('error');
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Product lookup failed', { barcode: scannedCode, errorMessage, errorType: error instanceof Error ? error.constructor.name : typeof error, timestamp: new Date().toISOString() });
    dispatch({ type: 'LOOKUP_ERROR', error: classifyLookupError(error, t) });
  }
}

function classifyCheckoutError(err: unknown, t: TFunction): string {
  if (err instanceof ValidationError) return t('toast.validationError');
  if (err instanceof NetworkError) return t('toast.networkError');
  if (err instanceof AuthorizationError) return t('toast.authorizationError');
  if (err instanceof Error) return err.message;
  return t('errors.unknownError');
}

async function runCheckout({ cart, dispatch, playSound, queryClient, t }: RunCheckoutArgs): Promise<void> {
  dispatch({ type: 'HIDE_CONFIRM_DIALOG' });
  dispatch({ type: 'START_CHECKOUT' });
  const processingCart = cart.map((item): CartItem =>
    item.status === 'success' ? item : { ...item, status: 'processing' as const, statusMessage: undefined }
  );
  dispatch({ type: 'SET_CART', cart: processingCart });
  const results: CartItem[] = [];
  const itemsToProcess = processingCart.filter(item => item.status === 'processing');
  for (const item of itemsToProcess) {
    try {
      await addStockMovement(item.product.id, item.quantity, 'OUT');
      results.push({ ...item, status: 'success' });
    } catch (err) {
      results.push({ ...item, status: 'failed', statusMessage: classifyCheckoutError(err, t) });
      logger.error('Checkout failed for item', { productId: item.product.id, productName: item.product.fields.Name, quantity: item.quantity, errorMessage: err instanceof Error ? err.message : String(err), errorType: err instanceof Error ? err.constructor.name : typeof err, errorStack: err instanceof Error ? err.stack : undefined, timestamp: new Date().toISOString() });
    }
  }
  const priorSuccesses = processingCart.filter(item => item.status === 'success' && !itemsToProcess.find(p => p.product.id === item.product.id));
  const mergedResults = [...priorSuccesses, ...results];
  const failedItems = mergedResults.filter(item => item.status === 'failed');
  if (failedItems.length === 0 && mergedResults.length > 0) {
    const itemsCount = mergedResults.length;
    const totalQuantity = mergedResults.reduce((sum, item) => sum + item.quantity, 0);
    const referenceNumber = `#INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    dispatch({ type: 'COMPLETE_CHECKOUT', itemsCount, totalQuantity, referenceNumber });
    clearPersistedCheckoutCart();
    playSound('success');
    queryClient.invalidateQueries({ queryKey: ['products'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['product'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['stockMovements'], exact: false });
    logger.info('Checkout completed successfully, related caches invalidated', { itemsProcessed: mergedResults.length, timestamp: new Date().toISOString() });
  } else {
    dispatch({ type: 'SET_CART', cart: mergedResults });
    dispatch({ type: 'CANCEL_CHECKOUT' });
    playSound('error');
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseCheckoutParams {
  t: TFunction;
  queryClient: QueryClient;
}

export function useCheckout({ t, queryClient }: UseCheckoutParams) {
  const [state, dispatch] = useReducer(checkoutReducer, initialState, initCheckoutState);
  const [inputMode, setInputMode] = useState<InputMode>('search');
  const { addRecentProduct } = useRecentProducts();
  const { data: product, isLoading, error } = useProductLookup(state.scannedCode);
  const isPendingLookup = isLoading || state.lookupRequested;
  const processedBarcodeRef = useRef<string | null>(null);

  const playSound = useCallback((type: 'success' | 'error') => {
    if (navigator.vibrate) navigator.vibrate(type === 'success' ? 100 : [100, 50, 100]);
  }, []);

  const handleAddToCart = useCallback((productToAdd: Product): boolean => {
    return addProductToCart(productToAdd, state.cart, playSound, t, dispatch);
  }, [state.cart, playSound, t]);

  useEffect(() => {
    handleLookupResult({ scannedCode: state.scannedCode, barcodeSource: state.barcodeSource, product: product ?? null, isLoading, error: error as Error | null, processedBarcodeRef, handleAddToCart, playSound, dispatch, t });
  }, [error, isLoading, playSound, product, state.scannedCode, state.barcodeSource, t, handleAddToCart]);

  useEffect(() => {
    if (!state.scannedCode && !isLoading && state.lookupRequested) dispatch({ type: 'RESET_LOOKUP' });
  }, [isLoading, state.lookupRequested, state.scannedCode]);

  const handleScanSuccess = useCallback((code: string, source: 'scanner' | 'quick-add' = 'scanner') => {
    if (!state.scannedCode && !isPendingLookup) {
      dispatch({ type: 'SET_SCANNED_CODE', code, source });
      dispatch({ type: 'REQUEST_LOOKUP' });
    }
  }, [state.scannedCode, isPendingLookup]);

  const handleManualSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.manualCode.trim().length > 3 && !isPendingLookup) {
      handleScanSuccess(state.manualCode.trim());
      dispatch({ type: 'SET_MANUAL_CODE', code: '' });
    }
  }, [state.manualCode, isPendingLookup, handleScanSuccess]);

  const handleProductSelect = useCallback((selectedProduct: Product) => {
    const added = handleAddToCart(selectedProduct);
    if (added) addRecentProduct(selectedProduct.id);
  }, [handleAddToCart, addRecentProduct]);

  const updateQuantity = useCallback((index: number, delta: number) => {
    if (delta > 0) {
      const item = state.cart[index];
      const available = item.product.fields['Current Stock Level'] ?? 0;
      if (item.quantity + delta > available) {
        dispatch({ type: 'UPDATE_CART_ITEM_QUANTITY', index, delta, errorMessage: t('cart.insufficientStock', { available }) });
        return;
      }
    }
    dispatch({ type: 'UPDATE_CART_ITEM_QUANTITY', index, delta });
  }, [state.cart, t]);

  useEffect(() => { persistCheckoutCart(state.cart); }, [state.cart]);

  const pendingItems = state.cart.filter(item => item.status !== 'success');
  const { total, missingPrices, fallbackPrices } = computeCartTotals(pendingItems);

  const handleCheckoutClick = useCallback(() => {
    if (pendingItems.length === 0) return;
    const insufficient = validateCartStock(pendingItems, t);
    if (insufficient.length > 0) {
      const msgs = insufficient.map(item => `• ${item.name}: ${t('checkout.needsQuantity', { quantity: item.quantity, available: item.available })}`).join('\n');
      toast.error(t('checkout.insufficientStockTitle'), {
        description: t('checkout.insufficientStockDescription', { count: insufficient.length }) + '\n\n' + msgs,
        duration: 6000,
      });
      return;
    }
    dispatch({ type: 'SHOW_REVIEW_MODAL' });
  }, [pendingItems, t]);

  const handleConfirmFromReview = useCallback(async () => {
    dispatch({ type: 'HIDE_REVIEW_MODAL' });
    await runCheckout({ cart: state.cart, dispatch, playSound, queryClient, t });
  }, [state.cart, playSound, queryClient, t]);

  return {
    state, dispatch, inputMode, setInputMode, isPendingLookup,
    handleScanSuccess, handleManualSubmit, handleProductSelect,
    updateQuantity, handleCheckoutClick, handleConfirmFromReview,
    pendingItems, total, missingPrices, fallbackPrices,
  };
}
