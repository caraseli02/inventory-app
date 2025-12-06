import { useCallback, useEffect, useRef, useState } from 'react';
import Scanner from '../components/scanner/Scanner';
import { useProductLookup } from '../hooks/useProductLookup';
import { addStockMovement } from '../lib/api';
import { createPositiveInteger } from '../types';
import type { CartItem } from '../types';
import { logger } from '../lib/logger';

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
  const activeScanRef = useRef<string | null>(null);

  // Hook for looking up products
  const { data: product, isLoading, error } = useProductLookup(scannedCode);

  // Sound effect helper - memoized to prevent effect re-runs
  const playSound = useCallback((type: 'success' | 'error') => {
    // Placeholder for sound logic. In a real PWA we'd use Audio()
    if (navigator.vibrate) {
      navigator.vibrate(type === 'success' ? 100 : [100, 50, 100]);
    }
  }, []);

  // Effect: Handle product lookup results and add to cart
  useEffect(() => {
    if (!activeScanRef.current) return;

    // Don't process until loading is complete
    if (isLoading) return;

    let timeoutId: number | undefined;

    if (product) {
      setCart((currentCart) => {
        const existingItemIndex = currentCart.findIndex((item) => item.product.id === product.id);

        if (existingItemIndex >= 0) {
          const newCart = [...currentCart];
          // Use createPositiveInteger to ensure valid quantity
          newCart[existingItemIndex].quantity = createPositiveInteger(
            newCart[existingItemIndex].quantity + 1
          );
          return newCart;
        }

        return [...currentCart, { product: product as any, quantity: createPositiveInteger(1) }];
      });

      playSound('success');
      setScannedCode(null);
      activeScanRef.current = null;
      return;
    }

    if (error) {
      playSound('error');
      logger.warn('Product lookup error', { error: error instanceof Error ? error.message : String(error) });

      // Reset scan state after a brief delay to prevent rapid re-triggers
      timeoutId = window.setTimeout(() => {
        setScannedCode(null);
        activeScanRef.current = null;
      }, 1000);
    }

    // Cleanup timeout if effect re-runs or component unmounts
    return () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [product, error, isLoading, playSound]);

  const handleScanSuccess = (code: string) => {
    if (activeScanRef.current || isLoading) return;

    setScannedCode(code);
    activeScanRef.current = code;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim().length > 3) {
      handleScanSuccess(manualCode.trim());
      setManualCode('');
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const newQuantity = newCart[index].quantity + delta;

    if (newQuantity <= 0) {
      // Remove item if quantity would be zero or negative
      newCart.splice(index, 1);
    } else {
      // Update with valid positive integer
      newCart[index].quantity = createPositiveInteger(newQuantity);
    }

    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      const price = item.product.fields.Price || 0;
      return total + (price * item.quantity);
    }, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const confirm = window.confirm(
      `Complete checkout for ${cart.length} items? Total: $${calculateTotal().toFixed(2)}\n\nThis will update stock in Airtable.`
    );
    if (!confirm) return;

    setIsCheckingOut(true);

    const results = { succeeded: [] as string[], failed: [] as Array<{ name: string; error: string }> };

    try {
      // Process all items sequentially to ensure order
      for (const item of cart) {
        try {
          await addStockMovement(item.product.id, item.quantity, 'OUT');
          results.succeeded.push(item.product.fields.Name);
          logger.info('Stock movement recorded successfully', {
            productId: item.product.id,
            productName: item.product.fields.Name,
            quantity: item.quantity,
          });
        } catch (itemError) {
          const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error';
          results.failed.push({
            name: item.product.fields.Name,
            error: errorMessage,
          });
          logger.error('Failed to record stock movement for item during checkout', {
            productId: item.product.id,
            productName: item.product.fields.Name,
            quantity: item.quantity,
            error: errorMessage,
          });
        }
      }

      // If all items succeeded
      if (results.failed.length === 0) {
        setCart([]);
        setCheckoutComplete(true);
        playSound('success');
        logger.info('Checkout completed successfully', {
          itemCount: cart.length,
          total: calculateTotal(),
        });
        return;
      }

      // Partial failure: some items succeeded, some failed
      if (results.succeeded.length > 0 && results.failed.length > 0) {
        const failedItemsList = results.failed.map((item) => `• ${item.name}`).join('\n');
        const message =
          `Checkout partially completed!\n\n` +
          `✓ Success (${results.succeeded.length}): ${results.succeeded.join(', ')}\n\n` +
          `✗ Failed (${results.failed.length}):\n${failedItemsList}\n\n` +
          `Please contact support for the failed items.`;

        alert(message);

        // Keep only the failed items in cart for user to retry
        const failedItemNames = new Set(results.failed.map((item) => item.name));
        setCart(cart.filter((item) => failedItemNames.has(item.product.fields.Name)));

        logger.warn('Partial checkout failure', {
          succeededCount: results.succeeded.length,
          failedCount: results.failed.length,
          failedItems: results.failed.map((item) => item.name),
        });
        return;
      }

      // Complete failure: all items failed
      const errorList = results.failed.map((item) => `• ${item.name}: ${item.error}`).join('\n');
      const message =
        `Checkout failed for all items:\n\n${errorList}\n\n` +
        (navigator.onLine === false
          ? `No internet connection detected. Please check your network and try again.`
          : `Please check your connection and try again, or contact support if the problem persists.`);

      alert(message);

      logger.error('Complete checkout failure', {
        itemCount: cart.length,
        failedItems: results.failed.map((item) => item.name),
      });
    } catch (unexpectedError) {
      // Unexpected error not related to individual items
      const errorMessage = unexpectedError instanceof Error ? unexpectedError.message : 'Unknown error';
      const userMessage =
        navigator.onLine === false
          ? `No internet connection. Please check your network and try again.`
          : `An unexpected error occurred during checkout. Please try again or contact support.\n\nError: ${errorMessage}`;

      alert(userMessage);

      logger.error('Unexpected error during checkout', {
        error: errorMessage,
        stack: unexpectedError instanceof Error ? unexpectedError.stack : undefined,
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (checkoutComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30">
          <span className="text-5xl">✓</span>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Checkout Complete!</h2>
        <p className="text-slate-400 mb-8">Stock has been updated.</p>
        <button
          onClick={() => { setCheckoutComplete(false); onBack(); }}
          className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-xl font-medium transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100dvh-120px)] lg:h-[calc(100vh-140px)]">
      {/* Left Column: Scanner */}
      <div className="w-full lg:w-1/3 flex flex-col gap-2 lg:gap-4 shrink-0">
        <div className="flex justify-between items-center px-1">
          <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
            ← Exit
          </button>
        </div>

        {/* Mobile: Scanner takes less space or is collapsible? For now, keep it visible but simpler */}
        <div className={`transition-all duration-300 ${!showScanner && 'opacity-50'}`}>
          {showScanner ? (
            <div className="relative rounded-xl overflow-hidden shadow-2xl border border-purple-500/30 bg-black aspect-[4/3] lg:aspect-square w-full mx-auto max-w-sm lg:max-w-none shrink-0">
              <Scanner onScanSuccess={handleScanSuccess} />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                  <div className="animate-spin h-10 w-10 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                </div>
              )}
              <button
                onClick={() => setShowScanner(false)}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/80 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-medium border border-slate-600/50 whitespace-nowrap"
              >
                Tap to Type
              </button>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 aspect-[4/3] lg:aspect-square flex flex-col justify-center">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <label className="block text-slate-400 text-sm font-medium text-center">Enter Barcode</label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-center tracking-widest focus:ring-2 focus:ring-purple-500 outline-none"
                  autoFocus
                />
                <button type="submit" disabled={manualCode.length < 3} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold">
                  Add Item
                </button>
              </form>
              <button onClick={() => setShowScanner(true)} className="mt-4 text-slate-400 hover:text-white text-sm text-center">Open Camera</button>
            </div>
          )}
        </div>

        <div className="hidden lg:block bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center">
          <p className="text-sm text-slate-400">Scan items to add them to your cart. Duplicates will increase quantity.</p>
        </div>
      </div>

      {/* Right Column: Cart List */}
      <div className="flex-1 bg-slate-800/80 backdrop-blur-sm lg:bg-slate-800 rounded-t-2xl lg:rounded-xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl relative">
        {/* Cart Header */}
        <div className="p-3 lg:p-4 border-b border-slate-700 bg-slate-800/95 sticky top-0 z-20">
          <h2 className="text-lg lg:text-xl font-bold text-white flex justify-between items-center">
            <span>Current Cart</span>
            <span className="text-xs lg:text-sm font-normal text-slate-400 bg-slate-700 px-2 py-1 rounded-md">{cart.length} items</span>
          </h2>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 pb-24 lg:pb-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 min-h-[150px]">
              <div className="text-6xl opacity-20">🛒</div>
              <p>Your cart is empty</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={`${item.product.id}-${index}`} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800/50">
                {/* Image Thumb */}
                <div className="w-12 h-12 bg-slate-800 rounded-md overflow-hidden shrink-0 border border-slate-700">
                  {item.product.fields.Image?.[0]?.url ? (
                    <img src={item.product.fields.Image[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate text-sm lg:text-base">{item.product.fields.Name}</h3>
                  <p className="text-slate-400 text-xs">${(item.product.fields.Price || 0).toFixed(2)}</p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 h-8">
                    <button onClick={() => updateQuantity(index, -1)} className="px-2 lg:px-3 h-full hover:bg-slate-700 text-slate-300 flex items-center justify-center">
                      <span className="text-xl leading-none mb-1">-</span>
                    </button>
                    <span className="w-6 lg:w-8 text-center font-mono font-bold text-white text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(index, 1)} className="px-2 lg:px-3 h-full hover:bg-slate-700 text-slate-300 flex items-center justify-center">
                      <span className="text-xl leading-none mb-1">+</span>
                    </button>
                  </div>
                  <div className="font-mono font-bold text-emerald-400 w-14 lg:w-16 text-right text-sm lg:text-base">
                    ${((item.product.fields.Price || 0) * item.quantity).toFixed(2)}
                  </div>
                  <button onClick={() => removeFromCart(index)} className="p-2 text-slate-500 hover:text-red-400">
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer - Fixed at bottom of container on Mobile */}
        <div className="absolute lg:relative bottom-0 left-0 right-0 p-4 border-t border-slate-700 bg-slate-900 shadow-[0_-4px_10px_rgba(0,0,0,0.3)] lg:shadow-none z-20">
          <div className="flex justify-between items-end mb-4">
            <span className="text-slate-400 text-sm lg:text-base">Total Amount</span>
            <span className="text-3xl lg:text-4xl font-bold text-white tracking-tight">${calculateTotal().toFixed(2)}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isCheckingOut}
            className="w-full py-3 lg:py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {isCheckingOut ? (
              <>
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                Processing...
              </>
            ) : (
              <>Complete Checkout ({cart.length})</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
