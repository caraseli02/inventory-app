import { useEffect, useState } from 'react';
import { CheckCircleIcon, CloseIcon, WarningIcon } from './Icons';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const toastStyles: Record<ToastType, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
};

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircleIcon className="h-5 w-5 text-emerald-600" />,
  error: <WarningIcon className="h-5 w-5 text-red-600" />,
  warning: <WarningIcon className="h-5 w-5 text-amber-600" />,
  info: <WarningIcon className="h-5 w-5 text-blue-600" />,
};

/**
 * Individual toast notification component
 */
export const ToastItem = ({ toast, onDismiss }: ToastProps) => {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border-2 shadow-lg transition-all duration-300 min-w-[320px] max-w-md',
        toastStyles[toast.type],
        isLeaving ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      )}
    >
      {toastIcons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{toast.title}</p>
        {toast.description && (
          <p className="text-xs mt-1 opacity-90">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => {
          setIsLeaving(true);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

/**
 * Toast container that displays all active toasts
 */
export const ToastContainer = ({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};
