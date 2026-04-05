import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ImportPreviewTable } from '@/components/xlsx/ImportPreviewTable';
import type { XlsxPreviewRow } from '@/lib/xlsx/preview';

function makeRow(index: number): XlsxPreviewRow {
  return {
    previewId: `row-${index}`,
    product: {
      Name: `Product ${index}`,
      Barcode: `59012345678${String(index).padStart(2, '0')}`,
      currentStock: index,
      importAction: 'create',
    },
    matchedProduct: null,
    hasDiffs: false,
    isAlreadyImported: false,
    importAction: 'create',
  };
}

describe('ImportPreviewTable', () => {
  it('renders every preview row instead of truncating to the first 10', () => {
    const rows = Array.from({ length: 12 }, (_, index) => makeRow(index + 1));
    const t = vi.fn((key: string) => key);

    const { container } = render(
      <ImportPreviewTable
        rows={rows}
        t={t as never}
        onActionChange={() => {}}
      />
    );

    expect(container.querySelectorAll('tbody tr')).toHaveLength(12);
    expect(container).toHaveTextContent('Product 12');
  });
});
