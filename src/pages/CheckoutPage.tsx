import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ScannerFrame } from '../components/scanner/ScannerFrame';
import { Cart } from '../components/cart/Cart';
import { PageHeader } from '../components/ui/PageHeader';
import { useProductLookup } from '../hooks/useProductLookup';
import { addStockMovement, ValidationError, NetworkError, AuthorizationError } from '../lib/api';
import type { CartItem, Product } from '../types';
import { logger } from '../lib/logger';
import {
  CheckCircleIcon,
  ShoppingCartIcon,
  BoxIcon,
} from '../components/ui/Icons';
import { CheckoutProgress } from '../components/checkout/CheckoutProgress';
import { Button } from '../components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { ProductSearchDropdown } from '../components/search/ProductSearchDropdown';
import { InputModeToggle, type InputMode } from '../components/search/InputModeToggle';
import { ProductBrowsePanel } from '../components/search/ProductBrowsePanel';
import { useRecentProducts } from '../hooks/useRecentProducts';

interface CheckoutPageProps {
  onBack: () => void;
}

/**
 * CheckoutPage state managed by useReducer
 */
interface CheckoutState {
  // Cart state
  cart: CartItem[];
  isCheckingOut: boolean;
  checkoutComplete: boolean;

  // Scanner state
  scannedCode: string | null;
  showScanner: boolean;
  manualCode: string;
  barcodeSource: 'scanner' | 'quick-add' | null;

  // Lookup state
  lookupRequested: boolean;
  lookupError: string | null;

  // UI state
  isCartExpanded: boolean;
  showConfirmDialog: boolean;
  confirmDialogMessage: string;
  showReviewModal: boolean;
}

/**
 * Actions for CheckoutPage reducer
 */
type CheckoutAction =
  // Cart actions
  | { type: 'ADD_TO_CART'; product: Product; insufficientStockMessage?: string; zeroStockMessage?: string }
  | { type: 'UPDATE_CART_ITEM_QUANTITY'; index: number; delta: number; errorMessage?: string }
  | { type: 'SET_CART'; cart: CartItem[] }
  | { type: 'CLEAR_CART' }
  | { type: 'START_CHECKOUT' }
  | { type: 'COMPLETE_CHECKOUT' }
  | { type: 'CANCEL_CHECKOUT' }

  // Scanner actions
  | { type: 'SET_SCANNED_CODE'; code: string | null; source?: 'scanner' | 'quick-add' }
  | { type: 'SET_MANUAL_CODE'; code: string }
  | { type: 'TOGGLE_SCANNER' }
  | { type: 'SET_SHOW_SCANNER'; show: boolean }

  // Lookup actions
  | { type: 'REQUEST_LOOKUP' }
  | { type: 'LOOKUP_SUCCESS' }
  | { type: 'LOOKUP_ERROR'; error: string }
  | { type: 'CLEAR_LOOKUP_ERROR' }
  | { type: 'RESET_LOOKUP' }

  // UI actions
  | { type: 'TOGGLE_CART_EXPANDED' }
  | { type: 'SET_CART_EXPANDED'; expanded: boolean }
  | { type: 'SHOW_CONFIRM_DIALOG'; message: string }
  | { type: 'HIDE_CONFIRM_DIALOG' }
  | { type: 'SHOW_REVIEW_MODAL' }
  | { type: 'HIDE_REVIEW_MODAL' };

/**
 * Initial state for CheckoutPage
 */
const initialState: CheckoutState = {
  cart: [],
  isCheckingOut: false,
  checkoutComplete: false,
  scannedCode: null,
  showScanner: true,
  manualCode: '',
  barcodeSource: null,
  lookupRequested: false,
  lookupError: null,
  isCartExpanded: false,
  showConfirmDialog: false,
  confirmDialogMessage: '',
  showReviewModal: false,
};

/**
 * Reducer for CheckoutPage state management
 *
 * Centralizes all state transitions for better predictability and testability.
 * Handles cart operations, scanner state, product lookup, and UI interactions.
 */
function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    // Cart actions
    case 'ADD_TO_CART': {
      const existingItemIndex = state.cart.findIndex(item => item.product.id === action.product.id);
      const availableStock = action.product.fields['Current Stock Level'] ?? 0;

      if (existingItemIndex >= 0) {
        const existingItem = state.cart[existingItemIndex];
        const newQuantity = existingItem.quantity + 1;

        // Validate stock before allowing increase
        if (newQuantity > availableStock) {
          // Immutable update - create new item object
          return {
            ...state,
            cart: state.cart.map((cartItem, i) =>
              i === existingItemIndex
                ? { ...cartItem, status: 'failed' as const, statusMessage: action.insufficientStockMessage }
                : cartItem
            ),
            checkoutComplete: false,
          };
        }

        // Stock available, allow increase - immutable update
        return {
          ...state,
          cart: state.cart.map((cartItem, i) =>
            i === existingItemIndex
              ? { ...cartItem, quantity: newQuantity, status: undefined, statusMessage: undefined }
              : cartItem
          ),
          checkoutComplete: false,
        };
      }

      // For new items, check if we can add at least 1 unit
      if (availableStock < 1) {
        return {
          ...state,
          cart: [...state.cart, { product: action.product, quantity: 1, status: 'failed' as const, statusMessage: action.zeroStockMessage }],
          checkoutComplete: false,
        };
      }

      return {
        ...state,
        cart: [...state.cart, { product: action.product, quantity: 1 }],
        checkoutComplete: false,
      };
    }

    case 'UPDATE_CART_ITEM_QUANTITY': {
      const item = state.cart[action.index];
      const newQuantity = item.quantity + action.delta;
      const availableStock = item.product.fields['Current Stock Level'] ?? 0;

      // If removing items (negative delta), allow it
      if (action.delta < 0) {
        if (newQuantity <= 0) {
          // Remove item from cart - create new array without the item
          return {
            ...state,
            cart: state.cart.filter((_, i) => i !== action.index),
          };
        }
        // Create new item object with updated quantity (immutable update)
        return {
          ...state,
          cart: state.cart.map((cartItem, i) =>
            i === action.index
              ? { ...cartItem, quantity: newQuantity, status: 'idle' as const, statusMessage: undefined }
              : cartItem
          ),
        };
      }
      // If adding items (positive delta), check stock availability
      if (action.delta > 0) {
        if (newQuantity > availableStock) {
          // Prevent update and show error (immutable update)
          return {
            ...state,
            cart: state.cart.map((cartItem, i) =>
              i === action.index
                ? {
                    ...cartItem,
                    status: 'failed' as const,
                    statusMessage: action.errorMessage || `Cannot add more. Only ${availableStock} unit(s) available in stock.`,
                  }
                : cartItem
            ),
          };
        }
        // Allow update (immutable update)
        return {
          ...state,
          cart: state.cart.map((cartItem, i) =>
            i === action.index
              ? { ...cartItem, quantity: newQuantity, status: 'idle' as const, statusMessage: undefined }
              : cartItem
          ),
        };
      }

      return state;
    }

    case 'SET_CART':
      return {
        ...state,
        cart: action.cart,
      };

    case 'CLEAR_CART':
      return {
        ...state,
        cart: [],
      };

    case 'START_CHECKOUT':
      return {
        ...state,
        isCheckingOut: true,
        checkoutComplete: false,
      };

    case 'COMPLETE_CHECKOUT':
      return {
        ...state,
        isCheckingOut: false,
        checkoutComplete: true,
        cart: [],
      };

    case 'CANCEL_CHECKOUT':
      return {
        ...state,
        isCheckingOut: false,
      };

    // Scanner actions
    case 'SET_SCANNED_CODE':
      return {
        ...state,
        scannedCode: action.code,
        barcodeSource: action.source || null,
      };

    case 'SET_MANUAL_CODE':
      return {
        ...state,
        manualCode: action.code,
      };

    case 'TOGGLE_SCANNER':
      return {
        ...state,
        showScanner: !state.showScanner,
      };

    case 'SET_SHOW_SCANNER':
      return {
        ...state,
        showScanner: action.show,
      };

    // Lookup actions
    case 'REQUEST_LOOKUP':
      return {
        ...state,
        lookupRequested: true,
        lookupError: null,
      };

    case 'LOOKUP_SUCCESS':
      return {
        ...state,
        scannedCode: null,
        lookupRequested: false,
        lookupError: null,
        manualCode: '',
      };

    case 'LOOKUP_ERROR':
      return {
        ...state,
        scannedCode: null,
        lookupRequested: false,
        lookupError: action.error,
      };

    case 'CLEAR_LOOKUP_ERROR':
      return {
        ...state,
        lookupError: null,
      };

    case 'RESET_LOOKUP':
      return {
        ...state,
        lookupRequested: false,
      };

    // UI actions
    case 'TOGGLE_CART_EXPANDED':
      return {
        ...state,
        isCartExpanded: !state.isCartExpanded,
      };

    case 'SET_CART_EXPANDED':
      return {
        ...state,
        isCartExpanded: action.expanded,
      };

    case 'SHOW_CONFIRM_DIALOG':
      return {
        ...state,
        showConfirmDialog: true,
        confirmDialogMessage: action.message,
      };

    case 'HIDE_CONFIRM_DIALOG':
      return {
        ...state,
        showConfirmDialog: false,
        confirmDialogMessage: '',
      };

    case 'SHOW_REVIEW_MODAL':
      return {
        ...state,
        showReviewModal: true,
      };

    case 'HIDE_REVIEW_MODAL':
      return {
        ...state,
        showReviewModal: false,
      };

    default:
      return state;
  }
}

function CheckoutPage({ onBack }: CheckoutPageProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(checkoutReducer, initialState);
  const [inputMode, setInputMode] = useState<InputMode>('search');
  const { addRecentProduct } = useRecentProducts();

  // Hook for looking up products
  const { data: product, isLoading, error } = useProductLookup(state.scannedCode);
  const isPendingLookup = isLoading || state.lookupRequested;

  // Track which barcode we've already processed to prevent double-adds from StrictMode
  const processedBarcodeRef = useRef<string | null>(null);

  // Sound effect helper
  const playSound = useCallback((type: 'success' | 'error') => {
    // Placeholder for sound logic. In a real PWA we'd use Audio()
    if (navigator.vibrate) {
      navigator.vibrate(type === 'success' ? 100 : [100, 50, 100]);
    }
  }, []);

  useEffect(() => {
    if (!state.scannedCode) return;

    // Prevent double-processing from React StrictMode or re-renders
    if (processedBarcodeRef.current === state.scannedCode) {
      return;
    }

    // Product found successfully
    if (product) {
      // Check if product already exists in cart to show appropriate toast
      const existingItem = state.cart.find(item => item.product.id === product.id);
      const isNewItem = !existingItem;
      const newQuantity = existingItem ? existingItem.quantity + 1 : 1;
      const availableStock = product.fields['Current Stock Level'] ?? 0;

      // Validate stock availability before adding to cart
      // Note: This is client-side validation against cached stock data.
      // For absolute accuracy with concurrent checkouts, a backend proxy should validate this.
      if (newQuantity > availableStock) {
        playSound('error');
        toast.error(t('cart.insufficientStock', { available: availableStock }), {
          description: t('cart.insufficientStockDescription', {
            name: product.fields.Name,
            requested: newQuantity,
            available: availableStock
          }),
        });
        dispatch({ type: 'LOOKUP_SUCCESS' });
        return;
      }

      // Mark this barcode as processed BEFORE dispatching to prevent re-entry
      processedBarcodeRef.current = state.scannedCode;

      dispatch({
        type: 'ADD_TO_CART',
        product,
        insufficientStockMessage: t('cart.insufficientStock', { available: availableStock }),
        zeroStockMessage: t('cart.zeroStock'),
      });
      playSound('success');

      // Show toast notification
      if (isNewItem) {
        toast.success(t('cart.itemAdded'), {
          description: t('cart.itemAddedDescription', { name: product.fields.Name }),
        });
      } else {
        toast.success(t('cart.quantityUpdated'), {
          description: t('cart.quantityUpdatedDescription', {
            name: product.fields.Name,
            quantity: newQuantity
          }),
        });
      }

      dispatch({ type: 'LOOKUP_SUCCESS' });
      // Auto-collapse cart on mobile ONLY if barcode came from scanner, not QuickAdd
      if (state.barcodeSource === 'scanner') {
        dispatch({ type: 'SET_CART_EXPANDED', expanded: false });
      }
      // Clear the ref after LOOKUP_SUCCESS clears scannedCode, so we can re-scan same barcode
      processedBarcodeRef.current = null;
      return;
    }

    // Product not found (null returned, no error)
    if (!isLoading && !product && !error) {
      processedBarcodeRef.current = state.scannedCode; // Mark as processed even for errors
      playSound('error');
      logger.warn('Product not found in checkout', {
        barcode: state.scannedCode,
        timestamp: new Date().toISOString(),
      });
      dispatch({ type: 'LOOKUP_ERROR', error: t('toast.productNotFound') });
      return;
    }

    // Network or API error
    if (error) {
      playSound('error');

      // Log error with context for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Product lookup failed', {
        barcode: state.scannedCode,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        timestamp: new Date().toISOString(),
      });

      // Classify error and show user-facing feedback
      let userMessage = t('toast.productNotFound');
      if (errorMessage.toLowerCase().includes('network') ||
          errorMessage.toLowerCase().includes('fetch') ||
          errorMessage.toLowerCase().includes('timeout')) {
        userMessage = t('toast.networkError');
      } else if (errorMessage.toLowerCase().includes('unauthorized') ||
                 errorMessage.toLowerCase().includes('authentication')) {
        userMessage = t('toast.authError');
      }

      dispatch({ type: 'LOOKUP_ERROR', error: userMessage });
    }
  // Note: state.cart is intentionally NOT in deps - cart updates should not re-trigger this effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, isLoading, playSound, product, state.scannedCode, state.barcodeSource, t]);

  /**
   * Handles successful barcode scan by initiating product lookup
   * - Only processes if no scan is currently in progress
   * - Sets scan code and requests lookup via useProductLookup hook
   * @param code - Scanned barcode value
   * @param source - Where the barcode came from ('scanner' or 'quick-add')
   */
  const handleScanSuccess = (code: string, source: 'scanner' | 'quick-add' = 'scanner') => {
    if (!state.scannedCode && !isPendingLookup) {
      dispatch({ type: 'SET_SCANNED_CODE', code, source });
      dispatch({ type: 'REQUEST_LOOKUP' });
    }
  };

  useEffect(() => {
    if (!state.scannedCode && !isLoading && state.lookupRequested) {
      dispatch({ type: 'RESET_LOOKUP' });
    }
  }, [isLoading, state.lookupRequested, state.scannedCode]);

  const handleManualSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.manualCode.trim().length > 3 && !isPendingLookup) {
      handleScanSuccess(state.manualCode.trim());
      dispatch({ type: 'SET_MANUAL_CODE', code: '' });
    }
  };

  /**
   * Handles product selection from search dropdown
   * - Directly adds product to cart without barcode lookup
   * - Shows appropriate toast notifications
   * @param product - Product selected from search
   */
  const handleProductSelect = (selectedProduct: Product) => {
    // Check if product already exists in cart to show appropriate toast
    const existingItem = state.cart.find(item => item.product.id === selectedProduct.id);
    const isNewItem = !existingItem;
    const newQuantity = existingItem ? existingItem.quantity + 1 : 1;
    const availableStock = selectedProduct.fields['Current Stock Level'] ?? 0;

    // Validate stock availability before adding to cart
    if (newQuantity > availableStock) {
      playSound('error');
      toast.error(t('cart.insufficientStock', { available: availableStock }), {
        description: t('cart.insufficientStockDescription', {
          name: selectedProduct.fields.Name,
          requested: newQuantity,
          available: availableStock
        }),
      });
      return;
    }

    dispatch({
      type: 'ADD_TO_CART',
      product: selectedProduct,
      insufficientStockMessage: t('cart.insufficientStock', { available: availableStock }),
      zeroStockMessage: t('cart.zeroStock'),
    });
    playSound('success');

    // Track as recent product for quick add
    addRecentProduct(selectedProduct.id);

    // Show toast notification
    if (isNewItem) {
      toast.success(t('cart.itemAdded'), {
        description: t('cart.itemAddedDescription', { name: selectedProduct.fields.Name }),
      });
    } else {
      toast.success(t('cart.quantityUpdated'), {
        description: t('cart.quantityUpdatedDescription', {
          name: selectedProduct.fields.Name,
          quantity: newQuantity
        }),
      });
    }

    // Vibrate for feedback
    if (navigator.vibrate) navigator.vibrate(100);
  };

  /**
   * Updates quantity for a cart item by the given delta
   * - Validates stock availability before allowing increases
   * - Removes item if quantity reaches zero
   * - Resets item status to 'idle' to allow re-checkout
   * @param index - Cart item index
   * @param delta - Quantity change (+1 or -1)
   */
  const updateQuantity = (index: number, delta: number) => {
    // Pre-check stock availability for increases to provide translated error message
    if (delta > 0) {
      const item = state.cart[index];
      const newQuantity = item.quantity + delta;
      const availableStock = item.product.fields['Current Stock Level'] ?? 0;

      if (newQuantity > availableStock) {
        const errorMessage = t('cart.insufficientStock', { available: availableStock });
        dispatch({ type: 'UPDATE_CART_ITEM_QUANTITY', index, delta, errorMessage });
        return;
      }
    }

    dispatch({ type: 'UPDATE_CART_ITEM_QUANTITY', index, delta });
  };


  const pendingItems = state.cart.filter((item) => item.status !== 'success');

  /**
   * Calculates cart totals by summing prices of all items with valid pricing
   * @returns Object containing total price and count of items missing price data
   */
  const calculateTotals = () => {
    return pendingItems.reduce(
      (result, item) => {
        const price = item.product.fields.Price;
        if (price != null) {
          result.total += price * item.quantity;
        } else {
          result.missingPrices += 1;
        }
        return result;
      },
      { total: 0, missingPrices: 0 }
    );
  };

  /**
   * Shows review modal before processing checkout
   * Validates stock availability first
   */
  const handleCheckoutClick = () => {
    if (pendingItems.length === 0) return;

    // Validate stock availability for all items
    const itemsWithInsufficientStock: Array<{ name: string; quantity: number; available: number }> = [];

    for (const item of pendingItems) {
      const availableStock = item.product.fields['Current Stock Level'] ?? 0;
      if (item.quantity > availableStock) {
        itemsWithInsufficientStock.push({
          name: item.product.fields.Name,
          quantity: item.quantity,
          available: availableStock
        });
      }
    }

    // If any items have insufficient stock, show error and prevent checkout
    if (itemsWithInsufficientStock.length > 0) {
      const errorMessages = itemsWithInsufficientStock
        .map(item => `• ${item.name}: ${t('checkout.needsQuantity', { quantity: item.quantity, available: item.available })}`)
        .join('\n');

      toast.error(t('checkout.insufficientStockTitle'), {
        description: t('checkout.insufficientStockDescription', { count: itemsWithInsufficientStock.length }) + '\n\n' + errorMessages,
        duration: 6000, // Show longer for multiple items
      });

      return;
    }

    // Show review modal instead of confirm dialog
    dispatch({ type: 'SHOW_REVIEW_MODAL' });
  };

  /**
   * Confirms checkout directly from review modal (no separate confirm dialog)
   */
  const handleConfirmFromReview = async () => {
    dispatch({ type: 'HIDE_REVIEW_MODAL' });
    await handleCheckoutConfirm();
  };

  /**
   * Processes checkout by creating stock movements for all cart items
   * - Processes each item sequentially to create OUT stock movements
   * - Handles errors with user-friendly messages and detailed logging
   * - Updates cart status for each item (success/failed)
   * - Clears cart on complete success or shows status summary on partial failure
   */
  const handleCheckoutConfirm = async () => {
    dispatch({ type: 'HIDE_CONFIRM_DIALOG' });
    dispatch({ type: 'START_CHECKOUT' });

    const processingCart = state.cart.map((item): CartItem =>
      item.status === 'success' ? item : { ...item, status: 'processing' as const, statusMessage: undefined },
    );
    dispatch({ type: 'SET_CART', cart: processingCart });

    const results: CartItem[] = [];
    const itemsToProcess = processingCart.filter((item) => item.status === 'processing');

    for (const item of itemsToProcess) {
      try {
        await addStockMovement(item.product.id, item.quantity, 'OUT');
        results.push({ ...item, status: 'success' });
      } catch (err) {
        let userMessage = t('errors.unknownError');

        if (err instanceof ValidationError) {
          userMessage = t('toast.validationError');
        } else if (err instanceof NetworkError) {
          userMessage = t('toast.networkError');
        } else if (err instanceof AuthorizationError) {
          userMessage = t('toast.authorizationError');
        } else if (err instanceof Error) {
          userMessage = err.message;
        }

        results.push({ ...item, status: 'failed', statusMessage: userMessage });

        // Log with full context for debugging
        logger.error('Checkout failed for item', {
          productId: item.product.id,
          productName: item.product.fields.Name,
          quantity: item.quantity,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorType: err instanceof Error ? err.constructor.name : typeof err,
          errorStack: err instanceof Error ? err.stack : undefined,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Use processingCart instead of stale cart variable
    const priorSuccesses = processingCart.filter(
      (item) => item.status === 'success' && !itemsToProcess.find((p) => p.product.id === item.product.id),
    );
    const mergedResults = [...priorSuccesses, ...results];

    const failedItems = mergedResults.filter((item) => item.status === 'failed');

    // Batch all state updates at the end
    if (failedItems.length === 0 && mergedResults.length > 0) {
      dispatch({ type: 'COMPLETE_CHECKOUT' });
      playSound('success');

      // Invalidate all related caches to ensure fresh data after checkout
      // - Product list queries (prefix match for any products query)
      // - Individual product lookups
      // - Stock movement history
      queryClient.invalidateQueries({ queryKey: ['products'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['product'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'], exact: false });

      logger.info('Checkout completed successfully, related caches invalidated', {
        itemsProcessed: mergedResults.length,
        timestamp: new Date().toISOString(),
      });
    } else {
      dispatch({ type: 'SET_CART', cart: mergedResults });
      dispatch({ type: 'CANCEL_CHECKOUT' });
      playSound('error');
    }
  };

  const { total, missingPrices } = calculateTotals();

  if (state.checkoutComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircleIcon className="h-12 w-12 text-emerald-700" />
        </div>
        <h2 className="text-3xl font-semibold text-gray-900 mb-2">{t('checkout.complete')}</h2>
        <p className="text-gray-600 mb-8">{t('checkout.stockUpdated')}</p>
        <Button
          onClick={onBack}
          variant="outline"
          className="px-8 py-3"
        >
          {t('checkout.backToHome')}
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden flex flex-col">
        <PageHeader
          title={t('checkout.title')}
          onBack={onBack}
          variant="compact"
        />

        {/* Input Section - Hidden when cart is expanded on mobile */}
        {/* Uses flex-1 with overflow to fit above cart toggle (approx 100px) */}
        {!state.isCartExpanded && (
          <div className="flex-1 px-4 pt-3 pb-[110px] overflow-y-auto flex flex-col gap-3">
            {/* Progress Indicator - At top, centered */}
            <CheckoutProgress currentStep={state.showReviewModal ? 'review' : 'scan'} />

            {/* Mode Toggle */}
            <div className="flex justify-center">
              <InputModeToggle mode={inputMode} onModeChange={setInputMode} />
            </div>

            {/* Search Mode */}
            {inputMode === 'search' && (
              <div className="w-full space-y-4">
                <ProductSearchDropdown
                  onProductSelect={handleProductSelect}
                  placeholder={t('search.checkoutPlaceholder', 'Search to add to cart...')}
                  autoFocus
                />

                {/* Browse by Category - One-tap product selection */}
                <ProductBrowsePanel
                  onProductSelect={handleProductSelect}
                  maxHeight="calc(100dvh - 380px)"
                />
              </div>
            )}

            {/* Scan Mode */}
            {inputMode === 'scan' && (
              <ScannerFrame
                scannerId="mobile-reader"
                onScanSuccess={handleScanSuccess}
                manualCode={state.manualCode}
                onManualCodeChange={(code) => dispatch({ type: 'SET_MANUAL_CODE', code })}
                onManualSubmit={handleManualSubmit}
                isPending={isPendingLookup}
                error={state.lookupError}
                onClearError={() => dispatch({ type: 'CLEAR_LOOKUP_ERROR' })}
                size="small"
              />
            )}
          </div>
        )}

        {/* Cart Toggle/Collapse */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white transition-all duration-300 ease-in-out z-20 ${
            state.isCartExpanded ? 'h-[calc(100dvh-50px)] rounded-t-3xl' : 'h-auto rounded-t-3xl'
          }`}
        >
          {/* Toggle Button */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <Button
              onClick={() => dispatch({ type: 'TOGGLE_CART_EXPANDED' })}
              size="icon"
              className="h-12 w-12 rounded-full bg-stone-900 hover:bg-stone-800 text-white shadow-lg"
            >
              {state.isCartExpanded ? <ChevronDown className="h-6 w-6" /> : <ChevronUp className="h-6 w-6" />}
            </Button>
          </div>

          {/* Collapsed Cart Summary */}
          {!state.isCartExpanded && (
            <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => dispatch({ type: 'SET_CART_EXPANDED', expanded: true })}>
              <div className="flex items-center gap-3">
                <ShoppingCartIcon className="h-6 w-6 text-stone-900" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{t('cart.title')}</h3>
                  <p className="text-sm text-gray-600">{state.cart.length} {t('cart.items')}</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-stone-900">
                € {total.toFixed(2)}
              </div>
            </div>
          )}

          {/* Expanded Cart */}
          {state.isCartExpanded && (
            <div className="h-full flex flex-col">
              <Cart
                cart={state.cart}
                total={total}
                isCheckingOut={state.isCheckingOut}
                onUpdateQuantity={updateQuantity}
                customFooter={
                  <div className="p-6 pt-4 border-t border-gray-200 space-y-4">
                    <div className="space-y-2">
                      <Button
                        className="w-full h-10 text-base font-semibold bg-stone-900 hover:bg-stone-800 text-white disabled:bg-stone-400"
                        onClick={handleCheckoutClick}
                        disabled={pendingItems.length === 0 || state.isCheckingOut}
                      >
                        {state.isCheckingOut ? t('cart.processing') : t('cart.completeCheckout')}
                      </Button>
                      {pendingItems.length === 0 && !state.isCheckingOut && (
                        <p className="text-xs text-stone-500 text-center">
                          {t('cart.emptyCheckoutHint', 'Scan products to add them to your cart')}
                        </p>
                      )}
                    </div>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Tablet/Desktop View - New Scanner UI with visible cart */}
      <div className="hidden lg:block fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
        <PageHeader
          title={t('checkout.title')}
          onBack={onBack}
          variant="compact"
        />

        {/* Two Column Layout - Header is 50px */}
        <div className="flex flex-row gap-6 h-[calc(100dvh-50px)] px-6 py-6">
          {/* Left Column: Stepper → Toggle → Search/Scanner */}
          <div className="w-[48%] flex flex-col gap-6">
            {/* Progress Indicator - At top, centered */}
            <CheckoutProgress currentStep={state.showReviewModal ? 'review' : 'scan'} />

            {/* Mode Toggle */}
            <div className="flex justify-center">
              <InputModeToggle mode={inputMode} onModeChange={setInputMode} />
            </div>

            {/* Search Mode */}
            {inputMode === 'search' && (
              <div className="w-full space-y-4 flex-1 flex flex-col min-h-0">
                <ProductSearchDropdown
                  onProductSelect={handleProductSelect}
                  placeholder={t('search.checkoutPlaceholder', 'Search to add to cart...')}
                  autoFocus
                />

                {/* Browse by Category - One-tap product selection */}
                <div className="flex-1 min-h-0">
                  <ProductBrowsePanel
                    onProductSelect={handleProductSelect}
                    maxHeight="calc(100dvh - 320px)"
                  />
                </div>
              </div>
            )}

            {/* Scan Mode */}
            {inputMode === 'scan' && (
              <ScannerFrame
                scannerId="desktop-reader"
                onScanSuccess={handleScanSuccess}
                manualCode={state.manualCode}
                onManualCodeChange={(code) => dispatch({ type: 'SET_MANUAL_CODE', code })}
                onManualSubmit={handleManualSubmit}
                isPending={isPendingLookup}
                error={state.lookupError}
                onClearError={() => dispatch({ type: 'CLEAR_LOOKUP_ERROR' })}
                size="small"
              />
            )}
          </div>

          {/* Right Column: Cart */}
          <div className="w-[48%] bg-white rounded-2xl flex flex-col overflow-hidden shadow-lg">
            <Cart
              cart={state.cart}
              total={total}
              isCheckingOut={state.isCheckingOut}
              onUpdateQuantity={updateQuantity}
              customFooter={
                <div className="p-6 pt-4 border-t border-gray-200 space-y-4">
                  {/* Total */}
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-lg font-semibold text-gray-700">{t('cart.total')}</span>
                    <span className="text-3xl font-bold text-gray-900">€ {total.toFixed(2)}</span>
                  </div>

                  {/* Action Button - No "Next Product" on desktop since scanner is always visible */}
                  <div className="space-y-3">
                    <Button
                      className="w-full h-12 text-base font-semibold bg-stone-900 hover:bg-stone-800 text-white disabled:bg-stone-400"
                      onClick={handleCheckoutClick}
                      disabled={pendingItems.length === 0 || state.isCheckingOut}
                    >
                      {state.isCheckingOut ? t('cart.processing') : t('cart.completeCheckout')}
                    </Button>
                    {pendingItems.length === 0 && !state.isCheckingOut && (
                      <p className="text-xs text-stone-500 text-center">
                        {t('cart.emptyCheckoutHint', 'Scan products to add them to your cart')}
                      </p>
                    )}
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </div>

      {/* Review Order Modal - Full Screen */}
      <Dialog open={state.showReviewModal} onOpenChange={(open) => !open && dispatch({ type: 'HIDE_REVIEW_MODAL' })}>
        <DialogContent
          className="!fixed !inset-0 !left-0 !top-0 !right-0 !bottom-0 w-full h-full !max-w-full !max-h-full !translate-x-0 !translate-y-0 p-0 gap-0 !rounded-none relative sm:!inset-0 sm:!left-0 sm:!top-0 sm:!translate-x-0 sm:!translate-y-0 sm:!max-w-full sm:!rounded-none"
        >
          <div className="h-full flex flex-col overflow-hidden">
            <DialogHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200 px-6 py-6 flex-shrink-0">
              <DialogTitle className="text-2xl font-bold text-stone-900">{t('checkout.reviewTitle')}</DialogTitle>
              <DialogDescription className="text-stone-600">
                {t('checkout.reviewSubtitle')}
              </DialogDescription>
            </DialogHeader>

            {/* Items List */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
              <div className="max-w-2xl mx-auto space-y-3">
                {pendingItems.map((item, index) => {
                  const imageUrl = item.product.fields.Image?.[0]?.url;
                  const price = item.product.fields.Price;
                  return (
                    <div key={`${item.product.id}-${index}`} className="flex items-center gap-4 p-4 bg-stone-50 rounded-xl border-2 border-stone-200">
                      {/* Product Image */}
                      <div className="w-16 h-16 rounded-xl bg-stone-100 flex items-center justify-center overflow-hidden shrink-0 border border-stone-200">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.product.fields.Name} className="w-full h-full object-cover" />
                        ) : (
                          <BoxIcon className="h-8 w-8 text-stone-400" />
                        )}
                      </div>
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-stone-900 text-lg truncate">{item.product.fields.Name}</h4>
                        <p className="text-sm text-stone-500">
                          {t('checkout.itemsCount', { count: item.quantity })}
                          {price != null && ` × €${price.toFixed(2)}`}
                        </p>
                      </div>
                      {/* Item Total */}
                      <div className="text-right shrink-0">
                        {price != null ? (
                          <span className="font-bold text-stone-900 text-xl">€{(price * item.quantity).toFixed(2)}</span>
                        ) : (
                          <span className="text-sm text-stone-400">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals Section & Footer */}
            <div className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-t-2 border-stone-200 px-6 py-6 flex-shrink-0">
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Warning for missing prices */}
                {missingPrices > 0 && (
                  <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-700 text-sm font-medium">
                    ⚠️ {t('checkout.missingPrices', { count: missingPrices })} - {t('checkout.confirmMessageWithMissing', { count: pendingItems.length, total: `€${total.toFixed(2)}`, missing: missingPrices }).split('.').slice(-1)[0].trim()}
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-stone-700">{t('checkout.subtotal')}</span>
                  <span className="text-2xl font-bold text-stone-900">€{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t-2 border-stone-200">
                  <span className="text-xl font-bold text-stone-900">{t('checkout.grandTotal')}</span>
                  <span className="text-3xl font-bold text-[var(--color-forest)]">€{total.toFixed(2)}</span>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => dispatch({ type: 'HIDE_REVIEW_MODAL' })}
                    className="flex-1 border-2 border-stone-300 hover:bg-stone-100 font-semibold h-12"
                  >
                    {t('checkout.editCart')}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmFromReview}
                    disabled={state.isCheckingOut}
                    className="flex-1 bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white font-bold h-12 shadow-md"
                  >
                    {state.isCheckingOut ? t('cart.processing') : t('checkout.confirm')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Confirmation Dialog */}
      <Dialog open={state.showConfirmDialog} onOpenChange={(open) => !open && dispatch({ type: 'HIDE_CONFIRM_DIALOG' })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-stone-900">{t('checkout.confirmTitle')}</DialogTitle>
            <DialogDescription className="text-stone-600">
              {state.confirmDialogMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => dispatch({ type: 'HIDE_CONFIRM_DIALOG' })}
              className="flex-1 sm:flex-none"
            >
              {t('checkout.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleCheckoutConfirm}
              className="flex-1 sm:flex-none bg-stone-900 hover:bg-stone-800 text-white"
            >
              {t('checkout.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CheckoutPage;
