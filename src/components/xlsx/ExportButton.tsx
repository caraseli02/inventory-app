import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportToXlsx, type ExportProduct } from '@/lib/xlsx';
import { Download, Loader2 } from 'lucide-react';
import type { Product } from '@/types';

interface ExportButtonProps {
  products: Product[];
  className?: string;
}

/**
 * Map Product to ExportProduct format
 */
function mapProductToExport(product: Product): ExportProduct {
  return {
    Barcode: product.fields.Barcode,
    Name: product.fields.Name,
    Category: product.fields.Category,
    Price: product.fields.Price,
    price50: product.fields['Price 50%'],
    price70: product.fields['Price 70%'],
    price100: product.fields['Price 100%'],
    currentStock: product.fields['Current Stock Level'],
    minStock: product.fields['Min Stock Level'],
    Supplier: product.fields.Supplier,
    expiryDate: product.fields['Expiry Date'],
  };
}

export function ExportButton({ products, className }: ExportButtonProps) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (products.length === 0) return;

    setIsExporting(true);
    try {
      // Map products to export format
      const exportProducts = products.map(mapProductToExport);

      // Generate and download xlsx file
      exportToXlsx(exportProducts);

      toast.success(t('export.success'), {
        description: t('export.successMessage', { count: products.length }) + ' ' + t('export.downloadedHint', 'Check your Downloads folder.'),
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(t('export.failed'), {
        description: error instanceof Error ? error.message : t('errors.unknownError'),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isExporting || products.length === 0}
      className={className}
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {t('loading.default')}
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          {t('export.button')}
        </>
      )}
    </Button>
  );
}
