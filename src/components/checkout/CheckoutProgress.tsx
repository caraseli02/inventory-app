import { useTranslation } from 'react-i18next';
import { CheckCircleIcon } from '../ui/Icons';

interface CheckoutProgressProps {
  currentStep: 'scan' | 'review' | 'complete';
}

type StepStatus = 'completed' | 'active' | 'pending';

function getCircleClasses(status: StepStatus): string {
  const base = 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all';
  switch (status) {
    case 'completed':
      return `${base} bg-[var(--color-forest)] text-white`;
    case 'active':
      return `${base} bg-stone-900 text-white ring-4 ring-stone-200`;
    case 'pending':
      return `${base} bg-stone-200 text-stone-500`;
  }
}

function getLabelClasses(status: StepStatus): string {
  const base = 'mt-1.5 text-xs font-medium whitespace-nowrap';
  switch (status) {
    case 'completed':
      return `${base} text-[var(--color-forest)]`;
    case 'active':
      return `${base} text-stone-900`;
    case 'pending':
      return `${base} text-stone-400`;
  }
}

/**
 * Progress indicator showing checkout steps: Scan Items -> Review -> Complete
 */
export function CheckoutProgress({ currentStep }: CheckoutProgressProps) {
  const { t } = useTranslation();

  const steps = [
    { id: 'scan', label: t('checkout.steps.scan') },
    { id: 'review', label: t('checkout.steps.review') },
    { id: 'complete', label: t('checkout.steps.complete') },
  ] as const;

  const currentIndex = steps.findIndex(s => s.id === currentStep);

  function getStatus(index: number): StepStatus {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'pending';
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-3">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStatus(index);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={getCircleClasses(status)}>
                  {status === 'completed' ? (
                    <CheckCircleIcon className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className={getLabelClasses(status)}>
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div className="flex-1 mx-2 mt-[-1rem]">
                  <div
                    className={`h-1 rounded-full transition-all ${
                      index < currentIndex ? 'bg-[var(--color-forest)]' : 'bg-stone-200'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
