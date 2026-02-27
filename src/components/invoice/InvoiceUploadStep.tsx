import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle, Loader2, Receipt } from 'lucide-react';
import { VALID_INVOICE_EXTENSIONS } from '@/lib/invoiceOCR';

interface InvoiceUploadStepProps {
  isDragging: boolean;
  isProcessing: boolean;
  ocrProgress: number;
  fileName: string;
  error: string | null;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  t: TFunction;
}

export function InvoiceUploadStep({
  isDragging,
  isProcessing,
  ocrProgress,
  fileName,
  error,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInput,
  t,
}: InvoiceUploadStepProps) {
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Drag & Drop Zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${isDragging
            ? 'border-[var(--color-lavender)] bg-[var(--color-lavender)]/5'
            : 'border-stone-300 hover:border-stone-400'
          }
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <Upload className="h-12 w-12 mx-auto text-stone-400 mb-4" />
        <p className="text-lg font-medium text-stone-700 mb-2">
          {t('invoiceUpload.dropzone.title', 'Drag and drop your invoice here')}
        </p>
        <p className="text-sm text-stone-500 mb-4">
          {t('invoiceUpload.dropzone.subtitle', 'or click to browse files')}
        </p>
        <p className="text-xs text-stone-400 mb-4">
          {t('invoiceUpload.dropzone.fileTypes', 'Supports PDF (max 10MB)')}
        </p>
        <input
          type="file"
          accept={VALID_INVOICE_EXTENSIONS.join(',')}
          onChange={onFileInput}
          className="hidden"
          id="invoice-upload"
          disabled={isProcessing}
        />
        <label htmlFor="invoice-upload">
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={isProcessing}
            onClick={() => document.getElementById('invoice-upload')?.click()}
          >
            {t('invoiceUpload.dropzone.selectFile', 'Select Invoice File')}
          </Button>
        </label>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div className="flex-1">
              <p className="font-medium text-blue-900">{fileName}</p>
              <p className="text-sm text-blue-600">
                {(() => {
                  if (ocrProgress < 50) return t('invoiceUpload.progress.preparing', 'Preparing invoice...');
                  if (ocrProgress < 80) return t('invoiceUpload.progress.extracting', 'Extracting data...');
                  return t('invoiceUpload.progress.finalizing', 'Finalizing...');
                })()}
              </p>
            </div>
            <span className="text-sm font-medium text-blue-700">{ocrProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${ocrProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* AI Info */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <p className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          {t('invoiceUpload.howItWorks.title', 'How it works')}
        </p>
        <ul className="text-xs text-stone-600 space-y-1.5">
          <li>• {t('invoiceUpload.howItWorks.step1', 'Step 1: Upload your PDF invoice')}</li>
          <li>• {t('invoiceUpload.howItWorks.step2', 'Step 2: Extracts product names, quantities, and prices')}</li>
          <li>• {t('invoiceUpload.howItWorks.step3', 'Step 3: You review and confirm before importing')}</li>
          <li className="pt-1 text-[var(--color-forest)] font-medium">
            ✓ {t('invoiceUpload.howItWorks.fast', 'Fast and accurate PDF processing')}
          </li>
        </ul>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700">
                {t('invoiceUpload.errors.extractionFailed', 'Extraction failed')}
              </p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
