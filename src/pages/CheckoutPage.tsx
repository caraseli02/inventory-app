import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ScannerFrame } from '../components/scanner/ScannerFrame';
import { Cart } from '../components/cart/Cart';
import { PageHeader } from '../components/ui/PageHeader';
import { CheckoutProgress } from '../components/checkout/CheckoutProgress';
import { CheckoutCompleteScreen } from '../components/checkout/CheckoutCompleteScreen';
import { CheckoutReviewModal } from '../components/checkout/CheckoutReviewModal';
import { Button } from '../components/ui/button';
import { ChevronDown, ScanBarcode, Search } from 'lucide-react';
import { ProductSearchDropdown } from '../components/search/ProductSearchDropdown';
import { ProductBrowsePanel } from '../components/search/ProductBrowsePanel';
import { MobileCartBar } from '../components/cart/MobileCartBar';
import { useCheckout } from '../hooks/useCheckout';

interface CheckoutPageProps {
  onBack: () => void;
}

function CheckoutPage({ onBack }: CheckoutPageProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    state, dispatch, inputMode, setInputMode, isPendingLookup,
    handleScanSuccess, handleManualSubmit, handleProductSelect,
    updateQuantity, handleCheckoutClick, handleConfirmFromReview,
    pendingItems, total, missingPrices, fallbackPrices,
  } = useCheckout({ t, queryClient });

  if (state.checkoutComplete) {
    return (
      <CheckoutCompleteScreen
        completedItemsCount={state.completedItemsCount}
        completedTotalQuantity={state.completedTotalQuantity}
        completedReferenceNumber={state.completedReferenceNumber}
        summaryExpanded={state.summaryExpanded}
        onToggleSummary={() => dispatch({ type: 'TOGGLE_SUMMARY_EXPANDED' })}
        onBack={onBack}
        t={t}
      />
    );
  }

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden flex flex-col">
        <PageHeader title={t('checkout.title')} onBack={onBack} variant="compact" />

        {!state.isCartExpanded && (
          <div className="flex-1 px-4 pt-3 pb-[110px] overflow-y-auto flex flex-col gap-3">
            {inputMode === 'scan' && (
              <CheckoutProgress currentStep={state.showReviewModal ? 'review' : 'scan'} />
            )}
            {inputMode === 'search' && (
              <div className="w-full space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <ProductSearchDropdown onProductSelect={handleProductSelect} placeholder={t('search.checkoutPlaceholder', 'Search to add to cart...')} autoFocus />
                  </div>
                  <Button variant="outline" size="lg" onClick={() => setInputMode('scan')} className="h-16 px-5 border-2 border-zinc-300 hover:bg-zinc-100 rounded-xl shrink-0">
                    <ScanBarcode className="h-6 w-6 text-zinc-700" />
                  </Button>
                </div>
                <ProductBrowsePanel onProductSelect={handleProductSelect} maxHeight="calc(100dvh - 340px)" cartItems={state.cart} />
              </div>
            )}
            {inputMode === 'scan' && (
              <div className="w-full space-y-3">
                <Button variant="outline" onClick={() => setInputMode('search')} className="w-full h-12 border-2 border-zinc-300 hover:bg-zinc-100 rounded-xl font-semibold">
                  <Search className="h-5 w-5 mr-2 text-zinc-700" />
                  {t('search.search', 'Search')}
                </Button>
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
              </div>
            )}
          </div>
        )}

        {!state.isCartExpanded && (
          <MobileCartBar cart={state.cart} total={total} lastAddedProduct={state.lastAddedProduct} onViewCart={() => dispatch({ type: 'SET_CART_EXPANDED', expanded: true })} isCheckingOut={state.isCheckingOut} />
        )}

        {state.isCartExpanded && (
          <div className="absolute bottom-0 left-0 right-0 bg-white h-[calc(100dvh-98px)] rounded-t-3xl transition-all duration-300 ease-in-out z-30">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
              <Button onClick={() => dispatch({ type: 'SET_CART_EXPANDED', expanded: false })} size="icon" className="h-12 w-12 rounded-full bg-stone-900 hover:bg-stone-800 text-white shadow-lg">
                <ChevronDown className="h-6 w-6" />
              </Button>
            </div>
            <div className="h-full flex flex-col pt-4">
              <Cart
                cart={state.cart}
                total={total}
                isCheckingOut={state.isCheckingOut}
                onUpdateQuantity={updateQuantity}
                customFooter={
                  <div className="p-6 pt-4 border-t border-gray-200 space-y-4">
                    <div className="space-y-2">
                      <Button className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-stone-400 rounded-xl" onClick={handleCheckoutClick} disabled={pendingItems.length === 0 || state.isCheckingOut}>
                        {state.isCheckingOut ? t('cart.processing') : t('cart.completeCheckout')}
                      </Button>
                      {pendingItems.length === 0 && !state.isCheckingOut && (
                        <p className="text-xs text-stone-500 text-center">{t('cart.emptyCheckoutHint', 'Scan products to add them to your cart')}</p>
                      )}
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Tablet/Desktop View */}
      <div className="hidden lg:block fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
        <PageHeader title={t('checkout.title')} onBack={onBack} variant="compact" />
        <div className="flex flex-row gap-6 h-[calc(100dvh-98px)] px-6 py-6">
          <div className="w-[48%] flex flex-col gap-6">
            {inputMode === 'scan' && (
              <CheckoutProgress currentStep={state.showReviewModal ? 'review' : 'scan'} />
            )}
            {inputMode === 'search' && (
              <div className="w-full space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <ProductSearchDropdown onProductSelect={handleProductSelect} placeholder={t('search.checkoutPlaceholder', 'Search to add to cart...')} autoFocus />
                  </div>
                  <Button variant="outline" size="lg" onClick={() => setInputMode('scan')} className="h-16 px-6 border-2 border-zinc-300 hover:bg-zinc-100 rounded-xl shrink-0">
                    <ScanBarcode className="h-6 w-6 text-zinc-700" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0">
                  <ProductBrowsePanel onProductSelect={handleProductSelect} maxHeight="calc(100dvh - 280px)" cartItems={state.cart} />
                </div>
              </div>
            )}
            {inputMode === 'scan' && (
              <div className="w-full space-y-4 flex-1 flex flex-col">
                <Button variant="outline" onClick={() => setInputMode('search')} className="w-full h-14 border-2 border-zinc-300 hover:bg-zinc-100 rounded-xl font-semibold text-base">
                  <Search className="h-5 w-5 mr-2 text-zinc-700" />
                  {t('search.search', 'Search')}
                </Button>
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
            )}
          </div>

          <div className="w-[48%] bg-white rounded-2xl flex flex-col overflow-hidden shadow-lg">
            <Cart
              cart={state.cart}
              total={total}
              isCheckingOut={state.isCheckingOut}
              onUpdateQuantity={updateQuantity}
              customFooter={
                <div className="p-6 pt-4 border-t border-gray-200 space-y-4">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-lg font-semibold text-gray-700">{t('cart.total')}</span>
                    <span className="text-3xl font-bold text-gray-900">€{total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-3">
                    <Button className="w-full h-12 text-base font-semibold bg-stone-900 hover:bg-stone-800 text-white disabled:bg-stone-400" onClick={handleCheckoutClick} disabled={pendingItems.length === 0 || state.isCheckingOut}>
                      {state.isCheckingOut ? t('cart.processing') : t('cart.completeCheckout')}
                    </Button>
                    {pendingItems.length === 0 && !state.isCheckingOut && (
                      <p className="text-xs text-stone-500 text-center">{t('cart.emptyCheckoutHint', 'Scan products to add them to your cart')}</p>
                    )}
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </div>

      <CheckoutReviewModal
        open={state.showReviewModal}
        pendingItems={pendingItems}
        total={total}
        missingPrices={missingPrices}
        fallbackPrices={fallbackPrices}
        isCheckingOut={state.isCheckingOut}
        onConfirm={handleConfirmFromReview}
        onClose={() => dispatch({ type: 'HIDE_REVIEW_MODAL' })}
        t={t}
      />
    </>
  );
}

export default CheckoutPage;
