/**
 * Column mapping configuration for xlsx import/export
 * Maps xlsx column headers to app field names
 */

// xlsx column headers (Romanian) mapped to app field names
export const XLSX_TO_APP_MAPPING: Record<string, string> = {
  // Required fields
  'Cod de bare (Barcode)': 'Barcode',
  'Denumirea produsului': 'Name',

  // Optional fields
  'Categorie': 'Category',
  'Pret (euro)': 'Price',
  'Cost pret magazin 50%': 'price50',
  'Cost preț magazin 50%': 'price50', // Alternative spelling with diacritics
  'Cost pret magazin 70%': 'price70',
  'Cost preț magazin 70%': 'price70',
  'Cost pret magazin 100%': 'price100',
  'Cost preț magazin 100%': 'price100',
  'Stock curent': 'currentStock',
  'Stock minim': 'minStock',
  'Furnizor': 'Supplier',
  'Data expirare': 'expiryDate',
};

// App field names mapped to xlsx column headers for export
export const APP_TO_XLSX_MAPPING: Record<string, string> = {
  'Barcode': 'Cod de bare (Barcode)',
  'Name': 'Denumirea produsului',
  'Category': 'Categorie',
  'Price': 'Pret (euro)',
  'price50': 'Cost pret magazin 50%',
  'price70': 'Cost pret magazin 70%',
  'price100': 'Cost pret magazin 100%',
  'currentStock': 'Stock curent',
  'minStock': 'Stock minim',
  'Supplier': 'Furnizor',
  'expiryDate': 'Data expirare',
};

// Required fields for import validation
export const REQUIRED_FIELDS = ['Barcode', 'Name'] as const;

// Export column order (only fields that exist in Airtable)
export const EXPORT_COLUMN_ORDER = [
  'Barcode',
  'Name',
  'Category',
  'Price',
  'price50',
  'price70',
  'price100',
  'currentStock',
  'expiryDate',
] as const;

// Field types for data conversion
export const FIELD_TYPES: Record<string, 'string' | 'number' | 'date'> = {
  'Barcode': 'string',
  'Name': 'string',
  'Category': 'string',
  'Price': 'number',
  'price50': 'number',
  'price70': 'number',
  'price100': 'number',
  'currentStock': 'number',
  'minStock': 'number',
  'Supplier': 'string',
  'expiryDate': 'date',
};

/**
 * Normalize a column header for comparison
 * Handles different spellings and whitespace
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ț/g, 't')
    .replace(/ă/g, 'a')
    .replace(/î/g, 'i')
    .replace(/â/g, 'a')
    .replace(/ș/g, 's');
}

/**
 * Find the app field name for a given xlsx header
 */
export function mapXlsxHeaderToAppField(header: string): string | null {
  // Direct match
  if (XLSX_TO_APP_MAPPING[header]) {
    return XLSX_TO_APP_MAPPING[header];
  }

  // Try normalized match
  const normalizedHeader = normalizeHeader(header);
  for (const [xlsxHeader, appField] of Object.entries(XLSX_TO_APP_MAPPING)) {
    if (normalizeHeader(xlsxHeader) === normalizedHeader) {
      return appField;
    }
  }

  return null;
}
