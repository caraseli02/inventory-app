import type { TFunction } from 'i18next';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit2, Check, X } from 'lucide-react';
import type { InvoicePreviewProduct, InvoiceMatchResult, RowFlag } from '@/hooks/useInvoiceImport';
import { isValidNumber, CATEGORIES } from '@/hooks/useInvoiceImport';
import type { InvoiceImportAction } from '@/lib/invoiceImportDiffs';

interface InvoiceTableRowProps {
  product: InvoicePreviewProduct;
  index: number;
  isEditing: boolean;
  match: InvoiceMatchResult | null;
  flags: RowFlag | undefined;
  importAction: InvoiceImportAction;
  isFxReady: boolean;
  onEdit: (idx: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: (idx: number) => void;
  onFieldChange: (idx: number, field: keyof InvoicePreviewProduct, value: string | number) => void;
  onActionChange: (previewId: string, action: InvoiceImportAction) => void;
  t: TFunction;
}

function MatchCell({ match, flags, importAction, previewId, onActionChange, t }: {
  match: InvoiceMatchResult | null;
  flags: RowFlag | undefined;
  importAction: InvoiceImportAction;
  previewId: string;
  onActionChange: (previewId: string, action: InvoiceImportAction) => void;
  t: TFunction;
}) {
  if (!match) return <span className="text-xs text-stone-500">{t('invoiceUpload.table.newProduct', 'New product')}</span>;
  return (
    <div className="space-y-2">
      <div className="text-xs text-stone-700 truncate">{match.product.fields.Name}</div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] px-2 py-0.5">
          {match.type === 'barcode' ? t('invoiceUpload.table.matchBarcode', 'Barcode match') : t('invoiceUpload.table.matchName', 'Name match')}
        </Badge>
        {flags?.isAlreadyImported && <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{t('invoiceUpload.table.alreadyImported', 'Already imported')}</Badge>}
        {!flags?.isAlreadyImported && flags?.hasDiffs && <Badge variant="outline" className="text-[10px] px-2 py-0.5">{t('invoiceUpload.table.willUpdate', 'Will update')}</Badge>}
      </div>
      <Select value={importAction} onValueChange={(v) => onActionChange(previewId, v as InvoiceImportAction)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="update">{t('invoiceUpload.table.update', 'Update')}</SelectItem>
          <SelectItem value="receive_stock">{t('invoiceUpload.table.receiveStock', 'Receive stock')}</SelectItem>
          <SelectItem value="skip">{t('invoiceUpload.table.skip', 'Skip')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function RowActions({ isEditing, index, onEdit, onSave, onCancel, onRemove, t }: {
  isEditing: boolean;
  index: number;
  onEdit: (idx: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: (idx: number) => void;
  t: TFunction;
}) {
  if (isEditing) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={onSave} className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" title={t('invoiceUpload.table.save', 'Save changes')}><Check className="h-5 w-5" /></Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0 text-stone-600 hover:text-stone-700 hover:bg-stone-100" title={t('invoiceUpload.table.cancel', 'Cancel')}><X className="h-5 w-5" /></Button>
      </>
    );
  }
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => onEdit(index)} className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title={t('invoiceUpload.table.edit', 'Edit product')}><Edit2 className="h-5 w-5" /></Button>
      <Button variant="ghost" size="sm" onClick={() => onRemove(index)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" title={t('invoiceUpload.table.remove', 'Remove product')}><Trash2 className="h-5 w-5" /></Button>
    </>
  );
}

export function InvoiceTableRow({
  product, index, isEditing, match, flags, importAction, isFxReady,
  onEdit, onSave, onCancel, onRemove, onFieldChange, onActionChange, t,
}: InvoiceTableRowProps) {
  const isSkipped = importAction === 'skip';
  const rowClass = [isEditing ? 'bg-blue-50' : 'hover:bg-stone-50', isSkipped ? 'opacity-60' : '', flags?.isAlreadyImported ? 'bg-stone-50/70' : ''].join(' ');
  return (
    <TableRow className={rowClass}>
      <TableCell className="px-4 py-3">
        {isEditing ? <Input value={product.name} onChange={(e) => onFieldChange(index, 'name', e.target.value)} className="h-9 text-sm w-full" autoFocus /> : product.name}
      </TableCell>
      <TableCell className="px-4 py-3">
        {isEditing ? (
          <Select value={product.category || 'General'} onValueChange={(v) => onFieldChange(index, 'category', v)}>
            <SelectTrigger className="h-9 text-xs w-full"><SelectValue placeholder={t('invoiceUpload.table.category', 'Category')} /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
          </Select>
        ) : <span className="text-sm text-stone-700">{product.category || 'General'}</span>}
      </TableCell>
      <TableCell className="px-4 py-3">
        {isEditing ? (
          <Input value={product.barcode || ''} onChange={(e) => onFieldChange(index, 'barcode', e.target.value)} placeholder={t('invoiceUpload.table.noBarcode', 'No barcode')} className="h-9 text-xs font-mono w-full" />
        ) : product.barcode ? (
          <code className="text-xs font-mono bg-stone-100 px-1.5 py-0.5 rounded">{product.barcode}</code>
        ) : <span className="text-xs text-stone-400 italic">{t('invoiceUpload.table.noBarcode', 'No barcode')}</span>}
      </TableCell>
      <TableCell className="px-4 py-3 text-right">
        {isEditing ? <Input type="number" value={product.quantity} onChange={(e) => onFieldChange(index, 'quantity', e.target.value)} className="h-9 text-sm text-right w-full" min="1" /> : <span className="font-medium">{product.quantity}</span>}
      </TableCell>
      <TableCell className="px-4 py-3 text-right">
        {isEditing ? <Input type="number" value={product.unitPrice} onChange={(e) => onFieldChange(index, 'unitPrice', e.target.value)} className="h-9 text-sm text-right w-full" step="0.01" min="0" /> : isFxReady ? `€${product.unitPrice.toFixed(2)}` : `${product.unitPrice.toFixed(2)} LEI`}
      </TableCell>
      <TableCell className="px-4 py-3 text-right">
        {isEditing ? <Input type="number" value={product.totalPrice} onChange={(e) => onFieldChange(index, 'totalPrice', e.target.value)} className="h-9 text-sm text-right w-full" step="0.01" min="0" /> : <span className="font-semibold">{isFxReady ? `€${product.totalPrice.toFixed(2)}` : `${product.totalPrice.toFixed(2)} LEI`}</span>}
      </TableCell>
      <TableCell className="px-4 py-3 text-right">
        {isEditing ? <Input type="number" value={product.weightKg ?? ''} onChange={(e) => onFieldChange(index, 'weightKg', e.target.value)} className="h-9 text-sm text-right w-full" step="0.001" min="0" />
          : isValidNumber(product.weightKg) ? <span className="font-medium">{product.weightKg.toFixed(3)}</span>
          : <span className="text-xs text-red-600 font-medium">{t('invoiceUpload.table.missingWeight', 'Missing')}</span>}
      </TableCell>
      <TableCell className="px-4 py-3">
        <MatchCell match={match} flags={flags} importAction={importAction} previewId={product.previewId} onActionChange={onActionChange} t={t} />
      </TableCell>
      <TableCell className="px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <RowActions isEditing={isEditing} index={index} onEdit={onEdit} onSave={onSave} onCancel={onCancel} onRemove={onRemove} t={t} />
        </div>
      </TableCell>
    </TableRow>
  );
}
