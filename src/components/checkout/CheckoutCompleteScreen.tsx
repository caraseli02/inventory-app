import type { TFunction } from 'i18next';
import { CheckCircleIcon } from '../ui/Icons';
import { Button } from '../ui/button';
import { ChevronDown, Share2, Download, Clock } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

interface CheckoutCompleteScreenProps {
  completedItemsCount: number;
  completedTotalQuantity: number;
  completedReferenceNumber: string;
  summaryExpanded: boolean;
  onToggleSummary: () => void;
  onBack: () => void;
  t: TFunction;
}

export function CheckoutCompleteScreen({
  completedItemsCount,
  completedTotalQuantity,
  completedReferenceNumber,
  summaryExpanded,
  onToggleSummary,
  onBack,
  t,
}: CheckoutCompleteScreenProps) {
  return (
    <>
      {/* Mobile/Tablet View */}
      <div className="lg:hidden fixed inset-0 bg-[var(--color-cream)] flex flex-col">
        <div className="text-center pt-6 pb-4 px-6">
          <div className="text-xs font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--color-stone)' }}>
            {t('checkout.title', 'INVENTORY MANAGEMENT')}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-stone-dark)' }}>
            {t('app.title', 'Grocery Inventory')}
          </h1>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 pb-8">
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <div
                className="w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center animate-pulse-gentle"
                style={{ background: 'linear-gradient(to bottom right, #D1FAE5, #A7F3D0)' }}
              >
                <CheckCircleIcon className="h-12 w-12 md:h-16 md:w-16" style={{ color: 'var(--color-forest)' }} />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-stone-dark)' }}>
              {t('checkout.complete')}
            </h2>
            <p className="text-base md:text-xl" style={{ color: 'var(--color-stone)' }}>
              {t('checkout.stockUpdated')}
            </p>
          </div>

          <div className="mb-6">
            <Collapsible open={summaryExpanded} onOpenChange={onToggleSummary}>
              <div className="bg-white rounded-2xl border-2 shadow-md" style={{ borderColor: 'var(--color-stone)' }}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full p-4 flex items-center justify-between text-left h-auto hover:bg-stone-50">
                    <span className="font-semibold" style={{ color: 'var(--color-stone-dark)' }}>
                      {t('checkout.transactionSummary', 'Transaction Summary')}
                    </span>
                    <ChevronDown className={`w-5 h-5 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--color-stone)' }} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t-2 p-4 space-y-2" style={{ borderColor: 'var(--color-stone)' }}>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--color-stone)' }}>{t('checkout.itemsLabel', 'Items:')}</span>
                      <span className="font-semibold" style={{ color: 'var(--color-stone-dark)' }}>{completedItemsCount} {t('checkout.products', 'products')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--color-stone)' }}>{t('checkout.quantityLabel', 'Quantity:')}</span>
                      <span className="font-semibold" style={{ color: 'var(--color-stone-dark)' }}>{completedTotalQuantity} {t('checkout.units', 'units')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--color-stone)' }}>{t('checkout.referenceLabel', 'Reference:')}</span>
                      <span className="font-semibold" style={{ color: 'var(--color-stone-dark)' }}>{completedReferenceNumber}</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            <Button variant="outline" className="p-3 rounded-lg border-2 flex flex-col items-center gap-1 h-auto" style={{ borderColor: 'var(--color-stone)' }}>
              <Share2 className="w-5 h-5" style={{ color: 'var(--color-stone)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-stone)' }}>{t('checkout.share', 'Share')}</span>
            </Button>
            <Button variant="outline" className="p-3 rounded-lg border-2 flex flex-col items-center gap-1 h-auto" style={{ borderColor: 'var(--color-stone)' }}>
              <Download className="w-5 h-5" style={{ color: 'var(--color-stone)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-stone)' }}>{t('checkout.export', 'Export')}</span>
            </Button>
            <Button variant="outline" className="p-3 rounded-lg border-2 flex flex-col items-center gap-1 h-auto" style={{ borderColor: 'var(--color-stone)' }}>
              <Clock className="w-5 h-5" style={{ color: 'var(--color-stone)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-stone)' }}>{t('checkout.history', 'History')}</span>
            </Button>
          </div>
        </div>

        <div className="px-6 pb-6">
          <Button
            onClick={onBack}
            className="w-full py-4 px-6 rounded-xl font-semibold text-white shadow-lg transition-all hover:shadow-xl"
            style={{ background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))' }}
          >
            {t('checkout.backToHome')}
          </Button>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden lg:flex fixed inset-0 bg-[var(--color-cream)] flex-col">
        <div className="text-center pt-12 pb-8 px-12">
          <div className="text-sm font-semibold tracking-wider uppercase mb-4" style={{ color: 'var(--color-stone)' }}>
            {t('checkout.title', 'INVENTORY MANAGEMENT')}
          </div>
          <h1 className="text-6xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-stone-dark)' }}>
            {t('app.title', 'Grocery Inventory')}
          </h1>
        </div>

        <div className="flex-1 flex justify-center items-center px-16 pb-16">
          <div className="max-w-6xl w-full grid grid-cols-2 gap-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative inline-block mb-8">
                <div
                  className="w-40 h-40 rounded-full flex items-center justify-center animate-pulse-gentle"
                  style={{ background: 'linear-gradient(to bottom right, #D1FAE5, #A7F3D0)' }}
                >
                  <CheckCircleIcon className="h-20 w-20" style={{ color: 'var(--color-forest)' }} />
                </div>
              </div>
              <h2 className="text-5xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-stone-dark)' }}>
                {t('checkout.complete')}
              </h2>
              <p className="text-xl" style={{ color: 'var(--color-stone)' }}>
                {t('checkout.stockUpdatedSuccess', t('checkout.stockUpdated'))}
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <div className="bg-white rounded-2xl border-2 shadow-lg mb-6" style={{ borderColor: 'var(--color-stone)' }}>
                <div className="p-6 border-b-2" style={{ borderColor: 'var(--color-stone)' }}>
                  <h3 className="font-semibold text-xl" style={{ color: 'var(--color-stone-dark)' }}>
                    {t('checkout.transactionSummary', 'Transaction Summary')}
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg" style={{ color: 'var(--color-stone)' }}>{t('checkout.productsUpdated', 'Products Updated:')}</span>
                    <span className="text-2xl font-bold" style={{ color: 'var(--color-forest)' }}>{completedItemsCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg" style={{ color: 'var(--color-stone)' }}>{t('checkout.totalQuantity', 'Total Quantity:')}</span>
                    <span className="text-2xl font-bold" style={{ color: 'var(--color-forest)' }}>{completedTotalQuantity} {t('checkout.units', 'units')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg" style={{ color: 'var(--color-stone)' }}>{t('checkout.referenceNumber', 'Reference Number:')}</span>
                    <span className="text-lg font-semibold" style={{ color: 'var(--color-stone-dark)' }}>{completedReferenceNumber}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <Button variant="outline" className="p-4 rounded-xl border-2 flex flex-col items-center gap-2 h-auto" style={{ borderColor: 'var(--color-stone)' }}>
                  <Share2 className="w-6 h-6" style={{ color: 'var(--color-stone)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-stone)' }}>{t('checkout.share', 'Share')}</span>
                </Button>
                <Button variant="outline" className="p-4 rounded-xl border-2 flex flex-col items-center gap-2 h-auto" style={{ borderColor: 'var(--color-stone)' }}>
                  <Download className="w-6 h-6" style={{ color: 'var(--color-stone)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-stone)' }}>{t('checkout.export', 'Export')}</span>
                </Button>
                <Button variant="outline" className="p-4 rounded-xl border-2 flex flex-col items-center gap-2 h-auto" style={{ borderColor: 'var(--color-stone)' }}>
                  <Clock className="w-6 h-6" style={{ color: 'var(--color-stone)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-stone)' }}>{t('checkout.history', 'History')}</span>
                </Button>
              </div>

              <Button
                onClick={onBack}
                className="py-5 px-12 rounded-xl font-semibold text-white text-lg shadow-lg transition-all hover:shadow-xl"
                style={{ background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))' }}
              >
                {t('checkout.backToHome')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
