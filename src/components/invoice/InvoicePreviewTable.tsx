import type { TFunction } from 'i18next';
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import type { InvoiceData } from '@/lib/invoiceOCR';
import type { InvoiceImportAction } from '@/lib/invoiceImportDiffs';
import type { InvoicePreviewProduct, InvoiceMatchResult, PricingByRowId, RowFlag } from '@/hooks/useInvoiceImport';
import { isValidNumber } from '@/hooks/useInvoiceImport';
import { InvoiceTableRow } from './InvoiceTableRow';

interface InvoicePreviewTableProps {
  invoiceData: InvoiceData;
  editableProducts: InvoicePreviewProduct[];
  editingIndex: number | null;
  matchResults: (InvoiceMatchResult | null)[];
  importActions: Record<string, InvoiceImportAction>;
  rowFlags: RowFlag[];
  pricingComputedByRowId: PricingByRowId;
  fxRate: number | null;
  isFxReady: boolean;
  isFxManual: boolean;
  fxRateError: string | null;
  importableRowCount: number;
  importErrors: string[];
  getResolvedDefaultAction: (index: number) => InvoiceImportAction;
  onFxRateChange: (value: string) => void;
  onEditProduct: (idx: number) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemoveProduct: (idx: number) => void;
  onFieldChange: (idx: number, field: keyof InvoicePreviewProduct, value: string | number) => void;
  onActionChange: (previewId: string, action: InvoiceImportAction) => void;
  t: TFunction;
}

export function InvoicePreviewTable({
  invoiceData, editableProducts, editingIndex, matchResults, importActions, rowFlags,
  fxRate, isFxReady, isFxManual, fxRateError, importableRowCount, importErrors,
  getResolvedDefaultAction, onFxRateChange, onEditProduct, onSaveEdit, onCancelEdit,
  onRemoveProduct, onFieldChange, onActionChange, t,
}: InvoicePreviewTableProps) {
  return (
    <div className="space-y-4">
      {/* Invoice Summary */}
      <div className="flex items-start gap-4 p-4 bg-stone-50 rounded-lg border-2 border-stone-200">
        <CheckCircle2 className="h-8 w-8 text-[var(--color-forest)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-900">
            {t('invoiceUpload.preview.extracted', { count: editableProducts.length, defaultValue: 'Successfully extracted {{count}} products' })}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
            {invoiceData.supplier && (
              <><span className="text-stone-600">{t('invoiceUpload.preview.supplier', 'Supplier:')}</span><span className="font-medium text-stone-900">{invoiceData.supplier}</span></>
            )}
            {invoiceData.invoiceNumber && (
              <><span className="text-stone-600">{t('invoiceUpload.preview.invoiceNumber', 'Invoice #:')}</span><span className="font-medium text-stone-900 font-mono text-xs">{invoiceData.invoiceNumber}</span></>
            )}
            {invoiceData.invoiceDate && (
              <><span className="text-stone-600">{t('invoiceUpload.preview.date', 'Date:')}</span><span className="font-medium text-stone-900">{invoiceData.invoiceDate}</span></>
            )}
          </div>
        </div>
      </div>

      {/* FX Rate */}
      <div className="p-4 bg-white rounded-lg border-2 border-stone-200 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-stone-800">{t('invoiceUpload.fx.title', 'FX Rate (MDL per EUR)')}</p>
          <Badge variant="outline" className="text-xs">
            {isFxManual ? t('invoiceUpload.fx.manual', 'Manual') : t('invoiceUpload.fx.default', { rate: '19.5', defaultValue: 'Default ({{rate}})' })}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input type="number" value={fxRate ?? ''} onChange={(e) => onFxRateChange(e.target.value)} step="0.0001" min="0" placeholder={t('invoiceUpload.fx.placeholder', 'Enter rate')} className="max-w-[220px]" />
        </div>
        {fxRateError && <p className="text-xs text-red-600">{fxRateError}</p>}
      </div>

      {/* Warning: no barcodes */}
      {editableProducts.some((p) => !p.barcode) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800 mb-1">{t('invoiceUpload.preview.noBarcodeTitle', "Note: Some products don't have barcodes")}</p>
          <p className="text-xs text-amber-700">{t('invoiceUpload.preview.noBarcodeDescription', 'You can scan barcodes later using the edit button for each product.')}</p>
        </div>
      )}

      {/* Warning: missing weight */}
      {editableProducts.some((p) => !isValidNumber(p.weightKg)) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-800 mb-1">{t('invoiceUpload.preview.missingWeightTitle', 'Weight required for transport cost')}</p>
          <p className="text-xs text-red-700">{t('invoiceUpload.preview.missingWeightDescription', 'Set missing product weights (kg) before importing.')}</p>
        </div>
      )}

      {/* Product table */}
      <div className="border-2 border-stone-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 500px)', minHeight: '300px' }}>
          <Table>
            <TableHeader className="bg-stone-100 sticky top-0 z-10">
              <TableRow>
                <TableHead className="px-4 py-3 text-left font-semibold text-stone-700 w-[28%]">{t('invoiceUpload.table.productName', 'Product Name')}</TableHead>
                <TableHead className="px-4 py-3 text-left font-semibold text-stone-700 w-[12%]">{t('invoiceUpload.table.category', 'Category')}</TableHead>
                <TableHead className="px-4 py-3 text-left font-semibold text-stone-700 w-[16%]">{t('invoiceUpload.table.barcode', 'Barcode')}</TableHead>
                <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[8%]">{t('invoiceUpload.table.quantity', 'Qty')}</TableHead>
                <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[10%]">{t('invoiceUpload.table.unitPrice', 'Unit Price')} ({isFxReady ? 'EUR' : 'LEI'})</TableHead>
                <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[10%]">{t('invoiceUpload.table.total', 'Total')} ({isFxReady ? 'EUR' : 'LEI'})</TableHead>
                <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[9%]">{t('invoiceUpload.table.weightKg', 'Weight (kg)')}</TableHead>
                <TableHead className="px-4 py-3 text-left font-semibold text-stone-700 w-[10%]">{t('invoiceUpload.table.match', 'Match')}</TableHead>
                <TableHead className="px-4 py-3 text-center font-semibold text-stone-700 w-[10%]">{t('invoiceUpload.table.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-stone-200">
              {editableProducts.map((product, i) => (
                <InvoiceTableRow
                  key={product.previewId}
                  product={product}
                  index={i}
                  isEditing={editingIndex === i}
                  match={matchResults[i]}
                  flags={rowFlags[i]}
                  importAction={importActions[product.previewId] ?? getResolvedDefaultAction(i)}
                  isFxReady={isFxReady}
                  onEdit={onEditProduct}
                  onSave={onSaveEdit}
                  onCancel={onCancelEdit}
                  onRemove={onRemoveProduct}
                  onFieldChange={onFieldChange}
                  onActionChange={onActionChange}
                  t={t}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Import info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-900 mb-2">{t('invoiceUpload.importInfo.title', 'What happens next?')}</p>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• {t('invoiceUpload.importInfo.addedCount', { count: importableRowCount, defaultValue: '{{count}} rows will be processed' })}</li>
          <li>• {t('invoiceUpload.importInfo.stockIn', 'Stock IN movements will be created with the extracted quantities')}</li>
          <li>• {t('invoiceUpload.importInfo.missingBarcodes', 'Products without barcodes can be edited later to add barcodes')}</li>
          <li>• {t('invoiceUpload.importInfo.editLater', 'You can modify product details anytime from the inventory page')}</li>
        </ul>
      </div>

      {!isFxReady && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800">{t('invoiceUpload.fx.required', 'FX rate required to continue import.')}</p>
          <p className="text-xs text-amber-700 mt-1">{t('invoiceUpload.fx.requiredHelp', 'Enter a valid MDL per EUR rate above.')}</p>
        </div>
      )}

      {/* Import errors */}
      {importErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-medium text-red-700">{t('invoiceUpload.errors.importFailedTitle', 'Import failed')}</p>
          {importErrors.map((err, i) => <p key={i} className="text-sm text-red-600 mt-1">{err}</p>)}
        </div>
      )}
    </div>
  );
}
