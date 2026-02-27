import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Receipt, CheckCircle2 } from 'lucide-react';
import type { ImportedProduct } from '@/lib/xlsx/index';
import type { Product } from '@/types';
import type { InvoiceImportAction } from '@/lib/invoiceImportDiffs';
import { isValidNumber, useInvoiceImport } from '@/hooks/useInvoiceImport';
import { InvoiceUploadStep } from './InvoiceUploadStep';
import { InvoicePreviewTable } from './InvoicePreviewTable';

interface InvoiceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (products: ImportedProduct[], onProgress?: (current: number, total: number) => void) => Promise<void>;
  products: Product[];
}

export function InvoiceUploadDialog({ open, onOpenChange, onImport, products }: InvoiceUploadDialogProps) {
  const h = useInvoiceImport({ open, onOpenChange, onImport, products });

  const handleActionChange = (previewId: string, action: InvoiceImportAction) => {
    h.setManualActionPreviewIds((prev) => new Set(prev).add(previewId));
    h.setImportActions((prev) => ({ ...prev, [previewId]: action }));
  };

  return (
    <Dialog open={open} onOpenChange={h.handleClose}>
      <DialogContent className="w-[100vw] h-[100vh] md:w-[90vw] md:h-[90vh] md:max-w-[1400px] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-stone-200">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-6 w-6 text-[var(--color-forest)]" />
            {h.t('invoiceUpload.title', 'Import from Invoice')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {h.t(`invoiceUpload.stepDescriptions.${h.step}` as const, {
              defaultValue: {
                upload: 'Upload an invoice to automatically extract product data',
                preview: 'Review extracted products before importing',
                importing: 'Creating products in your inventory...',
                complete: 'Invoice products have been imported successfully',
              }[h.step],
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 py-4">
          {h.step === 'upload' && (
            <InvoiceUploadStep
              isDragging={h.isDragging} isProcessing={h.isProcessing}
              ocrProgress={h.ocrProgress} fileName={h.fileName} error={h.error}
              onDrop={h.handleDrop} onDragOver={h.handleDragOver} onDragLeave={h.handleDragLeave}
              onFileInput={h.handleFileInput} t={h.t}
            />
          )}

          {h.step === 'preview' && h.invoiceData && (
            <InvoicePreviewTable
              invoiceData={h.invoiceData}
              editableProducts={h.editableProducts}
              editingIndex={h.editingIndex}
              matchResults={h.matchResults}
              importActions={h.importActions}
              rowFlags={h.rowFlags}
              pricingComputedByRowId={h.pricingComputedByRowId}
              fxRate={h.fxRate}
              isFxReady={h.isFxReady}
              isFxManual={h.isFxManual}
              fxRateError={h.fxRateError}
              importableRowCount={h.importableRowCount}
              importErrors={h.importErrors}
              getResolvedDefaultAction={h.getResolvedDefaultAction}
              onFxRateChange={h.handleFxRateChange}
              onEditProduct={h.handleEditProduct}
              onSaveEdit={h.handleSaveEdit}
              onCancelEdit={h.handleCancelEdit}
              onRemoveProduct={h.handleRemoveProduct}
              onFieldChange={h.handleProductFieldChange}
              onActionChange={handleActionChange}
              t={h.t}
            />
          )}

          {h.step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-[var(--color-forest)] mb-4" />
              <p className="text-lg font-medium text-stone-700">{h.t('invoiceUpload.status.importing', 'Importing products...')}</p>
              <p className="text-sm text-stone-500 mt-2">
                {h.t('invoiceUpload.status.importingProgress', { current: h.importProgress.current, total: h.importProgress.total, defaultValue: '{{current}} of {{total}} products processed' })}
              </p>
            </div>
          )}

          {h.step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-16 w-16 text-[var(--color-forest)] mb-4" />
              <p className="text-xl font-semibold text-stone-900 mb-2">{h.t('invoiceUpload.status.completeTitle', 'Import Complete!')}</p>
              <p className="text-stone-600">
                {h.t('invoiceUpload.status.completeSubtitle', { count: h.editableProducts.length, defaultValue: 'Successfully imported {{count}} products from invoice' })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-stone-200">
          {h.step === 'upload' && (
            <Button variant="outline" onClick={h.handleClose} disabled={h.isProcessing}>
              {h.t('invoiceUpload.actions.cancel', 'Cancel')}
            </Button>
          )}
          {h.step === 'preview' && (
            <>
              <Button variant="outline" onClick={h.resetState}>{h.t('invoiceUpload.actions.back', 'Back')}</Button>
              <Button
                onClick={h.handleConfirmImport}
                className="bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white"
                disabled={
                  !h.editableProducts.length || h.importableRowCount === 0 || !h.isFxReady ||
                  h.editableProducts.some((p) => !isValidNumber(p.weightKg))
                }
              >
                {h.t('invoiceUpload.actions.importCount', { count: h.importableRowCount, defaultValue: 'Import {{count}} Products' })}
              </Button>
            </>
          )}
          {h.step === 'complete' && (
            <Button onClick={h.handleClose} className="bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white">
              {h.t('invoiceUpload.actions.done', 'Done')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
