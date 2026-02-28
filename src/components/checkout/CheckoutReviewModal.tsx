import type { TFunction } from 'i18next';
import type { CartItem } from '../../types';
import { getProductDisplayPrice } from '../../hooks/useMarkupSetting';
import { BoxIcon } from '../ui/Icons';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface CheckoutReviewModalProps {
  open: boolean;
  pendingItems: CartItem[];
  total: number;
  missingPrices: number;
  fallbackPrices: number;
  isCheckingOut: boolean;
  onConfirm: () => void;
  onClose: () => void;
  t: TFunction;
}

export function CheckoutReviewModal({
  open,
  pendingItems,
  total,
  missingPrices,
  fallbackPrices,
  isCheckingOut,
  onConfirm,
  onClose,
  t,
}: CheckoutReviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="!fixed !inset-0 !left-0 !top-0 !right-0 !bottom-0 w-full h-full !max-w-full !max-h-full !translate-x-0 !translate-y-0 p-0 gap-0 !rounded-none relative sm:!inset-0 sm:!left-0 sm:!top-0 sm:!translate-x-0 sm:!translate-y-0 sm:!max-w-full sm:!rounded-none"
      >
        <div className="h-full flex flex-col overflow-hidden">
          <DialogHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200 px-6 py-6 flex-shrink-0">
            <DialogTitle className="text-2xl font-bold text-stone-900">{t('checkout.reviewTitle')}</DialogTitle>
            <DialogDescription className="text-stone-600">{t('checkout.reviewSubtitle')}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
            <div className="max-w-2xl mx-auto space-y-3">
              {pendingItems.map((item, index) => {
                const imageUrl = item.product.fields.Image?.[0]?.url;
                const price = getProductDisplayPrice(item.product.fields);
                return (
                  <div key={`${item.product.id}-${index}`} className="flex items-center gap-4 p-4 bg-stone-50 rounded-xl border-2 border-stone-200">
                    <div className="w-16 h-16 rounded-xl bg-stone-100 flex items-center justify-center overflow-hidden shrink-0 border border-stone-200">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.product.fields.Name} className="w-full h-full object-cover" />
                      ) : (
                        <BoxIcon className="h-8 w-8 text-stone-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-stone-900 text-lg truncate">{item.product.fields.Name}</h4>
                      <p className="text-sm text-stone-500">
                        {t('checkout.itemsCount', { count: item.quantity })}
                        {price != null && ` × €${price.toFixed(2)}`}
                      </p>
                    </div>
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

          <div className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-t-2 border-stone-200 px-6 py-6 flex-shrink-0">
            <div className="max-w-2xl mx-auto space-y-4">
              {missingPrices > 0 && (
                <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-700 text-sm font-medium">
                  ⚠️ {t('checkout.missingPrices', { count: missingPrices })} - {t('checkout.confirmMessageWithMissing', { count: pendingItems.length, total: `€${total.toFixed(2)}`, missing: missingPrices }).split('.').slice(-1)[0].trim()}
                </div>
              )}
              {fallbackPrices > 0 && (
                <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-700 text-sm font-medium">
                  ⚠️ {t('checkout.storePriceFallbackWarning', { count: fallbackPrices, defaultValue: '{{count}} item(s) are missing store tier prices; totals are using base cost.' })}
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
                  onClick={onClose}
                  className="flex-1 border-2 border-stone-300 hover:bg-stone-100 font-semibold h-12"
                >
                  {t('checkout.editCart')}
                </Button>
                <Button
                  type="button"
                  onClick={onConfirm}
                  disabled={isCheckingOut}
                  className="flex-1 bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white font-bold h-12 shadow-md"
                >
                  {isCheckingOut ? t('cart.processing') : t('checkout.confirm')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
