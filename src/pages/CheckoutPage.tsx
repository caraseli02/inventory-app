import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Scanner from '../components/scanner/Scanner';
import { useProductLookup } from '../hooks/useProductLookup';
import { addStockMovement, ValidationError, NetworkError, AuthorizationError } from '../lib/api';
import type { CartItem } from '../types';
import { logger } from '../lib/logger';
import {
  ArrowLeftIcon,
  BoxIcon,
  CheckCircleIcon,
  CloseIcon,
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  WarningIcon,
} from '../components/ui/Icons';

interface CheckoutPageProps {
  onBack: () => void;
}

const CheckoutPage = ({ onBack }: CheckoutPageProps) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [lookupRequested, setLookupRequested] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [statusSummary, setStatusSummary] = useState<{
    successes: number;
    failures: number;
  } | null>(null);

  // Hook for looking up products
  const { data: product, isLoading, error } = useProductLookup(scannedCode);
  const isPendingLookup = isLoading || lookupRequested;

  // Sound effect helper
  const playSound = useCallback((type: 'success' | 'error') => {
    // Placeholder for sound logic. In a real PWA we'd use Audio()
    if (navigator.vibrate) {
      navigator.vibrate(type === 'success' ? 100 : [100, 50, 100]);
    }
  }, []);

  useEffect(() => {
    if (!scannedCode) return;

    if (product) {
      setCart(prevCart => {
        const existingItemIndex = prevCart.findIndex(item => item.product.id === product.id);

        if (existingItemIndex >= 0) {
          const newCart = [...prevCart];
          newCart[existingItemIndex].quantity += 1;
          newCart[existingItemIndex].status = undefined;
          newCart[existingItemIndex].statusMessage = undefined;
          return newCart;
        }

        return [...prevCart, { product, quantity: 1 }];
      });

      setStatusSummary(null);
      setCheckoutComplete(false);
      setLookupError(null);  // Clear any previous lookup errors
      playSound('success');

      // Reset scan state immediately to allow rapid scanning
      setScannedCode(null);
      setLookupRequested(false);
      return;
    }

    if (error) {
      playSound('error');

      // Log error with context for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Product lookup failed', {
        barcode: scannedCode,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        timestamp: new Date().toISOString(),
      });

      // Classify error and show user-facing feedback
      let userMessage = 'Product not found. Check barcode and retry.';
      if (errorMessage.toLowerCase().includes('network') ||
          errorMessage.toLowerCase().includes('fetch') ||
          errorMessage.toLowerCase().includes('timeout')) {
        userMessage = 'Network error. Check your connection and try again.';
      } else if (errorMessage.toLowerCase().includes('unauthorized') ||
                 errorMessage.toLowerCase().includes('authentication')) {
        userMessage = 'Authentication failed. Check API credentials.';
      }

      setLookupError(userMessage);
      setScannedCode(null);
      setLookupRequested(false);
    }
  }, [error, playSound, product, scannedCode]);

  const handleScanSuccess = (code: string) => {
    if (!scannedCode && !isPendingLookup) {
      setScannedCode(code);
      setLookupRequested(true);
    }
  };

  useEffect(() => {
    if (!scannedCode && !isLoading && lookupRequested) {
      setLookupRequested(false);
    }
  }, [isLoading, lookupRequested, scannedCode]);

  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (manualCode.trim().length > 3 && !isPendingLookup) {
      handleScanSuccess(manualCode.trim());
      setManualCode('');
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    newCart[index].status = 'idle';
    newCart[index].statusMessage = undefined;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
    setStatusSummary(null);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
    setStatusSummary(null);
  };

  const pendingItems = cart.filter((item) => item.status !== 'success');

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

  const handleCheckout = async () => {
    if (pendingItems.length === 0) return;

    const { total, missingPrices } = calculateTotals();
    const totalLabel = `$${total.toFixed(2)}`;
    const confirmMessage = missingPrices
      ? `Complete checkout for ${pendingItems.length} items? Priced subtotal: ${totalLabel}. ${missingPrices} item${missingPrices > 1 ? 's are' : ' is'} missing price data and will be processed without totals.`
      : `Complete checkout for ${pendingItems.length} items? Total: ${totalLabel}`;

    const confirm = window.confirm(confirmMessage);
    if (!confirm) return;

    setIsCheckingOut(true);
    setCheckoutComplete(false);
    setStatusSummary(null);

    const processingCart = cart.map((item): CartItem =>
      item.status === 'success' ? item : { ...item, status: 'processing' as const, statusMessage: undefined },
    );
    setCart(processingCart);

    let successes = 0;
    let failures = 0;
    const results: CartItem[] = [];
    const itemsToProcess = processingCart.filter((item) => item.status === 'processing');

    for (const item of itemsToProcess) {
      try {
        await addStockMovement(item.product.id, item.quantity, 'OUT');
        successes += 1;
        results.push({ ...item, status: 'success' });
      } catch (err) {
        failures += 1;

        let userMessage = 'Unknown error. Please try again.';

        if (err instanceof ValidationError) {
          userMessage = 'Cannot reduce stock below zero. Adjust quantity and retry.';
        } else if (err instanceof NetworkError) {
          userMessage = 'Network error. Check connection and retry.';
        } else if (err instanceof AuthorizationError) {
          userMessage = 'Authorization failed. Contact support.';
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
    const totalSuccesses = successes + priorSuccesses.length;

    // Batch all state updates at the end
    setStatusSummary({ successes: totalSuccesses, failures });
    setCheckoutComplete(failedItems.length === 0 && mergedResults.length > 0);

    if (failedItems.length === 0 && mergedResults.length > 0) {
      setCart([]);
      playSound('success');
    } else {
      setCart(mergedResults);
      playSound('error');
    }

    setIsCheckingOut(false);
  };

  const { total, missingPrices } = calculateTotals();

  if (checkoutComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircleIcon className="h-12 w-12 text-emerald-700" />
        </div>
        <h2 className="text-3xl font-semibold text-gray-900 mb-2">Checkout Complete</h2>
        <p className="text-gray-600 mb-8">Stock has been updated for all items.</p>
        <button
          onClick={() => {
            setCheckoutComplete(false);
            onBack();
          }}
          className="bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 px-8 py-3 rounded-lg font-medium transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-5 lg:gap-8 h-[calc(100dvh-120px)] lg:h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-gray-200 bg-gray-50 px-5 py-4 text-xs text-gray-600 lg:hidden font-semibold">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Batch checkout
        </span>
        <span className="text-[11px] text-gray-500">Scan items, then mark paid to update stock.</span>
      </div>

      {/* Left Column: Scanner - 45% on desktop */}
      <div className="w-full lg:w-[45%] flex flex-col gap-3 lg:gap-5 shrink-0">
        <div className="flex justify-between items-center px-1">
          <button onClick={onBack} className="text-gray-700 hover:text-gray-900 flex items-center gap-2 text-sm bg-white border-2 border-gray-300 px-3 py-3 rounded-lg hover:bg-gray-50">
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
        </div>

        {/* Error Message - Inline display */}
        {lookupError && (
          <div className="bg-red-50 border-2 border-red-200 text-red-900 p-3 rounded-lg text-sm animate-in fade-in duration-200">
            <div className="flex items-start gap-2">
              <WarningIcon className="h-5 w-5 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold">Not Found</p>
                <p className="text-red-800 text-xs mt-1">{lookupError}</p>
              </div>
              <button
                onClick={() => setLookupError(null)}
                className="ml-auto text-red-600 hover:text-red-900 text-lg leading-none"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Scanner */}
        <div className={`transition-all duration-300 ${!showScanner && 'opacity-50'}`}>
          {showScanner ? (
            <div className="relative rounded-lg overflow-hidden border-2 border-gray-300 bg-black aspect-[4/3] lg:aspect-square w-full mx-auto max-w-sm lg:max-w-none shrink-0">
              <Scanner onScanSuccess={handleScanSuccess} />
              {isPendingLookup && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin h-10 w-10 border-4 border-gray-400 border-t-transparent rounded-full"></div>
                    <p className="text-white text-sm">Searching…</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowScanner(false)}
                disabled={isPendingLookup}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 text-gray-900 px-4 py-3 rounded-lg text-xs font-medium border-2 border-gray-300 whitespace-nowrap hover:bg-white"
              >
                {isPendingLookup ? 'Searching…' : 'Type Instead'}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-6 border-2 border-gray-200 aspect-[4/3] lg:aspect-square flex flex-col justify-center">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <label className="block text-gray-700 text-sm font-medium text-center">Barcode</label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-300 rounded-lg p-3 text-gray-900 text-center tracking-widest focus:border-gray-400 focus:ring-1 focus:ring-gray-900/20 outline-none text-sm"
                  autoFocus
                />
                <button type="submit" disabled={manualCode.length < 3 || isPendingLookup} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors">
                  {isPendingLookup ? 'Searching…' : 'Add Item'}
                </button>
              </form>
              <button onClick={() => setShowScanner(true)} className="mt-4 text-gray-600 hover:text-gray-900 text-sm text-center">Use Camera</button>
            </div>
          )}
        </div>

        <div className="hidden lg:block bg-gray-50 p-4 rounded-lg border-2 border-gray-200 text-center">
          <p className="text-sm text-gray-600">Scan items. Duplicates increase quantity.</p>
        </div>
      </div>

      {/* Right Column: Cart List - 55% on desktop */}
      <div className="flex-1 bg-white rounded-t-2xl lg:rounded-2xl border-2 border-gray-200 flex flex-col overflow-hidden relative lg:shadow-sm">
        {/* Cart Header */}
        <div className="p-6 border-b-2 border-gray-200 bg-gray-50 sticky top-0 z-20">
          <h2 className="text-lg font-bold text-gray-900 flex justify-between items-center gap-4">
            <span>Shopping Cart</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border-2 border-emerald-300 px-3 py-1.5 rounded-lg uppercase">
                {pendingItems.length} ready
              </span>
              <span className="text-xs font-bold text-gray-700 bg-gray-200 border border-gray-300 px-3 py-1.5 rounded-lg uppercase">{cart.length} total</span>
            </div>
          </h2>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 pb-28 lg:pb-5 lg:space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 min-h-[150px]">
              <ShoppingCartIcon className="h-12 w-12 opacity-20" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={`${item.product.id}-${index}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                {/* Image Thumb */}
                <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0 border-2 border-gray-300">
                  {item.product.fields.Image?.[0]?.url ? (
                    <img src={item.product.fields.Image[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg text-gray-400">
                      <BoxIcon className="h-5 w-5" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate text-base">{item.product.fields.Name}</h3>
                  <p className="text-gray-600 text-sm font-medium">
                    {item.product.fields.Price != null
                      ? `$${item.product.fields.Price.toFixed(2)}`
                      : 'No price'}
                  </p>
                  {item.status === 'processing' && (
                    <p className="text-xs text-blue-600 mt-1">Processing…</p>
                  )}
                  {item.status === 'success' && (
                    <p className="text-xs text-emerald-600 mt-1">Checked out</p>
                  )}
                  {item.status === 'failed' && (
                    <p className="text-xs text-red-600 mt-1">
                      Failed. {item.statusMessage || 'Adjust quantity and retry.'}
                    </p>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white border-2 border-gray-300 rounded-lg h-11">
                    <button onClick={() => updateQuantity(index, -1)} className="px-2 h-full hover:bg-gray-100 text-gray-700 flex items-center justify-center font-semibold">
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center font-mono font-bold text-gray-900 text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(index, 1)} className="px-2 h-full hover:bg-gray-100 text-gray-700 flex items-center justify-center font-semibold">
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="font-mono font-semibold text-gray-900 w-16 text-right text-sm">
                    {item.product.fields.Price != null
                      ? `$${(item.product.fields.Price * item.quantity).toFixed(2)}`
                      : '—'}
                  </div>
                  <button onClick={() => removeFromCart(index)} className="p-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg font-semibold transition-colors" title="Remove item">
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer - Fixed at bottom of container on Mobile */}
        <div className="absolute lg:relative bottom-0 left-0 right-0 p-5 border-t-2 border-gray-200 bg-gray-50 lg:shadow-none z-20 lg:p-6">
          {statusSummary && (
            <div className="mb-5 flex flex-col gap-2 bg-gray-50 border-2 border-gray-200 rounded-lg p-4 text-sm text-gray-900 font-medium">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-2 text-emerald-700 font-bold text-base">
                  <CheckCircleIcon className="h-5 w-5" />
                  {statusSummary.successes}
                </span>
                <span className="flex items-center gap-2 text-red-700 font-bold text-base">
                  <CloseIcon className="h-5 w-5" />
                  {statusSummary.failures}
                </span>
              </div>
              {statusSummary.failures > 0 ? (
                <p className="text-gray-700 text-xs">Failed items remain in cart. Adjust and retry.</p>
              ) : (
                <p className="text-gray-700 text-xs">All items checked out successfully.</p>
              )}
            </div>
          )}
          <div className="flex justify-between items-end mb-6">
            <span className="text-gray-600 text-sm font-bold uppercase tracking-wide">Total</span>
            <div className="text-right">
              <div className="text-4xl lg:text-5xl font-semibold text-gray-900 tracking-tight">
                {missingPrices > 0 ? '~' : ''}${total.toFixed(2)}
              </div>
              {missingPrices > 0 && (
                <div className="text-[11px] text-gray-500 mt-1">Excludes {missingPrices} unpriced item{missingPrices > 1 ? 's' : ''}</div>
              )}
            </div>
          </div>
          <button
            onClick={handleCheckout}
            disabled={pendingItems.length === 0 || isCheckingOut}
            className="w-full py-4 lg:py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors text-sm shadow-sm hover:shadow-md"
          >
            {isCheckingOut ? (
              <>
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                Checking out…
              </>
            ) : (
              <>Mark Paid ({pendingItems.length})</>
            )}
          </button>
        </div>
      </div>

      {/* Mobile sticky footer */}
      <div className="lg:hidden fixed inset-x-0 bottom-3 px-3 z-30">
        <div className="mx-auto max-w-3xl rounded-lg border-2 border-gray-200 bg-white shadow-md backdrop-blur p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Total</p>
            <p className="text-2xl font-light text-gray-900">${total.toFixed(2)}</p>
            <p className="text-xs text-gray-600">{pendingItems.length} ready to checkout</p>
          </div>
          <div className="flex flex-col gap-2 w-40">
            <button
              onClick={handleCheckout}
              disabled={pendingItems.length === 0 || isCheckingOut}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCheckingOut ? 'Processing…' : 'Mark Paid'}
            </button>
            <button
              onClick={onBack}
              className="text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2 text-center font-medium"
            >
              Back to scanning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
