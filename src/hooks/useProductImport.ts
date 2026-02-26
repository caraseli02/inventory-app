import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types';
import type { ImportedProduct } from '../lib/xlsx';
import { useToast } from './useToast';
import { runInvoiceImport, runXlsxImport, buildInvoiceImportToast, buildXlsxImportToast } from '../lib/importRunners';

interface UseProductImportProps {
  allProducts: Product[];
  refetch: () => Promise<unknown>;
}

export function useProductImport({ allProducts, refetch }: UseProductImportProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const handleImport = useCallback(
    async (
      importedProducts: ImportedProduct[],
      onProgress?: (current: number, total: number) => void
    ) => {
      const importSources = new Set(importedProducts.map((p) => p.importSource ?? 'xlsx'));
      if (importSources.size > 1) {
        showToast(
          'error',
          t('import.failed'),
          t('import.mixedSourcesNotSupported', 'Import batch contains mixed sources. Please import invoice and XLSX files separately.'),
          8000
        );
        return;
      }

      if (importSources.has('invoice')) {
        const result = await runInvoiceImport(importedProducts, allProducts, t, onProgress);
        await refetch();
        const { toastType, title, message } = buildInvoiceImportToast(result, t);
        showToast(toastType, title, message, 8000);
        return;
      }

      const result = await runXlsxImport(importedProducts, t, onProgress);
      await refetch();

      if (result.fatalError) {
        showToast(
          'error',
          t('import.failed'),
          `Import stopped: ${result.fatalError}. ${result.successCount} products were imported successfully.`,
          10000
        );
        return;
      }

      const { toastType, title, message } = buildXlsxImportToast(result, t);
      showToast(toastType, title, message, 8000);
    },
    [allProducts, refetch, showToast, t]
  );

  return { handleImport };
}
