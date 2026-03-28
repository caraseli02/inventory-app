import type { TFunction } from 'i18next';
import type { InvoiceData, InvoiceOCRResult, InvoiceProduct } from '@/lib/invoiceOCR';
import type { Product } from '@/types';
import type { InvoiceImportAction } from '@/lib/invoiceImportDiffs';
import type { ImportedProduct } from '@/lib/xlsx/index';

export type InvoiceStep = 'upload' | 'processing' | 'preview' | 'importing' | 'complete';
type MatchType = 'barcode' | 'name';

export const CATEGORIES = [
  'General', 'Produce', 'Dairy', 'Meat', 'Pantry',
  'Snacks', 'Beverages', 'Household', 'Conserve', 'Cereale',
] as const;

export interface InvoiceMatchResult {
  product: Product;
  type: MatchType;
}

export interface InvoicePreviewProduct extends InvoiceProduct {
  previewId: string;
  lineTotalLei: number;
  weightKg?: number;
  category?: string;
  imageUrl?: string;
}

export type PricingByRowId = Record<string, {
  base_price_eur: number;
  price_50: number;
  price_70: number;
  price_100: number;
}>;

export type RowFlag = {
  rowId: string;
  isAlreadyImported: boolean;
  hasDiffs: boolean;
  hasPriceDiffs: boolean;
};

export interface UseInvoiceImportReturn {
  step: InvoiceStep;
  isDragging: boolean;
  isProcessing: boolean;
  ocrProgress: number;
  fileName: string;
  error: string | null;
  fxRate: number | null;
  isFxManual: boolean;
  fxRateError: string | null;
  isFxReady: boolean;
  editableProducts: InvoicePreviewProduct[];
  editingIndex: number | null;
  importActions: Record<string, InvoiceImportAction>;
  matchResults: (InvoiceMatchResult | null)[];
  rowFlags: RowFlag[];
  pricingComputedByRowId: PricingByRowId;
  invoiceData: InvoiceData | null;
  importableRowCount: number;
  importProgress: { current: number; total: number };
  importErrors: string[];
  handleClose: () => void;
  handleFileSelect: (file: File) => Promise<void>;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFxRateChange: (value: string) => void;
  handleRemoveProduct: (idx: number) => void;
  handleEditProduct: (idx: number) => void;
  handleSaveEdit: () => void;
  handleCancelEdit: () => void;
  handleProductFieldChange: (idx: number, field: keyof InvoicePreviewProduct, value: string | number) => void;
  handleConfirmImport: () => Promise<void>;
  getResolvedDefaultAction: (index: number) => InvoiceImportAction;
  setManualActionPreviewIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setImportActions: React.Dispatch<React.SetStateAction<Record<string, InvoiceImportAction>>>;
  resetState: () => void;
  t: TFunction;
}

export interface UseInvoiceImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (products: ImportedProduct[], onProgress?: (current: number, total: number) => void) => Promise<void>;
  products: Product[];
  initialSession?: {
    jobId?: string;
    fileName: string;
    invoiceData: InvoiceData;
  } | null;
  onPendingJob?: (result: Extract<InvoiceOCRResult, { success: false; pending: true }>, file: File) => void;
}
