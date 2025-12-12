/**
 * xlsx Service - Import/Export product data from Excel files
 * Uses SheetJS (xlsx) library for parsing and generating xlsx files
 */

import * as XLSX from 'xlsx';
import {
  mapXlsxHeaderToAppField,
  REQUIRED_FIELDS,
  EXPORT_COLUMN_ORDER,
  APP_TO_XLSX_MAPPING,
  FIELD_TYPES,
} from './columnMapping';

// Types for imported product data
export interface ImportedProduct {
  Name: string;
  Barcode?: string; // Optional - can be added later via edit dialog
  Category?: string;
  Price?: number;
  price50?: number;
  price70?: number;
  price100?: number;
  currentStock?: number;
  minStock?: number;
  Supplier?: string;
  expiryDate?: string;
}

export interface ImportResult {
  success: boolean;
  products: ImportedProduct[];
  errors: ImportError[];
  warnings: string[];
  totalRows: number;
  validRows: number;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

export interface ExportProduct {
  Barcode?: string; // Optional - products may not have barcodes
  Name: string;
  Category?: string;
  Price?: number;
  price50?: number;
  price70?: number;
  price100?: number;
  currentStock?: number;
  expiryDate?: string;
}

/**
 * Parse an xlsx file and extract product data
 */
export async function parseXlsxFile(file: File): Promise<ImportResult> {
  const errors: ImportError[] = [];
  const warnings: string[] = [];
  const products: ImportedProduct[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        products: [],
        errors: [{ row: 0, message: 'No sheets found in the workbook' }],
        warnings: [],
        totalRows: 0,
        validRows: 0,
      };
    }

    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row
    const rawData = XLSX.utils.sheet_to_json(sheet, {
      header: 1, // Return array of arrays
      defval: '', // Default value for empty cells
    }) as unknown[][];

    if (rawData.length < 2) {
      return {
        success: false,
        products: [],
        errors: [{ row: 0, message: 'File must have at least a header row and one data row' }],
        warnings: [],
        totalRows: 0,
        validRows: 0,
      };
    }

    // Find header row (might be row 1 or 2 depending on file structure)
    let headerRowIndex = 0;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      const row = rawData[i] as unknown[];
      const potentialHeaders = row.map(cell => String(cell || '').trim());

      // Check if this row contains recognizable headers
      // At least 1 recognizable column (Name is required, Barcode recommended)
      const mappedFields = potentialHeaders.map(h => mapXlsxHeaderToAppField(h)).filter(Boolean);
      const hasNameColumn = mappedFields.includes('Name');

      if (hasNameColumn || mappedFields.length >= 2) {
        headerRowIndex = i;
        headers = potentialHeaders;
        break;
      }
    }

    if (headers.length === 0) {
      return {
        success: false,
        products: [],
        errors: [{ row: 0, message: 'Could not find recognizable column headers. Expected columns like "Cod de bare (Barcode)" and "Denumirea produsului"' }],
        warnings: [],
        totalRows: 0,
        validRows: 0,
      };
    }

    // Map headers to app field names
    const columnMapping: Record<number, string> = {};
    const missingRequired: string[] = [];

    headers.forEach((header, index) => {
      const appField = mapXlsxHeaderToAppField(header);
      if (appField) {
        columnMapping[index] = appField;
      }
    });

    // Check for required fields - only warn if Name column is missing
    // Barcode is required per-row but column can be optional if provided elsewhere
    const mappedFields = Object.values(columnMapping);
    for (const required of REQUIRED_FIELDS) {
      if (!mappedFields.includes(required)) {
        missingRequired.push(required);
      }
    }

    // Only fail if Name column is completely missing
    if (!mappedFields.includes('Name')) {
      return {
        success: false,
        products: [],
        errors: [{ row: 0, message: 'Missing required column: Name (Denumirea produsului). This column is required for import.' }],
        warnings: [],
        totalRows: 0,
        validRows: 0,
      };
    }

    // Info about optional columns not found
    if (!mappedFields.includes('Barcode')) {
      warnings.push('Barcode column not found. Products will be imported without barcodes - you can add them later via the edit dialog.');
    }

    // Process data rows
    const totalRows = rawData.length - headerRowIndex - 1;

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as unknown[];
      const rowNum = i + 1; // 1-indexed for user display

      // Skip empty rows
      if (!row || row.every(cell => cell === '' || cell === null || cell === undefined)) {
        continue;
      }

      const product: Partial<ImportedProduct> = {};
      let hasRequiredFields = true;

      // Map each column value
      for (const [colIndex, fieldName] of Object.entries(columnMapping)) {
        const colIdx = parseInt(colIndex);
        const rawValue = row[colIdx];
        const value = convertValue(rawValue, fieldName);

        if (value !== undefined && value !== null && value !== '') {
          (product as Record<string, unknown>)[fieldName] = value;
        }
      }

      // Validate required fields
      for (const required of REQUIRED_FIELDS) {
        if (!product[required as keyof ImportedProduct]) {
          errors.push({
            row: rowNum,
            field: required,
            message: `Missing required field: ${required}`,
          });
          hasRequiredFields = false;
        }
      }

      // Validate barcode format (should be non-empty string)
      if (product.Barcode && typeof product.Barcode !== 'string') {
        product.Barcode = String(product.Barcode);
      }

      if (hasRequiredFields) {
        products.push(product as ImportedProduct);
      }
    }

    // Add warnings for unmapped columns
    headers.forEach((header, index) => {
      if (header && !columnMapping[index] && header.trim()) {
        warnings.push(`Column "${header}" was not recognized and will be skipped`);
      }
    });

    return {
      success: products.length > 0,
      products,
      errors,
      warnings,
      totalRows,
      validRows: products.length,
    };
  } catch (error) {
    return {
      success: false,
      products: [],
      errors: [{ row: 0, message: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
    };
  }
}

/**
 * Convert a raw cell value to the appropriate type
 */
function convertValue(rawValue: unknown, fieldName: string): unknown {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return undefined;
  }

  const fieldType = FIELD_TYPES[fieldName] || 'string';

  switch (fieldType) {
    case 'number': {
      const num = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
      return isNaN(num) ? undefined : num;
    }

    case 'date': {
      if (rawValue instanceof Date) {
        return rawValue.toISOString().split('T')[0];
      }
      // Handle Excel date serial numbers
      if (typeof rawValue === 'number') {
        const date = XLSX.SSF.parse_date_code(rawValue);
        if (date) {
          return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
      }
      return String(rawValue);
    }

    case 'string':
    default:
      return String(rawValue).trim();
  }
}

/**
 * Export products to an xlsx file
 */
export function exportToXlsx(products: ExportProduct[], filename?: string): void {
  // Create worksheet data with headers
  const headers = EXPORT_COLUMN_ORDER.map(field => APP_TO_XLSX_MAPPING[field] || field);

  const data = products.map(product => {
    return EXPORT_COLUMN_ORDER.map(field => {
      const value = product[field as keyof ExportProduct];
      return value ?? '';
    });
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Set column widths
  const colWidths = [
    { wch: 18 }, // Barcode
    { wch: 30 }, // Name
    { wch: 12 }, // Category
    { wch: 10 }, // Price
    { wch: 12 }, // price50
    { wch: 12 }, // price70
    { wch: 12 }, // price100
    { wch: 12 }, // currentStock
    { wch: 12 }, // minStock
    { wch: 20 }, // Supplier
    { wch: 14 }, // expiryDate
  ];
  ws['!cols'] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

  // Generate filename with timestamp
  const exportFilename = filename || `inventory-${new Date().toISOString().split('T')[0]}.xlsx`;

  // Download file
  XLSX.writeFile(wb, exportFilename);
}

/**
 * Read xlsx file from a URL (for loading sample data)
 */
export async function loadXlsxFromUrl(url: string): Promise<ImportResult> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], 'data.xlsx', { type: blob.type });
    return parseXlsxFile(file);
  } catch (error) {
    return {
      success: false,
      products: [],
      errors: [{ row: 0, message: `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
    };
  }
}
