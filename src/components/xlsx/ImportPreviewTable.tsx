import type { TFunction } from 'i18next';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getAvailableExcelActions,
  type XlsxImportAction,
  type XlsxPreviewRow,
} from '@/lib/xlsx/preview';

interface ImportPreviewTableProps {
  rows: XlsxPreviewRow[];
  t: TFunction;
  onActionChange: (previewId: string, nextAction: XlsxImportAction) => void;
}

export function ImportPreviewTable({ rows, t, onActionChange }: ImportPreviewTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-sm">
          <thead className="bg-stone-100 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-stone-700">{t('import.tableBarcode')}</th>
              <th className="px-3 py-2 text-left font-medium text-stone-700">{t('import.tableName')}</th>
              <th className="px-3 py-2 text-left font-medium text-stone-700">{t('import.tableCategory')}</th>
              <th className="px-3 py-2 text-left font-medium text-stone-700">{t('import.tableMatch')}</th>
              <th className="px-3 py-2 text-left font-medium text-stone-700">{t('import.tableAction')}</th>
              <th className="px-3 py-2 text-right font-medium text-stone-700">{t('import.tablePrice')}</th>
              <th className="px-3 py-2 text-right font-medium text-stone-700">{t('import.tableStock')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {rows.slice(0, 10).map((row) => (
              <tr key={row.previewId} className="hover:bg-stone-50">
                <td className="px-3 py-2 font-mono text-xs">{row.product.Barcode}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-stone-900">{row.product.Name}</div>
                  {row.blockingError && (
                    <div className="text-xs text-red-600 mt-1">{row.blockingError}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.product.Category && (
                    <Badge variant="secondary" className="text-xs">
                      {row.product.Category}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.matchedProduct ? (
                    <div className="space-y-1">
                      <Badge variant="secondary" className="text-xs">
                        {t('import.matchExisting')}
                      </Badge>
                      {row.hasDiffs && (
                        <Badge variant="outline" className="text-xs">
                          {t('import.matchHasDiffs')}
                        </Badge>
                      )}
                      {row.isAlreadyImported && (
                        <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                          {t('import.matchAlreadyImported')}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {t('import.matchNewProduct')}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 min-w-40">
                  <Select
                    value={row.importAction}
                    onValueChange={(value) => onActionChange(row.previewId, value as XlsxImportAction)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableExcelActions(row).map((action) => (
                        <SelectItem key={action} value={action}>
                          {t(`import.action.${action}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-right">
                  {(row.product.price70 ?? row.product.Price) !== undefined
                    ? `€${(row.product.price70 ?? row.product.Price)!.toFixed(2)}`
                    : '-'}
                </td>
                <td className="px-3 py-2 text-right">
                  {row.product.currentStock ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <div className="px-3 py-2 bg-stone-50 text-sm text-stone-500 text-center">
          {t('import.showingProducts', { showing: 10, total: rows.length })}
        </div>
      )}
    </div>
  );
}
