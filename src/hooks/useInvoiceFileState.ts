import { useState, useCallback } from 'react';
import type { TFunction } from 'i18next';
import { extractInvoiceData, VALID_INVOICE_EXTENSIONS, type InvoiceData, type InvoiceProduct } from '@/lib/invoiceOCR';
import { logger } from '@/lib/logger';
import type { InvoiceStep } from './useInvoiceImport.types';
import { buildProcessErrorMessage } from './useInvoiceImport.helpers';

export interface InvoiceFileStateReturn {
  step: InvoiceStep;
  setStep: React.Dispatch<React.SetStateAction<InvoiceStep>>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  invoiceData: InvoiceData | null;
  setInvoiceData: React.Dispatch<React.SetStateAction<InvoiceData | null>>;
  rawProducts: InvoiceProduct[];
  setRawProducts: React.Dispatch<React.SetStateAction<InvoiceProduct[]>>;
  fileName: string;
  setFileName: React.Dispatch<React.SetStateAction<string>>;
  ocrProgress: number;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  fxRate: number | null;
  setFxRate: React.Dispatch<React.SetStateAction<number | null>>;
  isFxManual: boolean;
  setIsFxManual: React.Dispatch<React.SetStateAction<boolean>>;
  fxRateError: string | null;
  setFxRateError: React.Dispatch<React.SetStateAction<string | null>>;
  handleFileSelectCore: (
    file: File,
    onSuccess: (invoiceData: InvoiceData, raw: InvoiceProduct[]) => void,
  ) => Promise<void>;
  handleFxRateChange: (value: string) => void;
}

export function useInvoiceFileState(t: TFunction): InvoiceFileStateReturn {
  const [step, setStep] = useState<InvoiceStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [rawProducts, setRawProducts] = useState<InvoiceProduct[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fxRate, setFxRate] = useState<number | null>(19.5);
  const [isFxManual, setIsFxManual] = useState(false);
  const [fxRateError, setFxRateError] = useState<string | null>(null);

  const handleFileSelectCore = useCallback(async (
    file: File,
    onSuccess: (invoiceData: InvoiceData, raw: InvoiceProduct[]) => void,
  ) => {
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
      const result = await extractInvoiceData(file, (progress) => { setOcrProgress(progress); });
      if (result.success) {
        onSuccess(result.data, result.data.products);
      } else {
        setError(result.error);
      }
    } catch (err) {
      logger.error('Invoice upload failed in UI', {
        fileName: file.name, fileSize: file.size, fileType: file.type,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
      });
      setError(buildProcessErrorMessage(err, t));
    } finally {
      setIsProcessing(false);
    }
  }, [t]);

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

  return {
    step, setStep, isDragging, setIsDragging,
    invoiceData, setInvoiceData, rawProducts, setRawProducts,
    fileName, setFileName, ocrProgress, isProcessing, setIsProcessing,
    error, setError, fxRate, setFxRate, isFxManual, setIsFxManual,
    fxRateError, setFxRateError, handleFileSelectCore, handleFxRateChange,
  };
}
