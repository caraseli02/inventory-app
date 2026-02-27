import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { DollarSign, ChevronDown } from 'lucide-react';
import type { MarkupPercentage } from '../../hooks/useProductEdit';

interface PricingSectionProps {
  basePrice: number | undefined;
  storePrice: number | undefined;
  markup: MarkupPercentage;
  onMarkupChange: (markup: MarkupPercentage) => void;
  pricingOpen: boolean;
  onPricingOpenChange: (open: boolean) => void;
  sourcePriceLei: string;
  setSourcePriceLei: (v: string) => void;
  transportFeeEur: string;
  setTransportFeeEur: (v: string) => void;
  exchangeRate: string;
  setExchangeRate: (v: string) => void;
}

function isValidLeiInputs(sourceLei: number, transport: number, fx: number): boolean {
  return (
    Number.isFinite(sourceLei) && sourceLei >= 0 &&
    Number.isFinite(transport) && transport >= 0 &&
    Number.isFinite(fx) && fx > 0
  );
}

interface CalcResult {
  sourceCostEur: number | undefined;
  calculatedBase: number | undefined;
  calculatedStore: number | undefined;
  baseDiff: number | undefined;
  displayBase: number | undefined;
  displayTransport: number | undefined;
  displayStore: number | undefined;
}

function calcPricing(
  hasValid: boolean,
  parsedLei: number,
  parsedTransport: number,
  parsedFx: number,
  markup: MarkupPercentage,
  basePrice: number | undefined,
  storePrice: number | undefined,
): CalcResult {
  const sourceCostEur = hasValid ? parsedLei / parsedFx : undefined;
  const calculatedBase = hasValid && sourceCostEur !== undefined ? sourceCostEur + parsedTransport : undefined;
  const calculatedStore = calculatedBase != null ? calculatedBase * (1 + markup / 100) : undefined;
  const baseDiff = basePrice != null && calculatedBase != null ? calculatedBase - basePrice : undefined;
  const impliedTransport = basePrice != null && storePrice != null ? (storePrice / (1 + markup / 100)) - basePrice : undefined;
  const displayBase = hasValid && sourceCostEur != null ? sourceCostEur : basePrice;
  const displayTransport = hasValid ? parsedTransport : impliedTransport;
  const displayStore = hasValid && calculatedStore != null ? calculatedStore : storePrice;
  return { sourceCostEur, calculatedBase, calculatedStore, baseDiff, displayBase, displayTransport, displayStore };
}

function getFormulaText(
  t: TFunction,
  displayBase: number | undefined,
  displayTransport: number | undefined,
  displayStore: number | undefined,
  markup: MarkupPercentage,
  basePrice: number | undefined,
  storePrice: number | undefined,
): string {
  if (displayBase != null && displayTransport != null && displayStore != null) {
    return t('markup.tierWithTransportFormula', {
      defaultValue: '{{markup}}% tier: (€{{base}} + €{{transport}} = €{{landed}}) → €{{store}}',
      markup, base: displayBase.toFixed(2), transport: displayTransport.toFixed(2),
      landed: (displayBase + displayTransport).toFixed(2), store: displayStore.toFixed(2),
    });
  }
  if (basePrice != null && storePrice != null) {
    return t('markup.formula', { markup, base: basePrice.toFixed(2), store: storePrice.toFixed(2) });
  }
  return '';
}

function getHintText(
  t: TFunction,
  displayBase: number | undefined,
  displayTransport: number | undefined,
  displayStore: number | undefined,
  markup: MarkupPercentage,
): string {
  if (displayBase != null && displayTransport != null && displayStore != null) {
    return t('markup.transportIncludedHint', 'With transport: landed base €{{landed}} -> store €{{store}} ({{markup}}% tier)', {
      landed: (displayBase + displayTransport).toFixed(2),
      store: displayStore.toFixed(2), markup,
    });
  }
  return t('markup.transportMissingHint', 'Transport is not included in current saved base. Fill transport below to compare landed pricing.');
}

export function PricingSection({ basePrice, storePrice, markup, onMarkupChange, pricingOpen, onPricingOpenChange, sourcePriceLei, setSourcePriceLei, transportFeeEur, setTransportFeeEur, exchangeRate, setExchangeRate }: PricingSectionProps) {
  const { t } = useTranslation();

  const parsedLei = Number.parseFloat(sourcePriceLei);
  const parsedTransport = Number.parseFloat(transportFeeEur);
  const parsedFx = Number.parseFloat(exchangeRate);
  const hasValidInputs = isValidLeiInputs(parsedLei, parsedTransport, parsedFx);
  const { sourceCostEur, calculatedBase, calculatedStore, baseDiff, displayBase, displayTransport, displayStore } = calcPricing(hasValidInputs, parsedLei, parsedTransport, parsedFx, markup, basePrice, storePrice);

  return (
    <Collapsible open={pricingOpen} onOpenChange={onPricingOpenChange}>
      <div className="bg-white rounded-xl border-2 border-stone-200 overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between px-4 sm:px-5 py-4 hover:bg-stone-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="font-semibold text-stone-900">{t('dialogs.editProduct.sectionPricing', 'Pricing')}</span>
            {basePrice != null && (
              <Badge variant="secondary" className="bg-stone-100 text-stone-600 text-xs ml-2">
                €{basePrice.toFixed(2)} {t('product.currentBase', 'current base')} • {markup}% {t('markup.label', 'markup')}
              </Badge>
            )}
          </div>
          <ChevronDown className={`w-5 h-5 text-stone-400 transition-transform duration-200 ${pricingOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-stone-100 pt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-stone-700 font-semibold text-sm">{t('product.currentBasePrice', 'Current base price')}</Label>
                <div className="mt-2 h-11 px-3 flex items-center bg-stone-50 border-2 border-stone-200 rounded-lg text-stone-600">
                  {basePrice != null ? `€${basePrice.toFixed(2)}` : '—'}
                </div>
                <p className="text-xs text-stone-500 mt-1.5">{t('product.currentBasePriceHelp', 'Saved product base price (without transport allocation)')}</p>
              </div>
              <div>
                <Label className="text-stone-700 font-semibold text-sm">{t('markup.label')}</Label>
                <div className="flex rounded-lg border-2 border-stone-200 bg-stone-50 p-1 mt-2">
                  {([50, 70, 100] as MarkupPercentage[]).map((option) => (
                    <Button key={option} type="button" variant="ghost" size="sm"
                      onClick={() => onMarkupChange(option)}
                      className={`flex-1 h-9 font-semibold transition-all ${markup === option ? 'bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-dark)] hover:text-white' : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'}`}
                    >
                      {option}%
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {basePrice != null && storePrice != null && (
              <div className="p-4 bg-[var(--color-forest)]/10 border-2 border-[var(--color-forest)]/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-700 font-medium">{t('product.storePrice')}</span>
                  <span className="text-2xl font-bold text-[var(--color-forest)]">€{storePrice.toFixed(2)}</span>
                </div>
                <p className="text-xs text-[var(--color-forest)] mt-1">{getFormulaText(t, displayBase, displayTransport, displayStore, markup, basePrice, storePrice)}</p>
                <p className="text-xs text-stone-600 mt-1">{getHintText(t, displayBase, displayTransport, displayStore, markup)}</p>
              </div>
            )}

            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl space-y-4">
              <div>
                <p className="text-sm font-semibold text-stone-900">{t('pricing.breakdown.title', 'Invoice Cost Breakdown (LEI -> EUR)')}</p>
                <p className="text-xs text-stone-600 mt-1">{t('pricing.breakdown.help', 'Enter invoice values to verify landed cost (including transport) and resulting store price.')}</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="sourcePriceLei" className="text-stone-700 font-semibold text-sm">{t('pricing.breakdown.sourceLei', 'Invoice unit price (LEI)')}</Label>
                  <Input id="sourcePriceLei" type="number" min={0} step="0.01" value={sourcePriceLei} onChange={(e) => setSourcePriceLei(e.target.value)} placeholder="0.00" className="mt-2 h-11 border-2 border-blue-200 focus-visible:ring-blue-400 focus-visible:border-blue-400 bg-white" />
                </div>
                <div>
                  <Label htmlFor="transportFeeEur" className="text-stone-700 font-semibold text-sm">{t('pricing.breakdown.transportEur', 'Transport allocation (EUR)')}</Label>
                  <Input id="transportFeeEur" type="number" min={0} step="0.01" value={transportFeeEur} onChange={(e) => setTransportFeeEur(e.target.value)} placeholder="0.00" className="mt-2 h-11 border-2 border-blue-200 focus-visible:ring-blue-400 focus-visible:border-blue-400 bg-white" />
                </div>
                <div>
                  <Label htmlFor="exchangeRate" className="text-stone-700 font-semibold text-sm">{t('pricing.breakdown.fxRate', 'Exchange rate (LEI / EUR)')}</Label>
                  <Input id="exchangeRate" type="number" min={0.0001} step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} placeholder="4.97" className="mt-2 h-11 border-2 border-blue-200 focus-visible:ring-blue-400 focus-visible:border-blue-400 bg-white" />
                </div>
              </div>
              {hasValidInputs && calculatedBase != null ? (
                <div className="p-3 rounded-lg bg-white border border-blue-200 space-y-2">
                  <p className="text-sm text-stone-700">{t('pricing.breakdown.formula', 'Formula')}: ({parsedLei.toFixed(2)} / {parsedFx.toFixed(4)}) + {parsedTransport.toFixed(2)}</p>
                  <p className="text-sm text-stone-700">{t('pricing.breakdown.resultLei', 'Source cost converted to EUR')}: <span className="font-semibold">€{sourceCostEur?.toFixed(2)}</span></p>
                  <p className="text-sm text-stone-700">{t('pricing.breakdown.transportApplied', 'Transport allocation applied')}: <span className="font-semibold">+€{parsedTransport.toFixed(2)}</span></p>
                  <p className="text-sm text-stone-900">{t('pricing.breakdown.resultEur', 'Calculated landed base in EUR')}: <span className="font-bold">€{calculatedBase.toFixed(2)}</span></p>
                  <p className="text-sm text-stone-900">{t('pricing.breakdown.projectedStore', 'Projected store price at {{markup}}%', { markup })}: <span className="font-bold">€{calculatedStore?.toFixed(2)}</span></p>
                  {basePrice != null && baseDiff != null && (
                    <p className={`text-sm font-medium ${Math.abs(baseDiff) <= 0.01 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {t('pricing.breakdown.compare', 'Current saved base (without transport)')}: €{basePrice.toFixed(2)} ({baseDiff >= 0 ? '+' : ''}{baseDiff.toFixed(2)})
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-stone-600">{t('pricing.breakdown.placeholder', 'Fill all three fields with valid numbers to see the calculation.')}</p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
