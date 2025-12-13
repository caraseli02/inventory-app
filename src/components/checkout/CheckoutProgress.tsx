import { useTranslation } from 'react-i18next';
import { CheckCircleIcon } from '../ui/Icons';

interface CheckoutProgressProps {
  currentStep: 'scan' | 'review' | 'complete';
}

/**
 * Progress indicator showing checkout steps: Scan Items → Review → Complete
 */
export const CheckoutProgress = ({ currentStep }: CheckoutProgressProps) => {
  const { t } = useTranslation();

  const steps = [
    { id: 'scan', label: t('checkout.steps.scan') },
    { id: 'review', label: t('checkout.steps.review') },
    { id: 'complete', label: t('checkout.steps.complete') },
  ];

  const getStepIndex = (stepId: string) => steps.findIndex(s => s.id === stepId);
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-3">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle and Label */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isCompleted
                      ? 'bg-[var(--color-forest)] text-white'
                      : isActive
                      ? 'bg-stone-900 text-white ring-4 ring-stone-200'
                      : 'bg-stone-200 text-stone-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircleIcon className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                    isActive ? 'text-stone-900' : isCompleted ? 'text-[var(--color-forest)]' : 'text-stone-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector Line */}
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
};
