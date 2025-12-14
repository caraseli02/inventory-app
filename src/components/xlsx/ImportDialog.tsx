import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { parseXlsxFile, type ImportedProduct, type ImportResult } from '@/lib/xlsx';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (products: ImportedProduct[]) => Promise<void>;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const resetState = useCallback(() => {
    setStep('upload');
    setImportResult(null);
    setImportProgress({ current: 0, total: 0 });
    setImportErrors([]);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setImportResult({
        success: false,
        products: [],
        errors: [{ row: 0, message: 'Please select an Excel file (.xlsx or .xls)' }],
        warnings: [],
        totalRows: 0,
        validRows: 0,
      });
      return;
    }

    const result = await parseXlsxFile(file);
    setImportResult(result);

    if (result.success) {
      setStep('preview');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleConfirmImport = useCallback(async () => {
    if (!importResult?.products.length) return;

    setStep('importing');
    setImportProgress({ current: 0, total: importResult.products.length });
    setImportErrors([]);

    try {
      await onImport(importResult.products);
      setStep('complete');
    } catch (error) {
      setImportErrors([error instanceof Error ? error.message : 'Import failed']);
      setStep('preview');
    }
  }, [importResult, onImport]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[var(--color-forest)]" />
            {t('import.title')}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && t('import.description')}
            {step === 'preview' && t('import.reviewDescription')}
            {step === 'importing' && t('import.importingDescription')}
            {step === 'complete' && t('import.completeDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drag & Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  border-2 border-dashed rounded-xl p-8 text-center transition-colors
                  ${isDragging
                    ? 'border-[var(--color-forest)] bg-[var(--color-forest)]/5'
                    : 'border-stone-300 hover:border-stone-400'
                  }
                `}
              >
                <Upload className="h-12 w-12 mx-auto text-stone-400 mb-4" />
                <p className="text-lg font-medium text-stone-700 mb-2">
                  {t('import.dragDrop')}
                </p>
                <p className="text-sm text-stone-500 mb-4">
                  {t('import.orClickToBrowse')}
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    {t('import.selectFile')}
                  </Button>
                </label>
              </div>

              {/* Sample File Link */}
              <p className="text-sm text-stone-500 text-center">
                {t('import.needTemplate')}{' '}
                <a
                  href="/magazin.xlsx"
                  download
                  className="text-[var(--color-forest)] hover:underline"
                >
                  {t('import.downloadSample')}
                </a>
              </p>

              {/* Parse Errors */}
              {importResult && !importResult.success && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700">{t('import.errorParsing')}</p>
                      {importResult.errors.map((error, i) => (
                        <p key={i} className="text-sm text-red-600 mt-1">
                          {error.row > 0 && t('import.rowError', { row: error.row, message: error.message })}
                          {error.row === 0 && error.message}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && importResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg">
                <CheckCircle2 className="h-8 w-8 text-[var(--color-forest)]" />
                <div>
                  <p className="font-semibold text-stone-900">
                    {t('import.productsReady', { count: importResult.validRows })}
                  </p>
                  <p className="text-sm text-stone-500">
                    {t('import.totalRowsFound', { count: importResult.totalRows })}
                  </p>
                </div>
              </div>

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="font-medium text-amber-700 mb-2">{t('import.warnings')}</p>
                  {importResult.warnings.map((warning, i) => (
                    <p key={i} className="text-sm text-amber-600">{warning}</p>
                  ))}
                </div>
              )}

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-medium text-red-700 mb-2">
                    {t('import.rowsSkipped', { count: importResult.errors.length })}
                  </p>
                  <div className="max-h-32 overflow-auto">
                    {importResult.errors.slice(0, 10).map((error, i) => (
                      <p key={i} className="text-sm text-red-600">
                        {t('import.rowError', { row: error.row, message: error.message })}
                      </p>
                    ))}
                    {importResult.errors.length > 10 && (
                      <p className="text-sm text-red-500 mt-1">
                        {t('import.andMoreErrors', { count: importResult.errors.length - 10 })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Product Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-stone-700">{t('import.tableBarcode')}</th>
                        <th className="px-3 py-2 text-left font-medium text-stone-700">{t('import.tableName')}</th>
                        <th className="px-3 py-2 text-left font-medium text-stone-700">{t('import.tableCategory')}</th>
                        <th className="px-3 py-2 text-right font-medium text-stone-700">{t('import.tablePrice')}</th>
                        <th className="px-3 py-2 text-right font-medium text-stone-700">{t('import.tableStock')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {importResult.products.slice(0, 10).map((product, i) => (
                        <tr key={i} className="hover:bg-stone-50">
                          <td className="px-3 py-2 font-mono text-xs">{product.Barcode}</td>
                          <td className="px-3 py-2">{product.Name}</td>
                          <td className="px-3 py-2">
                            {product.Category && (
                              <Badge variant="secondary" className="text-xs">
                                {product.Category}
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {(product.price70 ?? product.Price) !== undefined
                              ? `€${(product.price70 ?? product.Price)!.toFixed(2)}`
                              : '-'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {product.currentStock ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importResult.products.length > 10 && (
                  <div className="px-3 py-2 bg-stone-50 text-sm text-stone-500 text-center">
                    {t('import.showingProducts', { showing: 10, total: importResult.products.length })}
                  </div>
                )}
              </div>

              {/* Import Errors */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-medium text-red-700">{t('import.failed')}</p>
                  {importErrors.map((error, i) => (
                    <p key={i} className="text-sm text-red-600 mt-1">{error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-[var(--color-forest)] mb-4" />
              <p className="text-lg font-medium text-stone-700">
                {t('import.importingProducts')}
              </p>
              <p className="text-sm text-stone-500 mt-2">
                {t('import.productProgress', { current: importProgress.current, total: importProgress.total })}
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-16 w-16 text-[var(--color-forest)] mb-4" />
              <p className="text-xl font-semibold text-stone-900 mb-2">
                {t('import.importComplete')}
              </p>
              <p className="text-stone-600">
                {t('import.successfullyImported', { count: importResult?.validRows ?? 0 })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              {t('import.cancel')}
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetState}>
                {t('import.back')}
              </Button>
              <Button
                onClick={handleConfirmImport}
                className="bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white"
                disabled={!importResult?.products.length}
              >
                {t('import.importCount', { count: importResult?.validRows ?? 0 })}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button
              onClick={handleClose}
              className="bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white"
            >
              {t('import.done')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
