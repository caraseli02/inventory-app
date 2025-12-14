import { ArrowLeftIcon, CloseIcon } from './Icons';
import { Button } from './button';

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  onClose?: () => void;
  /** Optional: Use smaller text size (xs) instead of default (base) */
  variant?: 'default' | 'compact';
}

/**
 * Standardized page header component used across scanner and checkout pages
 *
 * Features:
 * - Back button (left) with ArrowLeftIcon
 * - Centered title text (supports different sizes via variant)
 * - Optional close button (right) with CloseIcon, defaults to back action if not provided
 * - Consistent styling matching "Fresh Precision" design system
 *
 * @param title - Header title text to display
 * @param onBack - Callback for back button click
 * @param onClose - Optional callback for close button click (defaults to onBack)
 * @param variant - Text size variant: 'default' (base) or 'compact' (xs), defaults to 'default'
 *
 * @example
 * // Standard header
 * <PageHeader
 *   title="Scan Product"
 *   onBack={() => navigate('home')}
 * />
 *
 * @example
 * // Compact header with longer descriptive text
 * <PageHeader
 *   title="Scan the items barcode inside the square frame to add items to your cart"
 *   onBack={() => navigate('home')}
 *   variant="compact"
 * />
 */
export const PageHeader = ({ title, onBack, onClose, variant = 'default' }: PageHeaderProps) => {
  const textClassName = variant === 'compact'
    ? 'text-stone-700 text-center text-xs font-medium'
    : 'text-stone-900 text-center text-base font-semibold';

  return (
    <div className="flex items-center justify-between px-4 border-b border-white/50 h-[50px]">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="h-8 w-8 text-stone-700 hover:text-stone-900 hover:bg-white/30"
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </Button>
      <p className={textClassName}>
        {title}
      </p>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose || onBack}
        className="h-8 w-8 text-stone-700 hover:text-stone-900 hover:bg-white/30"
      >
        <CloseIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};
