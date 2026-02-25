import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  extractInvoiceData,
  type InvoiceData,
  VALID_INVOICE_EXTENSIONS,
} from '@/lib/invoiceOCR';
import { Upload, AlertCircle, CheckCircle2, Loader2, Receipt, Trash2, Edit2, Check, X } from 'lucide-react';
import type { ImportedProduct } from '@/lib/xlsx';
import { logger } from '@/lib/logger';
import type { InvoiceProduct } from '@/lib/invoiceOCR';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { suggestProductDetails } from '@/lib/ai';
import type { Product } from '@/types';
import { parseWeightKgFromProductName } from '@/lib/invoicePricing';
import { previewInvoicePricing } from '@/lib/invoiceImportApi';

interface InvoiceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (products: ImportedProduct[], onProgress?: (current: number, total: number) => void) => Promise<void>;
  products: Product[];
}

type InvoiceStep = 'upload' | 'preview' | 'importing' | 'complete';

const NUMERIC_EDITABLE_FIELDS: ReadonlySet<string> = new Set([
  'quantity',
  'unitPrice',
  'totalPrice',
  'weightKg',
]);

type ImportAction = 'create' | 'update' | 'skip';
type MatchType = 'barcode' | 'name';

interface InvoiceMatchResult {
  product: Product;
  type: MatchType;
}

interface InvoicePreviewProduct extends InvoiceProduct {
  previewId: string;
  weightKg?: number;
  category?: string;
  imageUrl?: string;
}

const getPreviewId = (product: InvoiceProduct, index: number): string => {
  const rowId = product.rowId?.trim();
  if (rowId) return `row:${rowId}`;
  return `idx:${index}`;
};

const CATEGORIES = [
  'General',
  'Produce',
  'Dairy',
  'Meat',
  'Pantry',
  'Snacks',
  'Beverages',
  'Household',
  'Conserve',
  'Cereale',
] as const;

/**
 * Check if value is a valid number
 */
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && Number.isFinite(value);
}

const roundCurrency = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
};

const normalizeForMatch = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

const inferCategoryFromName = (name: string): string => {
  const normalized = name.toLowerCase();
  const rules: Array<{ category: string; keywords: string[] }> = [
    { category: 'Dairy', keywords: ['milk', 'cheese', 'yogurt', 'butter', 'smantana'] },
    { category: 'Meat', keywords: ['beef', 'pork', 'chicken', 'meat', 'carne'] },
    { category: 'Produce', keywords: ['apple', 'banana', 'tomato', 'potato', 'fruit', 'vegetable', 'legume'] },
    { category: 'Beverages', keywords: ['water', 'juice', 'soda', 'cola', 'beer', 'wine', 'drink', 'baut'] },
    { category: 'Snacks', keywords: ['chips', 'snack', 'cracker', 'biscuit', 'cookie'] },
    { category: 'Pantry', keywords: ['rice', 'pasta', 'flour', 'sugar', 'salt', 'oil'] },
    { category: 'Household', keywords: ['soap', 'detergent', 'clean', 'paper', 'towel'] },
    { category: 'Conserve', keywords: ['canned', 'conserve'] },
    { category: 'Cereale', keywords: ['cereal', 'oat', 'granola'] },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }

  return 'General';
};

export function InvoiceUploadDialog({ open, onOpenChange, onImport, products }: InvoiceUploadDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<InvoiceStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [rawProducts, setRawProducts] = useState<InvoiceProduct[]>([]);
  const [editableProducts, setEditableProducts] = useState<InvoicePreviewProduct[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fxRate, setFxRate] = useState<number | null>(19.5);
  const [isFxManual, setIsFxManual] = useState(false);
  const [fxRateError, setFxRateError] = useState<string | null>(null);
  const [importActions, setImportActions] = useState<Record<string, ImportAction>>({});
  const [removedPreviewIds, setRemovedPreviewIds] = useState<Set<string>>(new Set());
  const autoCategoryRef = useRef(new Set<string>());

  const resetState = useCallback(() => {
    setStep('upload');
    setInvoiceData(null);
    setRawProducts([]);
    setEditableProducts([]);
    setEditingIndex(null);
    setFileName('');
    setOcrProgress(0);
    setIsProcessing(false);
    setError(null);
    setImportProgress({ current: 0, total: 0 });
    setImportErrors([]);
    setFxRate(19.5);
    setIsFxManual(false);
    setFxRateError(null);
    setImportActions({});
    setRemovedPreviewIds(new Set());
    autoCategoryRef.current = new Set<string>();
  }, []);

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      resetState();
      onOpenChange(false);
    }
  }, [isProcessing, onOpenChange, resetState]);

  const handleFileSelect = useCallback(async (file: File) => {
    const validExtensions = VALID_INVOICE_EXTENSIONS as readonly string[];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      setError(t('invoiceUpload.errors.invalidFile', 'Please select a PDF file.'));
      return;
    }

    setFileName(file.name);
    setError(null);
    setIsProcessing(true);
    setOcrProgress(0);

    try {
      const result = await extractInvoiceData(file, (progress) => {
        setOcrProgress(progress);
      });

        if (result.success) {
          setInvoiceData(result.data);
          setRawProducts(result.data.products);
          setRemovedPreviewIds(new Set());
          const resolvedFxRate = fxRate;
          const isFxReadyNow = resolvedFxRate != null && Number.isFinite(resolvedFxRate) && resolvedFxRate > 0;
          setEditableProducts(result.data.products.map((product, index) => {
            const quantity = product.quantity;
            const totalPrice = isFxReadyNow ? roundCurrency(product.totalPrice / resolvedFxRate) : product.totalPrice;
            const unitPrice = isFxReadyNow
              ? (quantity > 0 ? roundCurrency(totalPrice / quantity) : 0)
              : product.unitPrice;

            return {
              ...product,
              previewId: getPreviewId(product, index),
              quantity,
              unitPrice,
              totalPrice,
              weightKg: product.weightKgCandidate ?? parseWeightKgFromProductName(product.name),
              category: product.categorySuggestion ?? inferCategoryFromName(product.name),
            };
          }));
        setImportActions({});
        setStep('preview');
      } else {
        setError(result.error);
      }
    } catch (err) {
      logger.error('Invoice upload failed in UI', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
      });

      // Provide user-friendly error message
      let userMessage = t('invoiceUpload.errors.processFailed', 'Failed to process invoice. ');
      if (err instanceof Error) {
        if (err.message.includes('API key')) {
          userMessage += t('invoiceUpload.errors.apiKey', 'Please check your API configuration.');
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          userMessage += t('invoiceUpload.errors.network', 'Please check your internet connection and try again.');
        } else if (err.message.includes('quota') || err.message.includes('rate limit')) {
          userMessage += t('invoiceUpload.errors.quota', 'Service limit reached. Please try again later.');
        } else {
          userMessage += err.message;
        }
      } else {
        userMessage += t('invoiceUpload.errors.generic', 'Please try again or contact support if the issue persists.');
      }

      setError(userMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [fxRate, t]);

  useEffect(() => {
    if (!rawProducts.length) return;
    if (!fxRate || !Number.isFinite(fxRate) || fxRate <= 0) return;

    setEditableProducts((prev) => {
      const prevById = new Map(prev.map((product) => [product.previewId, product]));

      return rawProducts.flatMap((product, index) => {
        const previewId = getPreviewId(product, index);
        if (removedPreviewIds.has(previewId)) return [];

        const previous = prevById.get(previewId);
        const quantity = previous?.quantity ?? product.quantity;
        // IMPORTANT: derive EUR from invoice line total (LEI) to preserve VAT/discount-adjusted line value.
        // Using unit LEI here can understate totals for invoices where line_total includes VAT/other adjustments.
        const totalPrice = roundCurrency(product.totalPrice / fxRate);
        const unitPrice = quantity > 0 ? roundCurrency(totalPrice / quantity) : 0;
        const weightKg = previous?.weightKg ?? product.weightKgCandidate ?? parseWeightKgFromProductName(product.name);

        return {
          ...product,
          previewId,
          name: previous?.name ?? product.name,
          barcode: previous?.barcode ?? product.barcode,
          quantity,
          unitPrice,
          totalPrice,
          weightKg,
          category: previous?.category ?? product.categorySuggestion ?? inferCategoryFromName(product.name),
          imageUrl: previous?.imageUrl,
        };
      });
    });
  }, [rawProducts, fxRate, removedPreviewIds]);

  useEffect(() => {
    if (!editableProducts.length) return;

    const pending = editableProducts
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => {
        if (!product.barcode) return false;
        if (autoCategoryRef.current.has(product.barcode)) return false;
        return !product.category || product.category === 'General';
      });

    if (!pending.length) return;

    pending.forEach(({ product }) => {
      if (product.barcode) {
        autoCategoryRef.current.add(product.barcode);
      }
    });

    const run = async () => {
      const results = await Promise.allSettled(
        pending.map(({ product }) => suggestProductDetails(product.barcode || ''))
      );

      setEditableProducts((prev) =>
        prev.map((product, index) => {
          const matchIndex = pending.findIndex((item) => item.index === index);
          if (matchIndex === -1) return product;

          const result = results[matchIndex];
          if (result.status !== 'fulfilled' || !result.value) return product;

          const suggestion = result.value;
          return {
            ...product,
            category: suggestion.category || product.category,
            imageUrl: suggestion.imageUrl || product.imageUrl,
          };
        })
      );
    };

    run();
  }, [editableProducts]);

  const barcodeIndex = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => {
      const barcode = product.fields.Barcode?.trim();
      if (barcode) {
        map.set(barcode, product);
      }
    });
    return map;
  }, [products]);

  const nameIndex = useMemo(() => {
    const map = new Map<string, Product | null>();
    products.forEach((product) => {
      const name = normalizeForMatch(product.fields.Name);
      if (!name) return;
      if (map.has(name)) {
        map.set(name, null);
        return;
      }
      map.set(name, product);
    });
    return map;
  }, [products]);

  const matchResults = useMemo(() => {
    return editableProducts.map((product) => {
      const barcode = product.barcode?.trim();
      if (barcode) {
        const match = barcodeIndex.get(barcode);
        if (match) return { product: match, type: 'barcode' } satisfies InvoiceMatchResult;
      }

      if (!barcode) {
        const normalizedName = normalizeForMatch(product.name);
        const match = nameIndex.get(normalizedName);
        if (match) return { product: match, type: 'name' } satisfies InvoiceMatchResult;
      }

      return null;
    });
  }, [editableProducts, barcodeIndex, nameIndex]);

  useEffect(() => {
    setImportActions((prev) => {
      const next: Record<string, ImportAction> = {};

      editableProducts.forEach((product, index) => {
        const match = matchResults[index];
        const previous = prev[product.previewId];

        if (!match) {
          next[product.previewId] = 'create';
          return;
        }

        if (previous === 'skip' || previous === 'update') {
          next[product.previewId] = previous;
          return;
        }

        next[product.previewId] = 'update';
      });

      return next;
    });
  }, [editableProducts, matchResults]);

  const isFxReady = fxRate != null && Number.isFinite(fxRate) && fxRate > 0;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleFxRateChange = useCallback((value: string) => {
    setIsFxManual(true);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFxRate(null);
      setFxRateError(t('invoiceUpload.fx.invalidRate', 'Enter a valid positive rate.'));
      return;
    }

    setFxRate(parsed);
    setFxRateError(null);
  }, [t]);

  const handleRemoveProduct = useCallback((index: number) => {
    const productToRemove = editableProducts[index];
    if (!productToRemove) return;

    setRemovedPreviewIds((removed) => new Set(removed).add(productToRemove.previewId));
    setImportActions((actions) => {
      const next = { ...actions };
      delete next[productToRemove.previewId];
      return next;
    });
    setEditableProducts((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex(null);
  }, [editableProducts]);

  const handleEditProduct = useCallback((index: number) => {
    setEditingIndex(index);
  }, []);

  const handleSaveEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleProductFieldChange = useCallback(
    (index: number, field: keyof InvoicePreviewProduct, value: string | number) => {
      setEditableProducts((prev) =>
        prev.map((product, i) => {
          if (i !== index) return product;

          if (NUMERIC_EDITABLE_FIELDS.has(field)) {
            if (typeof value === 'string' && value.trim() === '') {
              return product;
            }
            const numericValue = typeof value === 'number' ? value : Number(value);
            if (!isValidNumber(numericValue)) {
              return product;
            }

            const next = { ...product, [field]: numericValue } as InvoicePreviewProduct;
            if (field === 'quantity' || field === 'unitPrice') {
              next.totalPrice = roundCurrency(next.quantity * next.unitPrice);
            }
            return next;
          }

          return {
            ...product,
            [field]: typeof value === 'string' ? value : String(value),
          };
        })
      );
    },
    []
  );

  const handleConfirmImport = useCallback(async () => {
    if (!editableProducts.length || !invoiceData || !isFxReady) return;
    const missingWeightCount = editableProducts.filter((product) => !isValidNumber(product.weightKg)).length;
    if (missingWeightCount > 0) {
      setImportErrors([
        t('invoiceUpload.errors.missingWeight', {
          count: missingWeightCount,
          defaultValue: '{{count}} products are missing weight. Please set weight before importing.',
        }),
      ]);
      return;
    }

    setStep('importing');
    setImportProgress({ current: 0, total: editableProducts.length });
    setImportErrors([]);

    try {
      const preview = await previewInvoicePricing({
        invoice_meta: {
          supplier: invoiceData?.supplier,
          invoice_number: invoiceData?.invoiceNumber,
          date: invoiceData?.invoiceDate,
        },
        rows: editableProducts.map((product, index) => ({
          row_id: product.rowId || `row-${index + 1}`,
          name: product.name,
          barcode: product.barcode || null,
          quantity: product.quantity,
          line_total_lei: roundCurrency(product.totalPrice * fxRate),
          weight_kg: product.weightKg ?? null,
        })),
      });

      const blockedRows = preview.rows.filter((row) => row.status !== 'ok');
      if (blockedRows.length > 0) {
        setImportErrors([
          t('invoiceUpload.errors.previewBlocked', {
            count: blockedRows.length,
            defaultValue: '{{count}} rows need more input before import.',
          }),
        ]);
        setStep('preview');
        return;
      }

      const computedByRowId = new Map(
        preview.rows.map((row) => [row.row_id, row.computed ?? null])
      );

      // Convert invoice products to ImportedProduct format
      const importedProducts: ImportedProduct[] = editableProducts.map((product, index) => {
        const match = matchResults[index];
        const importAction = importActions[product.previewId] ?? (match ? 'update' : 'create');
        const rowId = product.rowId || `row-${index + 1}`;
        const computed = computedByRowId.get(rowId);

        if (!computed) {
          throw new Error(
            t('invoiceUpload.errors.previewMissingComputed', {
              defaultValue: 'Preview pricing returned incomplete data. Please try again.',
            })
          );
        }

        return {
          Name: product.name,
          // Normalize barcode for matching (backend lookups are exact).
          Barcode: product.barcode?.trim() || undefined, // Can be empty, user can add later
          Category: product.category || 'General',
          Price: computed.base_price_eur,
          price50: computed.price_50,
          price70: computed.price_70,
          price100: computed.price_100,
          currentStock: product.quantity,
          Supplier: invoiceData?.supplier || undefined,
          expiryDate: undefined,
          importAction,
          existingProductId: importAction === 'update' ? match?.product.id : undefined,
          imageUrl: product.imageUrl,
          importSource: 'invoice',
          invoiceRowId: rowId,
          weightKg: product.weightKg,
          invoiceLineTotal: product.totalPrice,
        };
      });

      await onImport(importedProducts, (current, total) => {
        setImportProgress({ current, total });
      });

      logger.info('Invoice import completed successfully', {
        productCount: importedProducts.length,
        supplier: invoiceData?.supplier,
        invoiceNumber: invoiceData?.invoiceNumber,
      });

      setStep('complete');
    } catch (error) {
      logger.error('Invoice import failed', {
        productCount: editableProducts.length,
        supplier: invoiceData?.supplier,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      // Provide specific error message based on error type
      let errorMessage = t('invoiceUpload.errors.importFailed', 'Import failed. ');
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage += t('invoiceUpload.errors.networkRetry', 'Network error occurred. Please check your connection and try again.');
        } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
          errorMessage += t('invoiceUpload.errors.rateLimit', 'Rate limit exceeded. Please wait a moment and try again.');
        } else if (error.message.includes('validation')) {
          errorMessage += error.message;
        } else {
          errorMessage += t('invoiceUpload.errors.generic', 'Please try again or contact support if the issue persists.');
        }
      }

      setImportErrors([errorMessage]);
      setStep('preview');
    }
  }, [editableProducts, fxRate, invoiceData, importActions, isFxReady, matchResults, onImport, t]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[100vw] h-[100vh] md:w-[90vw] md:h-[90vh] md:max-w-[1400px] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-stone-200">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-6 w-6 text-[var(--color-forest)]" />
            {t('invoiceUpload.title', 'Import from Invoice')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t(`invoiceUpload.stepDescriptions.${step}` as const, {
              defaultValue: {
                upload: 'Upload an invoice to automatically extract product data',
                preview: 'Review extracted products before importing',
                importing: 'Creating products in your inventory...',
                complete: 'Invoice products have been imported successfully',
              }[step],
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 py-4">
          {step === 'upload' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              {/* Drag & Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  border-2 border-dashed rounded-xl p-8 text-center transition-colors
                  ${isDragging
                    ? 'border-[var(--color-lavender)] bg-[var(--color-lavender)]/5'
                    : 'border-stone-300 hover:border-stone-400'
                  }
                  ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <Upload className="h-12 w-12 mx-auto text-stone-400 mb-4" />
                <p className="text-lg font-medium text-stone-700 mb-2">
                  {t('invoiceUpload.dropzone.title', 'Drag and drop your invoice here')}
                </p>
                <p className="text-sm text-stone-500 mb-4">
                  {t('invoiceUpload.dropzone.subtitle', 'or click to browse files')}
                </p>
                <p className="text-xs text-stone-400 mb-4">
                  {t('invoiceUpload.dropzone.fileTypes', 'Supports PDF (max 10MB)')}
                </p>
                <input
                  type="file"
                  accept={VALID_INVOICE_EXTENSIONS.join(',')}
                  onChange={handleFileInput}
                  className="hidden"
                  id="invoice-upload"
                  disabled={isProcessing}
                />
                <label htmlFor="invoice-upload">
                  <Button
                    variant="outline"
                    className="cursor-pointer"
                    disabled={isProcessing}
                    onClick={() => document.getElementById('invoice-upload')?.click()}
                  >
                    {t('invoiceUpload.dropzone.selectFile', 'Select Invoice File')}
                  </Button>
                </label>
              </div>

              {/* Processing Status */}
              {isProcessing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-900">{fileName}</p>
                      <p className="text-sm text-blue-600">
                        {(() => {
                          if (ocrProgress < 50) return t('invoiceUpload.progress.preparing', 'Preparing invoice...');
                          if (ocrProgress < 80) return t('invoiceUpload.progress.extracting', 'Extracting data...');
                          return t('invoiceUpload.progress.finalizing', 'Finalizing...');
                        })()}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-blue-700">{ocrProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* AI Info */}
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                <p className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  {t('invoiceUpload.howItWorks.title', 'How it works')}
                </p>
                <ul className="text-xs text-stone-600 space-y-1.5">
                  <li>
                    • {t('invoiceUpload.howItWorks.step1', 'Step 1: Upload your PDF invoice')}
                  </li>
                  <li>
                    • {t('invoiceUpload.howItWorks.step2', 'Step 2: Extracts product names, quantities, and prices')}
                  </li>
                  <li>
                    • {t('invoiceUpload.howItWorks.step3', 'Step 3: You review and confirm before importing')}
                  </li>
                  <li className="pt-1 text-[var(--color-forest)] font-medium">
                    ✓ {t('invoiceUpload.howItWorks.fast', 'Fast and accurate PDF processing')}
                  </li>
                </ul>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700">
                        {t('invoiceUpload.errors.extractionFailed', 'Extraction failed')}
                      </p>
                      <p className="text-sm text-red-600 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && invoiceData && (
            <div className="space-y-4">
              {/* Invoice Summary */}
              <div className="flex items-start gap-4 p-4 bg-stone-50 rounded-lg border-2 border-stone-200">
                <CheckCircle2 className="h-8 w-8 text-[var(--color-forest)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900">
                    {t('invoiceUpload.preview.extracted', {
                      count: editableProducts.length,
                      defaultValue: 'Successfully extracted {{count}} products',
                    })}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                    {invoiceData.supplier && (
                      <>
                        <span className="text-stone-600">{t('invoiceUpload.preview.supplier', 'Supplier:')}</span>
                        <span className="font-medium text-stone-900">{invoiceData.supplier}</span>
                      </>
                    )}
                    {invoiceData.invoiceNumber && (
                      <>
                        <span className="text-stone-600">{t('invoiceUpload.preview.invoiceNumber', 'Invoice #:')}</span>
                        <span className="font-medium text-stone-900 font-mono text-xs">
                          {invoiceData.invoiceNumber}
                        </span>
                      </>
                    )}
                    {invoiceData.invoiceDate && (
                      <>
                        <span className="text-stone-600">{t('invoiceUpload.preview.date', 'Date:')}</span>
                        <span className="font-medium text-stone-900">
                          {invoiceData.invoiceDate}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* FX Rate */}
              <div className="p-4 bg-white rounded-lg border-2 border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-stone-800">
                    {t('invoiceUpload.fx.title', 'FX Rate (MDL per EUR)')}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {isFxManual
                      ? t('invoiceUpload.fx.manual', 'Manual')
                      : t('invoiceUpload.fx.default', { rate: '19.5', defaultValue: 'Default ({{rate}})' })}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    type="number"
                    value={fxRate ?? ''}
                    onChange={(e) => handleFxRateChange(e.target.value)}
                    step="0.0001"
                    min="0"
                    placeholder={t('invoiceUpload.fx.placeholder', 'Enter rate')}
                    className="max-w-[220px]"
                  />
                </div>

                {fxRateError && (
                  <p className="text-xs text-red-600">{fxRateError}</p>
                )}
              </div>

              {/* Warning about barcodes */}
              {editableProducts.some((p) => !p.barcode) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    {t('invoiceUpload.preview.noBarcodeTitle', "Note: Some products don't have barcodes")}
                  </p>
                  <p className="text-xs text-amber-700">
                    {t('invoiceUpload.preview.noBarcodeDescription', 'You can scan barcodes later using the edit button for each product.')}
                  </p>
                </div>
              )}

              {editableProducts.some((p) => !isValidNumber(p.weightKg)) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 mb-1">
                    {t('invoiceUpload.preview.missingWeightTitle', 'Weight required for transport cost')}
                  </p>
                  <p className="text-xs text-red-700">
                    {t('invoiceUpload.preview.missingWeightDescription', 'Set missing product weights (kg) before importing.')}
                  </p>
                </div>
              )}

              {/* Product Preview Table - Using shadcn Table components */}
              <div className="border-2 border-stone-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 500px)', minHeight: '300px' }}>
                  <Table>
                    <TableHeader className="bg-stone-100 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="px-4 py-3 text-left font-semibold text-stone-700 w-[28%]">
                          {t('invoiceUpload.table.productName', 'Product Name')}
                        </TableHead>
                        <TableHead className="px-4 py-3 text-left font-semibold text-stone-700 w-[12%]">
                          {t('invoiceUpload.table.category', 'Category')}
                        </TableHead>
                        <TableHead className="px-4 py-3 text-left font-semibold text-stone-700 w-[16%]">
                          {t('invoiceUpload.table.barcode', 'Barcode')}
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[8%]">
                          {t('invoiceUpload.table.quantity', 'Qty')}
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[10%]">
                          {t('invoiceUpload.table.unitPrice', 'Unit Price')} ({isFxReady ? 'EUR' : 'LEI'})
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[10%]">
                          {t('invoiceUpload.table.total', 'Total')} ({isFxReady ? 'EUR' : 'LEI'})
                        </TableHead>
                        <TableHead className="px-4 py-3 text-left font-semibold text-stone-700 w-[10%]">
                          {t('invoiceUpload.table.match', 'Match')}
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[9%]">
                          {t('invoiceUpload.table.weightKg', 'Weight (kg)')}
                        </TableHead>
                        <TableHead className="px-4 py-3 text-center font-semibold text-stone-700 w-[10%]">
                          {t('invoiceUpload.table.actions', 'Actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-stone-200">
                      {editableProducts.map((product, i) => {
                        const isEditing = editingIndex === i;
                        const match = matchResults[i];
                        const importAction = importActions[product.previewId] ?? (match ? 'update' : 'create');
                        const isSkipped = importAction === 'skip';
                        return (
                          <TableRow
                            key={product.previewId}
                            className={`${isEditing ? 'bg-blue-50' : 'hover:bg-stone-50'} ${isSkipped ? 'opacity-60' : ''}`}
                          >
                            <TableCell className="px-4 py-3">
                              {isEditing ? (
                                <Input
                                  value={product.name}
                                  onChange={(e) => handleProductFieldChange(i, 'name', e.target.value)}
                                  className="h-9 text-sm w-full"
                                  autoFocus
                                />
                              ) : (
                                product.name
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              {isEditing ? (
                                <Select
                                  value={product.category || 'General'}
                                  onValueChange={(value) => handleProductFieldChange(i, 'category', value)}
                                >
                                  <SelectTrigger className="h-9 text-xs w-full">
                                    <SelectValue placeholder={t('invoiceUpload.table.category', 'Category')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CATEGORIES.map((cat) => (
                                      <SelectItem key={cat} value={cat}>
                                        {cat}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-sm text-stone-700">{product.category || 'General'}</span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              {isEditing ? (
                                <Input
                                  value={product.barcode || ''}
                                  onChange={(e) => handleProductFieldChange(i, 'barcode', e.target.value)}
                                  placeholder={t('invoiceUpload.table.noBarcode', 'No barcode')}
                                  className="h-9 text-xs font-mono w-full"
                                />
                              ) : product.barcode ? (
                                <code className="text-xs font-mono bg-stone-100 px-1.5 py-0.5 rounded">
                                  {product.barcode}
                                </code>
                              ) : (
                                <span className="text-xs text-stone-400 italic">
                                  {t('invoiceUpload.table.noBarcode', 'No barcode')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  value={product.quantity}
                                  onChange={(e) => handleProductFieldChange(i, 'quantity', e.target.value)}
                                  className="h-9 text-sm text-right w-full"
                                  min="1"
                                />
                              ) : (
                                <span className="font-medium">{product.quantity}</span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  value={product.unitPrice}
                                  onChange={(e) => handleProductFieldChange(i, 'unitPrice', e.target.value)}
                                  className="h-9 text-sm text-right w-full"
                                  step="0.01"
                                  min="0"
                                />
                              ) : (
                                isFxReady
                                  ? `€${product.unitPrice.toFixed(2)}`
                                  : `${product.unitPrice.toFixed(2)} LEI`
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  value={product.totalPrice}
                                  onChange={(e) => handleProductFieldChange(i, 'totalPrice', e.target.value)}
                                  className="h-9 text-sm text-right w-full"
                                  step="0.01"
                                  min="0"
                                />
                              ) : (
                                <span className="font-semibold">
                                  {isFxReady ? `€${product.totalPrice.toFixed(2)}` : `${product.totalPrice.toFixed(2)} LEI`}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  value={product.weightKg ?? ''}
                                  onChange={(e) => handleProductFieldChange(i, 'weightKg', e.target.value)}
                                  className="h-9 text-sm text-right w-full"
                                  step="0.001"
                                  min="0"
                                />
                              ) : isValidNumber(product.weightKg) ? (
                                <span className="font-medium">{product.weightKg.toFixed(3)}</span>
                              ) : (
                                <span className="text-xs text-red-600 font-medium">
                                  {t('invoiceUpload.table.missingWeight', 'Missing')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              {match ? (
                                <div className="space-y-2">
                                  <div className="text-xs text-stone-700 truncate">
                                    {match.product.fields.Name}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                                      {match.type === 'barcode'
                                        ? t('invoiceUpload.table.matchBarcode', 'Barcode match')
                                        : t('invoiceUpload.table.matchName', 'Name match')}
                                    </Badge>
                                  </div>
                                  <Select
                                    value={importAction}
                                    onValueChange={(value) =>
                                      setImportActions((prev) => ({ ...prev, [product.previewId]: value as ImportAction }))
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="update">
                                        {t('invoiceUpload.table.update', 'Update')}
                                      </SelectItem>
                                      <SelectItem value="skip">
                                        {t('invoiceUpload.table.skip', 'Skip')}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <span className="text-xs text-stone-500">
                                  {t('invoiceUpload.table.newProduct', 'New product')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleSaveEdit}
                                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      title={t('invoiceUpload.table.save', 'Save changes')}
                                    >
                                      <Check className="h-5 w-5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleCancelEdit}
                                      className="h-8 w-8 p-0 text-stone-600 hover:text-stone-700 hover:bg-stone-100"
                                      title={t('invoiceUpload.table.cancel', 'Cancel')}
                                    >
                                      <X className="h-5 w-5" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditProduct(i)}
                                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      title={t('invoiceUpload.table.edit', 'Edit product')}
                                    >
                                      <Edit2 className="h-5 w-5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveProduct(i)}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      title={t('invoiceUpload.table.remove', 'Remove product')}
                                    >
                                      <Trash2 className="h-5 w-5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Import Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  {t('invoiceUpload.importInfo.title', 'What happens next?')}
                </p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>
                    • {t('invoiceUpload.importInfo.addedCount', {
                      count: editableProducts.length,
                      defaultValue: '{{count}} products will be added to your inventory',
                    })}
                  </li>
                  <li>
                    • {t('invoiceUpload.importInfo.stockIn', 'Stock IN movements will be created with the extracted quantities')}
                  </li>
                  <li>
                    • {t('invoiceUpload.importInfo.missingBarcodes', 'Products without barcodes can be edited later to add barcodes')}
                  </li>
                  <li>• {t('invoiceUpload.importInfo.editLater', 'You can modify product details anytime from the inventory page')}</li>
                </ul>
              </div>

              {!isFxReady && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-800">
                    {t('invoiceUpload.fx.required', 'FX rate required to continue import.')}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    {t('invoiceUpload.fx.requiredHelp', 'Enter a valid MDL per EUR rate above.')}
                  </p>
                </div>
              )}

              {/* Import Errors */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-medium text-red-700">
                    {t('invoiceUpload.errors.importFailedTitle', 'Import failed')}
                  </p>
                  {importErrors.map((err, i) => (
                    <p key={i} className="text-sm text-red-600 mt-1">
                      {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-[var(--color-forest)] mb-4" />
              <p className="text-lg font-medium text-stone-700">
                {t('invoiceUpload.status.importing', 'Importing products...')}
              </p>
              <p className="text-sm text-stone-500 mt-2">
                {t('invoiceUpload.status.importingProgress', {
                  current: importProgress.current,
                  total: importProgress.total,
                  defaultValue: '{{current}} of {{total}} products processed',
                })}
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-16 w-16 text-[var(--color-forest)] mb-4" />
              <p className="text-xl font-semibold text-stone-900 mb-2">
                {t('invoiceUpload.status.completeTitle', 'Import Complete!')}
              </p>
              <p className="text-stone-600">
                {t('invoiceUpload.status.completeSubtitle', {
                  count: editableProducts.length,
                  defaultValue: 'Successfully imported {{count}} products from invoice',
                })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-stone-200">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              {t('invoiceUpload.actions.cancel', 'Cancel')}
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetState}>
                {t('invoiceUpload.actions.back', 'Back')}
              </Button>
              <Button
                onClick={handleConfirmImport}
                className="bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white"
                disabled={!editableProducts.length || !isFxReady || editableProducts.some((product) => !isValidNumber(product.weightKg))}
              >
                {t('invoiceUpload.actions.importCount', {
                  count: editableProducts.length,
                  defaultValue: 'Import {{count}} Products',
                })}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button
              onClick={handleClose}
              className="bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white"
            >
              {t('invoiceUpload.actions.done', 'Done')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
