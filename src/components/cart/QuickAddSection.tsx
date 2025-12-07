import { useState, type FormEvent } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface QuickAddSectionProps {
  onAddItem: (barcode: string) => void;
  isPending?: boolean;
}

/**
 * QuickAddSection - Inline barcode input for adding items while viewing cart
 *
 * Allows users to add items to cart without collapsing the cart view.
 * Features a compact, visually distinct design with dashed border.
 */
export const QuickAddSection = ({ onAddItem, isPending = false }: QuickAddSectionProps) => {
  const [barcode, setBarcode] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (barcode.trim().length > 3) {
      onAddItem(barcode.trim());
      setBarcode('');
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-dashed border-blue-400 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚡</span>
        <h3 className="text-sm font-bold text-blue-900">Quick Add Item</h3>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Scan or enter barcode"
          className="flex-1 text-sm font-mono tracking-wider border-2 border-blue-300 focus-visible:ring-blue-500"
          disabled={isPending}
        />
        <Button
          type="submit"
          disabled={barcode.length < 3 || isPending}
          size="icon"
          className="bg-blue-600 hover:bg-blue-700 text-white h-10 w-10"
        >
          {isPending ? '...' : '+'}
        </Button>
      </form>
    </div>
  );
};
