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
import type { Product } from '@/types';
import { parseXlsxFile, type ImportedProduct, type ImportResult as ParseImportResult } from '@/lib/xlsx';
import type { ImportResult as RunnerImportResult } from '@/lib/importRunnerTypes';
import { getAlreadyImportedExcelRowIds } from '@/lib/excelImportIdempotency';
import {
  applyExcelImportAction,
  buildXlsxPreviewRows,
  getXlsxBlockingErrorMessage,
  type XlsxImportAction,
  type XlsxPreviewRow,
} from '@/lib/xlsx/preview';
import { ImportPreviewPagination } from '@/components/xlsx/ImportPreviewPagination';
import { ImportPreviewTable } from '@/components/xlsx/ImportPreviewTable';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (
    products: ImportedProduct[],
    onProgress?: (current: number, total: number) => void
  ) => Promise<RunnerImportResult>;
  products: Product[];
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';
const XLSX_PREVIEW_PAGE_SIZE = 50;

export function ImportDialog({ open, onOpenChange, onImport, products }: ImportDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<ParseImportResult | null>(null);
  const [completedImportResult, setCompletedImportResult] = useState<RunnerImportResult | null>(null);
  const [previewRows, setPreviewRows] = useState<XlsxPreviewRow[]>([]);
  const [previewPage, setPreviewPage] = useState(0);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const formatImportMessage = useCallback((message: { message: string; messageKey?: string; messageValues?: Record<string, string | number> }) => {
    if (!message.messageKey) return message.message;
    return t(message.messageKey, {
      ...message.messageValues,
      defaultValue: message.message,
    });
  }, [t]);

  const resetState = useCallback(() => {
    setStep('upload');
    setImportResult(null);
    setCompletedImportResult(null);
    setPreviewRows([]);
    setPreviewPage(0);
    setImportProgress({ current: 0, total: 0 });
    setImportErrors([]);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState]);

  const handleFileSelect = useCallback(async (file: File) => {
    setImportErrors([]);
    setCompletedImportResult(null);

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setImportResult({
        success: false,
        products: [],
        errors: [{
          row: 0,
          message: 'Please select an Excel file (.xlsx or .xls)',
          messageKey: 'import.errors.invalidFileType',
        }],
        warnings: [],
        totalRows: 0,
        validRows: 0,
      });
      return;
    }

    const result = await parseXlsxFile(file);
    setImportResult(result);
    setPreviewRows([]);

    if (result.success) {
      let alreadyImportedRowIds = new Set<string>();
      const batchId = result.products[0]?.excelBatchId;

      if (batchId) {
        try {
          alreadyImportedRowIds = await getAlreadyImportedExcelRowIds({ batchId });
        } catch (error) {
          setImportErrors([
            error instanceof Error
              ? error.message
              : 'Could not load previous Excel batch history. Import-time duplicate safety is still active.',
          ]);
        }
      }

      setPreviewRows(buildXlsxPreviewRows(result.products, products, alreadyImportedRowIds));
      setPreviewPage(0);
      setStep('preview');
    }
  }, [products]);

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
    const importableRows = previewRows.filter((row) => row.importAction !== 'skip' && !row.blockingError);
    if (!importableRows.length) return;

    setStep('importing');
    setImportProgress({ current: 0, total: importableRows.length });
    setImportErrors([]);

    try {
      const result = await onImport(
        previewRows.map((row) => row.product),
        (current, total) => setImportProgress({ current, total })
      );
      setCompletedImportResult(result);

      if (result.fatalError) {
        setImportErrors([result.fatalError]);
        setStep('preview');
        return;
      }

      if (result.errorCount > 0 || result.partialProducts.length > 0) {
        const nextErrors: string[] = [];
        if (result.failedProducts.length > 0) {
          nextErrors.push(
            ...result.failedProducts.slice(0, 3).map((entry) => `${entry.name}: ${entry.error}`)
          );
        }
        if (result.partialProducts.length > 0) {
          nextErrors.push(
            ...result.partialProducts.slice(0, 3).map((entry) => `${entry.name}: ${entry.message}`)
          );
        }
        if (nextErrors.length === 0) nextErrors.push(t('import.failed'));
        setImportErrors(nextErrors);
        setStep('preview');
        return;
      }

      setStep('complete');
    } catch (error) {
      setImportErrors([error instanceof Error ? error.message : 'Import failed']);
      setStep('preview');
    }
  }, [onImport, previewRows, t]);

  const handleActionChange = useCallback((previewId: string, nextAction: XlsxImportAction) => {
    setPreviewRows((currentRows) => currentRows.map((row) => (
      row.previewId === previewId ? applyExcelImportAction(row, nextAction) : row
    )));
  }, []);

  const actionableRows = previewRows.filter((row) => row.importAction !== 'skip' && !row.blockingError);
  const blockingRows = previewRows.filter((row) => row.blockingError);
  const totalPreviewPages = Math.max(1, Math.ceil(previewRows.length / XLSX_PREVIEW_PAGE_SIZE));
  const safePreviewPage = Math.min(previewPage, totalPreviewPages - 1);
  const visiblePreviewRows = previewRows.slice(
    safePreviewPage * XLSX_PREVIEW_PAGE_SIZE,
    (safePreviewPage + 1) * XLSX_PREVIEW_PAGE_SIZE,
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-2xl min-h-[70vh] max-h-[90vh] overflow-hidden flex flex-col">
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

              {importResult && !importResult.success && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700">{t('import.errorParsing')}</p>
                      {importResult.errors.map((error, i) => (
                        <p key={i} className="text-sm text-red-600 mt-1">
                          {error.row > 0 && t('import.rowError', { row: error.row, message: formatImportMessage(error) })}
                          {error.row === 0 && formatImportMessage(error)}
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
              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg">
                <CheckCircle2 className="h-8 w-8 text-[var(--color-forest)]" />
                <div>
                  <p className="font-semibold text-stone-900">
                    {t('import.productsReady', { count: actionableRows.length || importResult.validRows })}
                  </p>
                  <p className="text-sm text-stone-500">
                    {t('import.totalRowsFound', { count: importResult.totalRows })}
                  </p>
                </div>
              </div>

              {blockingRows.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-medium text-red-700 mb-2">
                    {t('import.blockingRows', { count: blockingRows.length, defaultValue: '{{count}} rows must be fixed before import' })}
                  </p>
                  <div className="max-h-40 overflow-auto space-y-1">
                    {blockingRows.slice(0, 10).map((row) => (
                      <p key={row.previewId} className="text-sm text-red-600">
                        {row.product.Name}: {getXlsxBlockingErrorMessage(row, t)}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {importResult.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="font-medium text-amber-700 mb-2">{t('import.warnings')}</p>
                  {importResult.warnings.map((warning, i) => (
                    <p key={i} className="text-sm text-amber-600">{formatImportMessage(warning)}</p>
                  ))}
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-medium text-red-700 mb-2">
                    {t('import.rowsSkipped', { count: importResult.errors.length })}
                  </p>
                  <div className="max-h-32 overflow-auto">
                    {importResult.errors.slice(0, 10).map((error, i) => (
                      <p key={i} className="text-sm text-red-600">
                        {t('import.rowError', { row: error.row, message: formatImportMessage(error) })}
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

              <ImportPreviewTable
                rows={visiblePreviewRows}
                t={t}
                onActionChange={handleActionChange}
              />

              {previewRows.length > XLSX_PREVIEW_PAGE_SIZE && (
                <ImportPreviewPagination
                  currentPage={safePreviewPage}
                  pageSize={XLSX_PREVIEW_PAGE_SIZE}
                  t={t}
                  totalPages={totalPreviewPages}
                  totalRows={previewRows.length}
                  onPrevious={() => setPreviewPage((current) => Math.max(0, current - 1))}
                  onNext={() => setPreviewPage((current) => Math.min(totalPreviewPages - 1, current + 1))}
                />
              )}

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
                {t('import.successfullyImported', { count: completedImportResult?.successCount ?? 0 })}
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
                disabled={actionableRows.length === 0 || blockingRows.length > 0}
              >
                {t('import.importCount', { count: actionableRows.length })}
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
