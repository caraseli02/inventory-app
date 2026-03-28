import { useState, useCallback, useRef } from 'react';
import type { TFunction } from 'i18next';
import {
  extractInvoiceData,
  VALID_INVOICE_EXTENSIONS,
  type InvoiceData,
  type InvoiceOCRResult,
  type InvoiceProduct,
} from '@/lib/invoiceOCR';
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
  submitInvoiceFile: (file: File) => Promise<InvoiceOCRResult | null>;
  handleFxRateChange: (value: string) => void;
  cancelActiveAttempt: () => void;
}

function getFileExtension(fileName: string): string {
  return `.${fileName.split('.').pop()?.toLowerCase()}`;
}

function createFxRateChangeHandler(
  t: TFunction,
  setIsFxManual: React.Dispatch<React.SetStateAction<boolean>>,
  setFxRate: React.Dispatch<React.SetStateAction<number | null>>,
  setFxRateError: React.Dispatch<React.SetStateAction<string | null>>,
): (value: string) => void {
  return (value: string) => {
    setIsFxManual(true);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFxRate(null);
      setFxRateError(t('invoiceUpload.fx.invalidRate', 'Enter a valid positive rate.'));
      return;
    }
    setFxRate(parsed);
    setFxRateError(null);
  };
}

function createFileSubmitHandler(
  t: TFunction,
  activeAttemptIdRef: React.MutableRefObject<number>,
  setFileName: React.Dispatch<React.SetStateAction<string>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>,
  setOcrProgress: React.Dispatch<React.SetStateAction<number>>,
): (file: File) => Promise<InvoiceOCRResult | null> {
  return async (file) => {
    const validExtensions = VALID_INVOICE_EXTENSIONS as readonly string[];
    if (!validExtensions.includes(getFileExtension(file.name))) {
      setError(t('invoiceUpload.errors.invalidFile', 'Please select a PDF file.'));
      return null;
    }
    const attemptId = activeAttemptIdRef.current + 1;
    activeAttemptIdRef.current = attemptId;
    setFileName(file.name);
    setError(null);
    setIsProcessing(true);
    setOcrProgress(0);
    try {
      return await extractInvoiceData(file, (progress) => {
        if (activeAttemptIdRef.current === attemptId) setOcrProgress(progress);
      });
    } catch (err) {
      if (activeAttemptIdRef.current !== attemptId) return null;
      logger.error('Invoice upload failed in UI', {
        fileName: file.name, fileSize: file.size, fileType: file.type,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
      });
      const message = buildProcessErrorMessage(err, t);
      setError(message);
      return { success: false, error: message };
    } finally {
      if (activeAttemptIdRef.current === attemptId) setIsProcessing(false);
    }
  };
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
  const activeAttemptIdRef = useRef(0);

  const cancelActiveAttempt = useCallback(() => {
    activeAttemptIdRef.current += 1;
  }, []);

  const submitInvoiceFile = useCallback(
    async (file: File) => (
      createFileSubmitHandler(t, activeAttemptIdRef, setFileName, setError, setIsProcessing, setOcrProgress)(file)
    ),
    [t, setFileName, setError, setIsProcessing, setOcrProgress],
  );

  const handleFxRateChange = useCallback((value: string) => (
    createFxRateChangeHandler(t, setIsFxManual, setFxRate, setFxRateError)(value)
  ), [t, setIsFxManual, setFxRate, setFxRateError]);

  return {
    step, setStep, isDragging, setIsDragging,
    invoiceData, setInvoiceData, rawProducts, setRawProducts,
    fileName, setFileName, ocrProgress, isProcessing, setIsProcessing,
    error, setError, fxRate, setFxRate, isFxManual, setIsFxManual,
    fxRateError, setFxRateError, submitInvoiceFile, handleFxRateChange, cancelActiveAttempt,
  };
}
