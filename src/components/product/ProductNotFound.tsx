import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface ProductNotFoundProps {
  barcode: string;
  onTryAgain: () => void;
  onAddNew: () => void;
}

/**
 * Component shown when a scanned barcode doesn't match any existing product.
 * Provides consistent error handling across Scan and Checkout modes.
 */
export const ProductNotFound = ({ barcode, onTryAgain, onAddNew }: ProductNotFoundProps) => {
  const { t } = useTranslation();

  return (
    <Card className="border-2 border-[var(--color-terracotta)]/50 bg-gradient-to-br from-red-50 to-orange-50">
      <CardContent className="p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-terracotta)]/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-[var(--color-terracotta)]" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-stone-900 mb-2">
          {t('scan.productNotFound', 'Product Not Found')}
        </h3>

        <p className="text-stone-600 mb-2">
          {t('scan.barcodeNotRecognized', 'The barcode was not recognized in your inventory.')}
        </p>

        <p className="text-sm font-mono text-stone-500 bg-stone-100 rounded-lg px-3 py-2 inline-block mb-6">
          {barcode}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={onTryAgain}
            className="border-2 border-stone-300 hover:bg-stone-100"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('scan.tryAgain', 'Try Again')}
          </Button>

          <Button
            onClick={onAddNew}
            className="text-white"
            style={{
              background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))',
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('scan.addNewProduct', 'Add New Product')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
