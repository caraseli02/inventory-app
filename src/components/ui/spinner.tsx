import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

/**
 * Loading spinner component with optional label
 * Uses Tailwind animation utilities for smooth rotation
 */
export const Spinner = ({ size = 'md', className, label }: SpinnerProps) => {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-4',
    lg: 'h-16 w-16 border-4',
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'animate-spin rounded-full border-stone-200 border-t-stone-700',
          sizeClasses[size],
          className
        )}
      />
      {label && (
        <p className="text-stone-900 text-sm font-medium">{label}</p>
      )}
    </div>
  );
};
