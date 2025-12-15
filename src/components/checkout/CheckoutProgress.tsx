import { useTranslation } from 'react-i18next';
import { Stepper } from '../ui/stepper';

interface CheckoutProgressProps {
  currentStep: 'scan' | 'review' | 'complete';
}

/**
 * Progress indicator showing checkout steps: Scan Items -> Review -> Complete
 * Uses shadcn-style Stepper component for consistent design
 */
export function CheckoutProgress({ currentStep }: CheckoutProgressProps) {
  const { t } = useTranslation();

  const steps = [
    { id: 'scan', label: t('checkout.steps.scan') },
    { id: 'review', label: t('checkout.steps.review') },
    { id: 'complete', label: t('checkout.steps.complete') },
  ];

  return (
    <div className="w-full py-5">
      <Stepper steps={steps} currentStep={currentStep} />
    </div>
  );
}
