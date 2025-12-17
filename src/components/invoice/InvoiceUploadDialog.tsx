import { useState, useCallback } from 'react';
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

interface InvoiceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (products: ImportedProduct[]) => Promise<void>;
}

type InvoiceStep = 'upload' | 'preview' | 'importing' | 'complete';

// Step descriptions lookup
const STEP_DESCRIPTIONS: Record<InvoiceStep, string> = {
  upload: 'Upload an invoice to automatically extract product data',
  preview: 'Review extracted products before importing',
  importing: 'Creating products in your inventory...',
  complete: 'Invoice products have been imported successfully',
};

// Progress message helper
function getProgressMessage(progress: number): string {
  if (progress < 40) return 'Preparing invoice...';
  if (progress < 70) return 'Extracting text with AI...';
  if (progress < 90) return 'Analyzing products...';
  return 'Finalizing...';
}

export function InvoiceUploadDialog({ open, onOpenChange, onImport }: InvoiceUploadDialogProps) {
  const [step, setStep] = useState<InvoiceStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [editableProducts, setEditableProducts] = useState<InvoiceProduct[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const resetState = useCallback(() => {
    setStep('upload');
    setInvoiceData(null);
    setEditableProducts([]);
    setEditingIndex(null);
    setFileName('');
    setOcrProgress(0);
    setIsProcessing(false);
    setError(null);
    setImportProgress({ current: 0, total: 0 });
    setImportErrors([]);
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
      setError('Please select a JPG or PNG file.');
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
        setEditableProducts(result.data.products);
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
      let userMessage = 'Failed to process invoice. ';
      if (err instanceof Error) {
        if (err.message.includes('API key')) {
          userMessage += 'Please check your API configuration.';
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          userMessage += 'Please check your internet connection and try again.';
        } else if (err.message.includes('quota') || err.message.includes('rate limit')) {
          userMessage += 'Service limit reached. Please try again later.';
        } else {
          userMessage += err.message;
        }
      } else {
        userMessage += 'Please try again or contact support if the issue persists.';
      }

      setError(userMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

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

  const handleRemoveProduct = useCallback((index: number) => {
    setEditableProducts(prev => prev.filter((_, i) => i !== index));
    setEditingIndex(null);
  }, []);

  const handleEditProduct = useCallback((index: number) => {
    setEditingIndex(index);
  }, []);

  const handleSaveEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleProductFieldChange = useCallback((index: number, field: keyof InvoiceProduct, value: string | number) => {
    setEditableProducts(prev => prev.map((product, i) => {
      if (i !== index) return product;
      return { ...product, [field]: value };
    }));
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!editableProducts.length || !invoiceData) return;

    setStep('importing');
    setImportProgress({ current: 0, total: editableProducts.length });
    setImportErrors([]);

    try {
      // Convert invoice products to ImportedProduct format
      const importedProducts: ImportedProduct[] = editableProducts.map((product) => ({
        Name: product.name,
        Barcode: product.barcode || '', // Can be empty, user can add later
        Category: undefined, // Will be assigned based on existing logic or user input
        Price: product.unitPrice,
        currentStock: product.quantity,
        'Min Stock Level': undefined,
        Supplier: invoiceData?.supplier || undefined,
        'Expiry Date': undefined,
      }));

      await onImport(importedProducts);

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
      let errorMessage = 'Import failed. ';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage += 'Network error occurred. Please check your connection and try again.';
        } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
          errorMessage += 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('validation')) {
          errorMessage += error.message;
        } else {
          errorMessage += 'Please try again or contact support if the issue persists.';
        }
      }

      setImportErrors([errorMessage]);
      setStep('preview');
    }
  }, [editableProducts, invoiceData, onImport]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[100vw] h-[100vh] md:w-[90vw] md:h-[90vh] md:max-w-[1400px] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-stone-200">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-6 w-6 text-[var(--color-forest)]" />
            Import from Invoice
          </DialogTitle>
          <DialogDescription className="text-base">{STEP_DESCRIPTIONS[step]}</DialogDescription>
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
                  ${
                    isDragging
                      ? 'border-[var(--color-lavender)] bg-[var(--color-lavender)]/5'
                      : 'border-stone-300 hover:border-stone-400'
                  }
                  ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <Upload className="h-12 w-12 mx-auto text-stone-400 mb-4" />
                <p className="text-lg font-medium text-stone-700 mb-2">
                  Drag and drop your invoice here
                </p>
                <p className="text-sm text-stone-500 mb-4">or click to browse files</p>
                <p className="text-xs text-stone-400 mb-4">
                  Supports JPG, PNG (max 10MB)
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
                    Select Invoice File
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
                      <p className="text-sm text-blue-600">{getProgressMessage(ocrProgress)}</p>
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
                  How it works
                </p>
                <ul className="text-xs text-stone-600 space-y-1.5">
                  <li>
                    • <strong>Step 1:</strong> AI reads text from your invoice (Google Cloud
                    Vision)
                  </li>
                  <li>
                    • <strong>Step 2:</strong> Extracts product names, quantities, and prices
                  </li>
                  <li>
                    • <strong>Step 3:</strong> You review and confirm before importing
                  </li>
                  <li className="pt-1 text-[var(--color-forest)] font-medium">
                    ✓ Essentially free: 1,000 pages/month included
                  </li>
                </ul>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700">Extraction failed</p>
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
                    Successfully extracted {editableProducts.length} products
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                    {invoiceData.supplier && (
                      <>
                        <span className="text-stone-600">Supplier:</span>
                        <span className="font-medium text-stone-900">{invoiceData.supplier}</span>
                      </>
                    )}
                    {invoiceData.invoiceNumber && (
                      <>
                        <span className="text-stone-600">Invoice #:</span>
                        <span className="font-medium text-stone-900 font-mono text-xs">
                          {invoiceData.invoiceNumber}
                        </span>
                      </>
                    )}
                    {invoiceData.invoiceDate && (
                      <>
                        <span className="text-stone-600">Date:</span>
                        <span className="font-medium text-stone-900">
                          {invoiceData.invoiceDate}
                        </span>
                      </>
                    )}
                    {invoiceData.totalAmount && (
                      <>
                        <span className="text-stone-600">Total:</span>
                        <span className="font-semibold text-stone-900">
                          €{invoiceData.totalAmount.toFixed(2)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Warning about barcodes */}
              {editableProducts.some((p) => !p.barcode) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    Note: Some products don't have barcodes
                  </p>
                  <p className="text-xs text-amber-700">
                    You can scan barcodes later using the edit button for each product.
                  </p>
                </div>
              )}

              {/* Product Preview Table - Using shadcn Table components */}
              <div className="border-2 border-stone-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 500px)', minHeight: '300px' }}>
                  <Table>
                    <TableHeader className="bg-stone-100 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="px-4 py-3 text-left font-semibold text-stone-700 w-[35%]">
                          Product Name
                        </TableHead>
                        <TableHead className="px-4 py-3 text-left font-semibold text-stone-700 w-[20%]">
                          Barcode
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[10%]">
                          Qty
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[12%]">
                          Unit Price
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold text-stone-700 w-[12%]">
                          Total
                        </TableHead>
                        <TableHead className="px-4 py-3 text-center font-semibold text-stone-700 w-[11%]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-stone-200">
                      {editableProducts.map((product, i) => {
                        const isEditing = editingIndex === i;
                        return (
                          <TableRow key={i} className={isEditing ? "bg-blue-50" : "hover:bg-stone-50"}>
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
                                <Input
                                  value={product.barcode || ''}
                                  onChange={(e) => handleProductFieldChange(i, 'barcode', e.target.value)}
                                  placeholder="No barcode"
                                  className="h-9 text-xs font-mono w-full"
                                />
                              ) : product.barcode ? (
                                <code className="text-xs font-mono bg-stone-100 px-1.5 py-0.5 rounded">
                                  {product.barcode}
                                </code>
                              ) : (
                                <span className="text-xs text-stone-400 italic">No barcode</span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  value={product.quantity}
                                  onChange={(e) => handleProductFieldChange(i, 'quantity', Number(e.target.value))}
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
                                  onChange={(e) => handleProductFieldChange(i, 'unitPrice', Number(e.target.value))}
                                  className="h-9 text-sm text-right w-full"
                                  step="0.01"
                                  min="0"
                                />
                              ) : (
                                `€${product.unitPrice.toFixed(2)}`
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  value={product.totalPrice}
                                  onChange={(e) => handleProductFieldChange(i, 'totalPrice', Number(e.target.value))}
                                  className="h-9 text-sm text-right w-full"
                                  step="0.01"
                                  min="0"
                                />
                              ) : (
                                <span className="font-semibold">€{product.totalPrice.toFixed(2)}</span>
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
                                      title="Save changes"
                                    >
                                      <Check className="h-5 w-5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleCancelEdit}
                                      className="h-8 w-8 p-0 text-stone-600 hover:text-stone-700 hover:bg-stone-100"
                                      title="Cancel"
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
                                      title="Edit product"
                                    >
                                      <Edit2 className="h-5 w-5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveProduct(i)}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      title="Remove product"
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
                <p className="text-sm font-medium text-blue-900 mb-2">What happens next?</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>
                    • {editableProducts.length} products will be added to your inventory
                  </li>
                  <li>
                    • Stock IN movements will be created with the extracted quantities
                  </li>
                  <li>
                    • Products without barcodes can be edited later to add barcodes
                  </li>
                  <li>• You can modify product details anytime from the inventory page</li>
                </ul>
              </div>

              {/* Import Errors */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-medium text-red-700">Import failed</p>
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
              <p className="text-lg font-medium text-stone-700">Importing products...</p>
              <p className="text-sm text-stone-500 mt-2">
                {importProgress.current} of {importProgress.total} products created
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-16 w-16 text-[var(--color-forest)] mb-4" />
              <p className="text-xl font-semibold text-stone-900 mb-2">Import Complete!</p>
              <p className="text-stone-600">
                Successfully imported {editableProducts.length} products from invoice
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-stone-200">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Cancel
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetState}>
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                className="bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white"
                disabled={!editableProducts.length}
              >
                Import {editableProducts.length} Products
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button
              onClick={handleClose}
              className="bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white"
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
