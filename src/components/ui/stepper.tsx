import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface StepperProps {
  steps: { id: string; label: string }[];
  currentStep: string;
  className?: string;
}

interface StepProps {
  step: { id: string; label: string };
  index: number;
  status: 'completed' | 'active' | 'pending';
  isLast: boolean;
}

function Step({ step, index, status, isLast }: StepProps) {
  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full text-base font-bold transition-all',
            status === 'completed' && 'bg-[var(--color-forest)] text-white',
            status === 'active' && 'bg-stone-900 text-white ring-4 ring-stone-300',
            status === 'pending' && 'bg-stone-200 text-stone-500'
          )}
        >
          {status === 'completed' ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            index + 1
          )}
        </div>
        <span
          className={cn(
            'mt-2 text-sm font-semibold whitespace-nowrap',
            status === 'completed' && 'text-[var(--color-forest)]',
            status === 'active' && 'text-stone-900',
            status === 'pending' && 'text-stone-400'
          )}
        >
          {step.label}
        </span>
      </div>

      {!isLast && (
        <div className="mx-4 h-1 w-16 rounded-full bg-stone-200">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              status === 'completed' ? 'w-full bg-[var(--color-forest)]' : 'w-0'
            )}
          />
        </div>
      )}
    </div>
  );
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ steps, currentStep, className }, ref) => {
    const currentIndex = steps.findIndex((s) => s.id === currentStep);

    // Validate that currentStep matches a valid step ID
    if (currentIndex === -1 && process.env.NODE_ENV !== 'production') {
      console.warn(
        `[Stepper] Invalid currentStep "${currentStep}". Valid step IDs are: ${steps.map((s) => s.id).join(', ')}`
      );
    }

    function getStatus(index: number): 'completed' | 'active' | 'pending' {
      // If currentStep is invalid, default to first step being active
      const effectiveIndex = currentIndex === -1 ? 0 : currentIndex;
      if (index < effectiveIndex) return 'completed';
      if (index === effectiveIndex) return 'active';
      return 'pending';
    }

    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-center', className)}
      >
        {steps.map((step, index) => (
          <Step
            key={step.id}
            step={step}
            index={index}
            status={getStatus(index)}
            isLast={index === steps.length - 1}
          />
        ))}
      </div>
    );
  }
);

Stepper.displayName = 'Stepper';

export { Stepper };
