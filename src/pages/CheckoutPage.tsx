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
import { Button } from '../components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';

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
  const [isCartExpanded, setIsCartExpanded] = useState(false);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync cart with latest lookup result
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- gate guard reset after lookup completes
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
        <Button
          onClick={() => {
            setCheckoutComplete(false);
            onBack();
          }}
          variant="outline"
          className="px-8 py-3"
        >
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden fixed inset-0 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/50">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 text-slate-700 hover:text-slate-900 hover:bg-white/30"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <p className="text-slate-700 text-center text-xs font-medium">
            Scan the items barcode inside the square frame to add items to your cart
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 text-slate-700 hover:text-slate-900 hover:bg-white/30"
          >
            <CloseIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Scanner Section */}
        <div className="px-6 pt-4">

          {/* Scanner Frame */}
          <div className="relative mx-auto w-full max-w-lg aspect-square">
            {/* Corner Brackets */}
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Top Left */}
              <div className="absolute top-0 left-0 w-20 h-20 border-l-[3px] border-t-[3px] border-slate-700" />
              {/* Top Right */}
              <div className="absolute top-0 right-0 w-20 h-20 border-r-[3px] border-t-[3px] border-slate-700" />
              {/* Bottom Left */}
              <div className="absolute bottom-0 left-0 w-20 h-20 border-l-[3px] border-b-[3px] border-slate-700" />
              {/* Bottom Right */}
              <div className="absolute bottom-0 right-0 w-20 h-20 border-r-[3px] border-b-[3px] border-slate-700" />

              {/* Scan Line */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-700 shadow-lg" />
            </div>

            {/* Scanner or Barcode Area */}
            <div className="absolute inset-0 bg-black rounded-lg overflow-hidden">
              {showScanner ? (
                <Scanner onScanSuccess={handleScanSuccess} scannerId="mobile-reader" />
              ) : (
                <div className="flex items-center justify-center h-full bg-stone-900">
                  <div className="text-center px-4 w-full max-w-xs">
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        className="w-full bg-white border-2 border-stone-300 rounded-lg p-3 text-stone-900 text-center tracking-widest focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none"
                        placeholder="Enter barcode"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        disabled={manualCode.length < 3 || isPendingLookup}
                        className="w-full bg-white hover:bg-stone-100 text-stone-900"
                      >
                        {isPendingLookup ? 'Searching…' : 'Add Item'}
                      </Button>
                    </form>
                    <Button
                      variant="ghost"
                      onClick={() => setShowScanner(true)}
                      className="mt-4 text-white hover:text-white hover:bg-white/10"
                    >
                      Use Camera
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {isPendingLookup && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-20">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin h-10 w-10 border-4 border-slate-200 border-t-slate-700 rounded-full" />
                  <p className="text-slate-900 text-sm font-medium">Searching…</p>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {lookupError && (
            <div className="mt-4 bg-red-50 border-2 border-red-200 text-red-900 p-3 rounded-lg text-sm flex items-start gap-2">
              <WarningIcon className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold">Not Found</p>
                <p className="text-red-800 text-xs mt-1">{lookupError}</p>
              </div>
              <button onClick={() => setLookupError(null)} className="text-red-600 hover:text-red-900">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Cart Toggle/Collapse */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white transition-all duration-300 ease-in-out ${
            isCartExpanded ? 'h-[75vh] rounded-t-3xl' : 'h-auto rounded-t-3xl'
          }`}
        >
          {/* Toggle Button */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <Button
              onClick={() => setIsCartExpanded(!isCartExpanded)}
              size="icon"
              className="h-12 w-12 rounded-full bg-stone-900 hover:bg-stone-800 text-white shadow-lg"
            >
              {isCartExpanded ? <ChevronDown className="h-6 w-6" /> : <ChevronUp className="h-6 w-6" />}
            </Button>
          </div>

          {/* Collapsed Cart Summary */}
          {!isCartExpanded && (
            <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => setIsCartExpanded(true)}>
              <div className="flex items-center gap-3">
                <ShoppingCartIcon className="h-6 w-6 text-stone-900" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">My Cart</h3>
                  <p className="text-sm text-gray-600">{cart.length} items</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-stone-900">
                € {total.toFixed(2)}
              </div>
            </div>
          )}

          {/* Expanded Cart */}
          {isCartExpanded && (
            <div className="h-full flex flex-col">
              {/* Cart Header */}
              <div className="p-6 pb-4 flex items-center justify-between border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <ShoppingCartIcon className="h-6 w-6 text-stone-900" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">My Cart</h3>
                    <p className="text-sm text-gray-500">{cart.length} items</p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-stone-900">
                  € {total.toFixed(2)}
                </div>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <ShoppingCartIcon className="h-16 w-16 opacity-20 mb-3" />
                    <p className="text-sm">Cart is empty</p>
                  </div>
                ) : (
                  cart.map((item, index) => (
                    <div key={`${item.product.id}-${index}`} className="flex items-start gap-4">
                      {/* Product Image */}
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                        {item.product.fields.Image?.[0]?.url ? (
                          <img
                            src={item.product.fields.Image[0].url}
                            alt={item.product.fields.Name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BoxIcon className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-base mb-1">
                          {item.product.fields.Name}
                        </h4>
                        <p className="text-sm text-gray-500 mb-2">
                          {item.product.fields.Category || '1kg'} • €{' '}
                          {item.product.fields.Price != null
                            ? `${item.product.fields.Price.toFixed(2)}/kg`
                            : 'No price'}
                        </p>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center bg-gray-100 rounded-lg">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateQuantity(index, -1)}
                              className="h-8 w-8 p-0 hover:bg-gray-200"
                            >
                              <MinusIcon className="h-4 w-4 text-stone-900" />
                            </Button>
                            <span className="w-8 text-center font-semibold text-gray-900">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateQuantity(index, 1)}
                              className="h-8 w-8 p-0 hover:bg-gray-200"
                            >
                              <PlusIcon className="h-4 w-4 text-stone-900" />
                            </Button>
                          </div>

                          {/* Item Total */}
                          <div className="font-bold text-gray-900">
                            €{' '}
                            {item.product.fields.Price != null
                              ? (item.product.fields.Price * item.quantity).toFixed(2)
                              : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total and Actions */}
              <div className="p-6 pt-4 border-t border-gray-200 space-y-4">
                {/* Total */}
                <div className="flex items-center justify-between pb-2">
                  <span className="text-lg font-semibold text-gray-700">Total</span>
                  <span className="text-3xl font-bold text-gray-900">€ {total.toFixed(2)}</span>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base font-medium border-2 hover:bg-gray-50"
                    onClick={() => setIsCartExpanded(false)}
                  >
                    Next Product
                  </Button>

                  <Button
                    className="w-full h-12 text-base font-semibold bg-stone-900 hover:bg-stone-800 text-white"
                    onClick={handleCheckout}
                    disabled={pendingItems.length === 0 || isCheckingOut}
                  >
                    {isCheckingOut ? 'Processing...' : 'Finish'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tablet/Desktop View - New Scanner UI with visible cart */}
      <div className="hidden lg:block fixed inset-0 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/50">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 text-slate-700 hover:text-slate-900 hover:bg-white/30"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <p className="text-slate-700 text-center text-xs font-medium">
            Scan the items barcode inside the square frame to add items to your cart
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 text-slate-700 hover:text-slate-900 hover:bg-white/30"
          >
            <CloseIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-row gap-6 h-[calc(100vh-72px)] px-6 py-6">
          {/* Left Column: Scanner */}
          <div className="w-[45%] flex flex-col gap-4">

            {/* Scanner Frame */}
            <div className="relative w-full aspect-square">
              {/* Corner Brackets */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* Top Left */}
                <div className="absolute top-0 left-0 w-20 h-20 border-l-[3px] border-t-[3px] border-slate-700" />
                {/* Top Right */}
                <div className="absolute top-0 right-0 w-20 h-20 border-r-[3px] border-t-[3px] border-slate-700" />
                {/* Bottom Left */}
                <div className="absolute bottom-0 left-0 w-20 h-20 border-l-[3px] border-b-[3px] border-slate-700" />
                {/* Bottom Right */}
                <div className="absolute bottom-0 right-0 w-20 h-20 border-r-[3px] border-b-[3px] border-slate-700" />

                {/* Scan Line */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-700 shadow-lg" />
              </div>

              {/* Scanner or Barcode Area */}
              <div className="absolute inset-0 bg-black rounded-lg overflow-hidden">
                {showScanner ? (
                  <Scanner onScanSuccess={handleScanSuccess} scannerId="desktop-reader" />
                ) : (
                  <div className="flex items-center justify-center h-full bg-stone-900">
                    <div className="text-center px-4 w-full max-w-xs">
                      <form onSubmit={handleManualSubmit} className="space-y-4">
                        <input
                          type="text"
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                          className="w-full bg-white border-2 border-stone-300 rounded-lg p-3 text-stone-900 text-center tracking-widest focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm"
                          placeholder="Enter barcode"
                          autoFocus
                        />
                        <Button
                          type="submit"
                          disabled={manualCode.length < 3 || isPendingLookup}
                          className="w-full bg-white hover:bg-stone-100 text-stone-900 text-sm"
                        >
                          {isPendingLookup ? 'Searching…' : 'Add Item'}
                        </Button>
                      </form>
                      <Button
                        variant="ghost"
                        onClick={() => setShowScanner(true)}
                        className="mt-4 text-white hover:text-white hover:bg-white/10 text-sm"
                      >
                        Use Camera
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {isPendingLookup && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin h-10 w-10 border-4 border-slate-200 border-t-slate-700 rounded-full" />
                    <p className="text-slate-900 text-sm font-medium">Searching…</p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {lookupError && (
              <div className="bg-red-50 border-2 border-red-200 text-red-900 p-3 rounded-lg text-sm flex items-start gap-2 max-w-md w-full">
                <WarningIcon className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">
                  <p className="font-semibold">Not Found</p>
                  <p className="text-red-800 text-xs mt-1">{lookupError}</p>
                </div>
                <button onClick={() => setLookupError(null)} className="text-red-600 hover:text-red-900">
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Cart */}
          <div className="w-[55%] bg-white rounded-2xl flex flex-col overflow-hidden shadow-lg">
            {/* Cart Header */}
            <div className="p-6 pb-4 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center gap-3">
                <ShoppingCartIcon className="h-6 w-6 text-stone-900" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">My Cart</h3>
                  <p className="text-sm text-gray-500">{cart.length} items</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-stone-900">
                € {total.toFixed(2)}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <ShoppingCartIcon className="h-16 w-16 opacity-20 mb-3" />
                  <p className="text-sm">Cart is empty</p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div key={`${item.product.id}-${index}`} className="flex items-start gap-4">
                    {/* Product Image */}
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      {item.product.fields.Image?.[0]?.url ? (
                        <img
                          src={item.product.fields.Image[0].url}
                          alt={item.product.fields.Name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BoxIcon className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 text-base mb-1">
                        {item.product.fields.Name}
                      </h4>
                      <p className="text-sm text-gray-500 mb-2">
                        {item.product.fields.Category || '1kg'} • €{' '}
                        {item.product.fields.Price != null
                          ? `${item.product.fields.Price.toFixed(2)}/kg`
                          : 'No price'}
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-gray-100 rounded-lg">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateQuantity(index, -1)}
                            className="h-8 w-8 p-0 hover:bg-gray-200"
                          >
                            <MinusIcon className="h-4 w-4 text-stone-900" />
                          </Button>
                          <span className="w-8 text-center font-semibold text-gray-900">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateQuantity(index, 1)}
                            className="h-8 w-8 p-0 hover:bg-gray-200"
                          >
                            <PlusIcon className="h-4 w-4 text-stone-900" />
                          </Button>
                        </div>

                        {/* Item Total */}
                        <div className="font-bold text-gray-900">
                          €{' '}
                          {item.product.fields.Price != null
                            ? (item.product.fields.Price * item.quantity).toFixed(2)
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total and Actions */}
            <div className="p-6 pt-4 border-t border-gray-200 space-y-4">
              {/* Total */}
              <div className="flex items-center justify-between pb-2">
                <span className="text-lg font-semibold text-gray-700">Total</span>
                <span className="text-3xl font-bold text-gray-900">€ {total.toFixed(2)}</span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-12 text-base font-medium border-2 hover:bg-gray-50"
                  onClick={() => setShowScanner(true)}
                >
                  Next Product
                </Button>

                <Button
                  className="w-full h-12 text-base font-semibold bg-stone-900 hover:bg-stone-800 text-white"
                  onClick={handleCheckout}
                  disabled={pendingItems.length === 0 || isCheckingOut}
                >
                  {isCheckingOut ? 'Processing...' : 'Finish'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CheckoutPage;
