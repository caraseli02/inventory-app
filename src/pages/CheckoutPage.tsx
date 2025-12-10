import { useCallback, useEffect, useReducer, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ScannerFrame } from '../components/scanner/ScannerFrame';
import { Cart } from '../components/cart/Cart';
import { QuickAddSection } from '../components/cart/QuickAddSection';
import { PageHeader } from '../components/ui/PageHeader';
import { useProductLookup } from '../hooks/useProductLookup';
import { addStockMovement, ValidationError, NetworkError, AuthorizationError } from '../lib/api';
import type { CartItem, Product } from '../types';
import { logger } from '../lib/logger';
import {
  CheckCircleIcon,
  ShoppingCartIcon,
} from '../components/ui/Icons';
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
}

/**
 * Actions for CheckoutPage reducer
 */
type CheckoutAction =
  // Cart actions
  | { type: 'ADD_TO_CART'; product: Product }
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
  | { type: 'HIDE_CONFIRM_DIALOG' };

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
        const newCart = [...state.cart];
        const item = newCart[existingItemIndex];
        const newQuantity = item.quantity + 1;

        // Validate stock before allowing increase
        if (newQuantity > availableStock) {
          item.status = 'failed';
          item.statusMessage = `Cannot add more. Only ${availableStock} unit(s) available in stock.`;
          return {
            ...state,
            cart: newCart,
            checkoutComplete: false,
          };
        }

        // Stock available, allow increase
        item.quantity = newQuantity;
        item.status = undefined;
        item.statusMessage = undefined;
        return {
          ...state,
          cart: newCart,
          checkoutComplete: false,
        };
      }

      // For new items, check if we can add at least 1 unit
      if (availableStock < 1) {
        return {
          ...state,
          cart: [...state.cart, { product: action.product, quantity: 1, status: 'failed' as const, statusMessage: `Cannot add. Item has 0 stock.` }],
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
      const newCart = [...state.cart];
      const item = newCart[action.index];
      const newQuantity = item.quantity + action.delta;
      const availableStock = item.product.fields['Current Stock Level'] ?? 0;

      // If removing items (negative delta), allow it
      if (action.delta < 0) {
        if (newQuantity <= 0) {
          newCart.splice(action.index, 1);
        } else {
          item.quantity = newQuantity;
          item.status = 'idle';
          item.statusMessage = undefined;
        }
      }
      // If adding items (positive delta), check stock availability
      else if (action.delta > 0) {
        if (newQuantity > availableStock) {
          // Prevent update and show error (use provided message or fallback)
          item.status = 'failed';
          item.statusMessage = action.errorMessage || `Cannot add more. Only ${availableStock} unit(s) available in stock.`;
        } else {
          // Allow update
          item.quantity = newQuantity;
          item.status = 'idle';
          item.statusMessage = undefined;
        }
      }

      return {
        ...state,
        cart: newCart,
      };
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

    default:
      return state;
  }
}

const CheckoutPage = ({ onBack }: CheckoutPageProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(checkoutReducer, initialState);

  // Hook for looking up products
  const { data: product, isLoading, error } = useProductLookup(state.scannedCode);
  const isPendingLookup = isLoading || state.lookupRequested;

  // Sound effect helper
  const playSound = useCallback((type: 'success' | 'error') => {
    // Placeholder for sound logic. In a real PWA we'd use Audio()
    if (navigator.vibrate) {
      navigator.vibrate(type === 'success' ? 100 : [100, 50, 100]);
    }
  }, []);

  useEffect(() => {
    if (!state.scannedCode) return;

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

      dispatch({ type: 'ADD_TO_CART', product });
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
      return;
    }

    // Product not found (null returned, no error)
    if (!isLoading && !product && !error) {
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
  }, [error, isLoading, playSound, product, state.scannedCode, state.barcodeSource, state.cart, t]);

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

  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.manualCode.trim().length > 3 && !isPendingLookup) {
      handleScanSuccess(state.manualCode.trim());
      dispatch({ type: 'SET_MANUAL_CODE', code: '' });
    }
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
   * Shows confirmation dialog before processing checkout
   * Validates stock availability and calculates total
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

    const { total, missingPrices } = calculateTotals();
    const totalLabel = `€${total.toFixed(2)}`;
    const confirmMessage = missingPrices
      ? t('checkout.confirmMessageWithMissing', { count: pendingItems.length, total: totalLabel, missing: missingPrices })
      : t('checkout.confirmMessage', { count: pendingItems.length, total: totalLabel });

    dispatch({ type: 'SHOW_CONFIRM_DIALOG', message: confirmMessage });
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

  const { total } = calculateTotals();

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
      <div className="lg:hidden fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
        <PageHeader
          title={t('checkout.title')}
          onBack={onBack}
          variant="compact"
        />

        {/* Scanner Section - Hidden when cart is expanded on mobile */}
        {!state.isCartExpanded && (
          <div className="px-6 pt-4">
            <ScannerFrame
              scannerId="mobile-reader"
              onScanSuccess={handleScanSuccess}
              manualCode={state.manualCode}
              onManualCodeChange={(code) => dispatch({ type: 'SET_MANUAL_CODE', code })}
              onManualSubmit={handleManualSubmit}
              isPending={isPendingLookup}
              error={state.lookupError}
              onClearError={() => dispatch({ type: 'CLEAR_LOOKUP_ERROR' })}
            />
          </div>
        )}

        {/* Cart Toggle/Collapse */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white transition-all duration-300 ease-in-out z-20 ${
            state.isCartExpanded ? 'h-[calc(100dvh-73px)] rounded-t-3xl' : 'h-auto rounded-t-3xl'
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
                    {/* Quick Add Section */}
                    <QuickAddSection
                      onAddItem={(code) => handleScanSuccess(code, 'quick-add')}
                      isPending={isPendingLookup}
                    />

                    {/* Total */}
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-lg font-semibold text-gray-700">{t('cart.total')}</span>
                      <span className="text-3xl font-bold text-gray-900">€ {total.toFixed(2)}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        className="w-full h-10 text-base font-medium border-2 hover:bg-gray-50"
                        onClick={() => dispatch({ type: 'SET_CART_EXPANDED', expanded: false })}
                      >
                        {t('cart.nextProduct')}
                      </Button>

                      <Button
                        className="w-full h-10 text-base font-semibold bg-stone-900 hover:bg-stone-800 text-white"
                        onClick={handleCheckoutClick}
                        disabled={pendingItems.length === 0 || state.isCheckingOut}
                      >
                        {state.isCheckingOut ? t('cart.processing') : t('cart.completeCheckout')}
                      </Button>
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

        {/* Two Column Layout */}
        <div className="flex flex-row gap-6 h-[calc(100dvh-72px)] px-6 py-6">
          {/* Left Column: Scanner (~30% width reduction from original 45%) */}
          <div className="w-[32%] flex flex-col gap-4">
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
          </div>

          {/* Right Column: Cart (expanded to use more space) */}
          <div className="w-[65%] bg-white rounded-2xl flex flex-col overflow-hidden shadow-lg">
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

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full h-10 text-base font-medium border-2 hover:bg-gray-50"
                      onClick={() => dispatch({ type: 'SET_SHOW_SCANNER', show: true })}
                    >
                      {t('cart.nextProduct')}
                    </Button>

                    <Button
                      className="w-full h-10 text-base font-semibold bg-stone-900 hover:bg-stone-800 text-white"
                      onClick={handleCheckoutClick}
                      disabled={pendingItems.length === 0 || state.isCheckingOut}
                    >
                      {state.isCheckingOut ? t('cart.processing') : t('cart.completeCheckout')}
                    </Button>
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </div>

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
