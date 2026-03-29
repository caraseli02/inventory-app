import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types';
import type { ImportedProduct } from '../lib/xlsx';
import type { ImportResult } from '../lib/importRunnerTypes';
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
    ): Promise<ImportResult> => {
      const importSources = new Set(importedProducts.map((p) => p.importSource ?? 'xlsx'));
      if (importSources.size > 1) {
        const message = t('import.mixedSourcesNotSupported', 'Import batch contains mixed sources. Please import invoice and XLSX files separately.');
        showToast(
          'error',
          t('import.failed'),
          message,
          8000
        );
        return {
          successCount: 0,
          skipCount: 0,
          errorCount: 1,
          invoiceDuplicateSkipCount: 0,
          xlsxDuplicateSkipCount: 0,
          failedProducts: [],
          partialProducts: [],
          fatalError: message,
        };
      }

      if (importSources.has('invoice')) {
        const result = await runInvoiceImport(importedProducts, allProducts, t, onProgress);
        await refetch();
        const { toastType, title, message } = buildInvoiceImportToast(result, t);
        showToast(toastType, title, message, 8000);
        return result;
      }

      const result = await runXlsxImport(importedProducts, allProducts, t, onProgress);
      await refetch();

      if (result.fatalError) {
        showToast(
          'error',
          t('import.failed'),
          `Import stopped: ${result.fatalError}. ${result.successCount} products were imported successfully.`,
          10000
        );
        return result;
      }

      const { toastType, title, message } = buildXlsxImportToast(result, t);
      showToast(toastType, title, message, 8000);
      return result;
    },
    [allProducts, refetch, showToast, t]
  );

  return { handleImport };
}
