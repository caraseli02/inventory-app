import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { parseXlsxFile } from '@/lib/xlsx';

function makeWorkbookFile(rows: unknown[][], name = 'delivery.xlsx'): File {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Delivery');
  const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  return {
    name,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    arrayBuffer: async () => arrayBuffer,
  } as File;
}

describe('parseXlsxFile', () => {
  it('accepts files without barcode column (barcode is optional)', async () => {
    const file = makeWorkbookFile([
      ['Denumirea produsului', 'Stock curent'],
      ['Milk', 4],
    ]);

    const result = await parseXlsxFile(file);

    expect(result.success).toBe(true);
    expect(result.products[0]?.Name).toBe('Milk');
    expect(result.products[0]?.Barcode).toBeUndefined();
  });

  it('rejects files that do not include the Name column', async () => {
    const file = makeWorkbookFile([
      ['Cod de bare (Barcode)', 'Stock curent'],
      ['5901234567890', 4],
    ]);

    const result = await parseXlsxFile(file);

    expect(result.success).toBe(false);
    expect(result.errors[0]?.message).toContain('Missing required column(s): Name');
    expect(result.errors[0]?.messageKey).toBe('import.errors.missingColumns');
  });

  it('adds deterministic batch and row metadata to imported rows', async () => {
    const file = makeWorkbookFile([
      ['Cod de bare (Barcode)', 'Denumirea produsului', 'Stock curent'],
      ['5901234567890', 'Milk', 4],
    ]);

    const result = await parseXlsxFile(file);

    expect(result.success).toBe(true);
    expect(result.products[0]?.excelBatchId).toMatch(/^[a-f0-9]{64}$/);
    expect(result.products[0]?.excelRowId).toBe('Delivery:2:5901234567890');
  });

  it('records localized warning metadata for unrecognized columns', async () => {
    const file = makeWorkbookFile([
      ['Cod de bare (Barcode)', 'Denumirea produsului', 'Mystery Column'],
      ['5901234567890', 'Milk', 'value'],
    ]);

    const result = await parseXlsxFile(file);

    expect(result.success).toBe(true);
    expect(result.warnings[0]?.messageKey).toBe('import.warningMessages.unrecognizedColumn');
    expect(result.warnings[0]?.messageValues).toEqual({ column: 'Mystery Column' });
  });
});
