import { describe, expect, it } from 'vitest';

import {
  buildExcelBatchKey,
  buildExcelRowNote,
  parseExcelRowNote,
} from '@/lib/excelImportIdempotency';

describe('excelImportIdempotency', () => {
  it('builds a batch key only when the batch id exists', () => {
    expect(buildExcelBatchKey({ batchId: 'batch-1' })).toBe('batch-1');
    expect(buildExcelBatchKey({ batchId: '' })).toBeNull();
  });

  it('builds and parses row note with escaped delimiters/newlines', () => {
    const note = buildExcelRowNote({
      batchId: 'batch|1',
      rowId: 'Sheet 1:2:590123\n4567890',
      barcode: '590123=4567890',
    });

    expect(note).toBeTruthy();
    expect(parseExcelRowNote(note)).toEqual({
      batchId: 'batch|1',
      rowId: 'Sheet 1:2:590123 4567890',
      barcode: '590123=4567890',
    });
  });

  it('returns null for unrelated or malformed notes', () => {
    expect(parseExcelRowNote('manual adjustment')).toBeNull();
    expect(parseExcelRowNote('excel_import|batch=x|row=y')).toBeNull();
    expect(parseExcelRowNote(null)).toBeNull();
  });
});
