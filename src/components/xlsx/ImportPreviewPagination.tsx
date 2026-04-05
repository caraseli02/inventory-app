import type { TFunction } from 'i18next';

import { Button } from '@/components/ui/button';

interface ImportPreviewPaginationProps {
  currentPage: number;
  pageSize: number;
  t: TFunction;
  totalPages: number;
  totalRows: number;
  onNext: () => void;
  onPrevious: () => void;
}

export function ImportPreviewPagination({
  currentPage,
  pageSize,
  t,
  totalPages,
  totalRows,
  onNext,
  onPrevious,
}: ImportPreviewPaginationProps) {
  const sliceStart = currentPage * pageSize;
  const sliceEnd = Math.min(sliceStart + pageSize, totalRows);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-stone-600">
        <p>{t('import.showingRange', {
          from: sliceStart + 1,
          to: sliceEnd,
          total: totalRows,
        })}</p>
        <p>{t('import.pageIndicator', {
          current: currentPage + 1,
          total: totalPages,
        })}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={currentPage === 0}
        >
          {t('import.previousPage')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={currentPage >= totalPages - 1}
        >
          {t('import.nextPage')}
        </Button>
      </div>
    </div>
  );
}
