import { supabase } from './supabase';
import { logger } from './logger';

const INVOICE_IMPORT_NOTE_PREFIX = 'invoice_import';

export interface InvoiceIdentityInput {
  supplier?: string | null;
  invoiceNumber?: string | null;
}

export interface InvoiceRowIdentityInput extends InvoiceIdentityInput {
  rowId: string;
}

export interface ParsedInvoiceImportNote {
  supplier: string;
  invoiceNumber: string;
  rowId: string;
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

export function buildInvoiceKey(input: InvoiceIdentityInput): string | null {
  const supplier = normalizeIdentityValue(input.supplier);
  const invoiceNumber = normalizeIdentityValue(input.invoiceNumber);
  if (!supplier || !invoiceNumber) return null;
  return `${supplier}::${invoiceNumber}`;
}

export function buildInvoiceRowNote(input: InvoiceRowIdentityInput): string | null {
  const supplier = normalizeIdentityValue(input.supplier);
  const invoiceNumber = normalizeIdentityValue(input.invoiceNumber);
  const rowId = normalizeIdentityValue(input.rowId);

  if (!supplier || !invoiceNumber || !rowId) return null;

  return [
    INVOICE_IMPORT_NOTE_PREFIX,
    `supplier=${encodeNoteValue(supplier)}`,
    `invoice=${encodeNoteValue(invoiceNumber)}`,
    `row=${encodeNoteValue(rowId)}`,
  ].join('|');
}

export function parseInvoiceRowNote(note: string | null | undefined): ParsedInvoiceImportNote | null {
  if (!note || !note.startsWith(`${INVOICE_IMPORT_NOTE_PREFIX}|`)) return null;

  const parts = note.split('|');
  if (parts.length < 4 || parts[0] !== INVOICE_IMPORT_NOTE_PREFIX) return null;

  const values = new Map<string, string>();
  for (let i = 1; i < parts.length; i += 1) {
    const [rawKey, ...rest] = parts[i].split('=');
    if (!rawKey || rest.length === 0) continue;
    values.set(rawKey, decodeNoteValue(rest.join('=')));
  }

  const supplier = normalizeIdentityValue(values.get('supplier'));
  const invoiceNumber = normalizeIdentityValue(values.get('invoice'));
  const rowId = normalizeIdentityValue(values.get('row'));

  if (!supplier || !invoiceNumber || !rowId) return null;
  return { supplier, invoiceNumber, rowId };
}

export async function getAlreadyImportedRowIds(
  input: InvoiceIdentityInput
): Promise<Set<string>> {
  const supplier = normalizeIdentityValue(input.supplier);
  const invoiceNumber = normalizeIdentityValue(input.invoiceNumber);
  if (!supplier || !invoiceNumber) {
    return new Set<string>();
  }

  const rowIds = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('note')
      .eq('type', 'IN')
      .ilike('note', `${INVOICE_IMPORT_NOTE_PREFIX}|%`)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      logger.error('Failed to load invoice idempotency markers', {
        supplier,
        invoiceNumber,
        error: error.message,
        errorCode: error.code,
        from,
        pageSize,
      });
      throw new Error(`Failed to load invoice import history: ${error.message}`);
    }

    const rows = data ?? [];
    for (const row of rows) {
      const parsed = parseInvoiceRowNote((row as { note?: string | null }).note);
      if (!parsed) continue;
      if (parsed.supplier === supplier && parsed.invoiceNumber === invoiceNumber) {
        rowIds.add(parsed.rowId);
      }
    }

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rowIds;
}
