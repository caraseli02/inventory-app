import { supabase } from './supabase';
import { logger } from './logger';

const EXCEL_IMPORT_NOTE_PREFIX = 'excel_import';

export interface ExcelBatchIdentityInput {
  batchId?: string | null;
}

export interface ExcelRowIdentityInput extends ExcelBatchIdentityInput {
  rowId: string;
  barcode: string;
}

export interface ParsedExcelImportNote {
  batchId: string;
  rowId: string;
  barcode: string;
}

function normalizeIdentityValue(value?: string | null): string {
  return (value ?? '').trim();
}

function encodeNoteValue(value: string): string {
  return encodeURIComponent(value.replace(/\r?\n/g, ' '));
}

function decodeNoteValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildExcelBatchKey(input: ExcelBatchIdentityInput): string | null {
  const batchId = normalizeIdentityValue(input.batchId);
  return batchId || null;
}

export function buildExcelBatchNotePattern(input: ExcelBatchIdentityInput): string | null {
  const batchId = normalizeIdentityValue(input.batchId);
  if (!batchId) return null;
  return `${EXCEL_IMPORT_NOTE_PREFIX}|batch=${encodeNoteValue(batchId)}|%`;
}

export function buildExcelRowNote(input: ExcelRowIdentityInput): string | null {
  const batchId = normalizeIdentityValue(input.batchId);
  const rowId = normalizeIdentityValue(input.rowId);
  const barcode = normalizeIdentityValue(input.barcode);

  if (!batchId || !rowId || !barcode) return null;

  return [
    EXCEL_IMPORT_NOTE_PREFIX,
    `batch=${encodeNoteValue(batchId)}`,
    `row=${encodeNoteValue(rowId)}`,
    `barcode=${encodeNoteValue(barcode)}`,
  ].join('|');
}

export function parseExcelRowNote(note: string | null | undefined): ParsedExcelImportNote | null {
  if (!note || !note.startsWith(`${EXCEL_IMPORT_NOTE_PREFIX}|`)) return null;

  const parts = note.split('|');
  if (parts.length < 4 || parts[0] !== EXCEL_IMPORT_NOTE_PREFIX) return null;

  const values = new Map<string, string>();
  for (let i = 1; i < parts.length; i += 1) {
    const [rawKey, ...rest] = parts[i].split('=');
    if (!rawKey || rest.length === 0) continue;
    values.set(rawKey, decodeNoteValue(rest.join('=')));
  }

  const batchId = normalizeIdentityValue(values.get('batch'));
  const rowId = normalizeIdentityValue(values.get('row'));
  const barcode = normalizeIdentityValue(values.get('barcode'));

  if (!batchId || !rowId || !barcode) return null;
  return { batchId, rowId, barcode };
}

export async function getAlreadyImportedExcelRowIds(
  input: ExcelBatchIdentityInput
): Promise<Set<string>> {
  const batchId = normalizeIdentityValue(input.batchId);
  const notePattern = buildExcelBatchNotePattern({ batchId });
  if (!batchId) return new Set<string>();

  const rowIds = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('note')
      .eq('type', 'IN')
      .ilike('note', notePattern ?? `${EXCEL_IMPORT_NOTE_PREFIX}|%`)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      logger.error('Failed to load excel import idempotency markers', {
        batchId,
        error: error.message,
        errorCode: error.code,
        from,
        pageSize,
      });
      throw new Error(`Failed to load excel import history: ${error.message}`);
    }

    const rows = data ?? [];
    for (const row of rows) {
      const parsed = parseExcelRowNote((row as { note?: string | null }).note);
      if (!parsed) continue;
      if (parsed.batchId === batchId) rowIds.add(parsed.rowId);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return rowIds;
}
