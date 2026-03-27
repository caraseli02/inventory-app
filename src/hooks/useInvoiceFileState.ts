import { useState, useCallback, useRef } from 'react';
import type { TFunction } from 'i18next';
import {
  extractInvoiceData,
  getInvoiceExtractionStatus,
  VALID_INVOICE_EXTENSIONS,
  type InvoiceData,
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
  handleFileSelectCore: (
    file: File,
    onSuccess: (invoiceData: InvoiceData, raw: InvoiceProduct[]) => void,
  ) => Promise<void>;
  handleFxRateChange: (value: string) => void;
  cancelActiveAttempt: () => void;
}

function isActiveAttempt(activeAttemptIdRef: React.MutableRefObject<number>, attemptId: number): boolean {
  return activeAttemptIdRef.current === attemptId;
}

function getFileExtension(fileName: string): string {
  return `.${fileName.split('.').pop()?.toLowerCase()}`;
}

async function waitForRetry(retryAfterSeconds: number | null): Promise<void> {
  const retryAfterMs = Math.max(0, (retryAfterSeconds ?? 2) * 1000);
  if (retryAfterMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, retryAfterMs));
  }
}

async function pollPendingExtraction(
  activeAttemptIdRef: React.MutableRefObject<number>,
  attemptId: number,
  statusUrl: string,
  retryAfterSeconds: number | null,
  setStep: React.Dispatch<React.SetStateAction<InvoiceStep>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  onSuccess: (invoiceData: InvoiceData, raw: InvoiceProduct[]) => void,
): Promise<void> {
  setStep('processing');
  let currentStatusUrl = statusUrl;
  let nextRetryAfterSeconds = retryAfterSeconds;

  while (isActiveAttempt(activeAttemptIdRef, attemptId)) {
    await waitForRetry(nextRetryAfterSeconds);
    if (!isActiveAttempt(activeAttemptIdRef, attemptId)) return;

    const pollResult = await getInvoiceExtractionStatus(currentStatusUrl);
    if (!isActiveAttempt(activeAttemptIdRef, attemptId)) return;

    if (pollResult.success) {
      onSuccess(pollResult.data, pollResult.data.products);
      return;
    }

    if (!pollResult.pending) {
      setError(pollResult.error);
      setStep('upload');
      return;
    }

    currentStatusUrl = pollResult.statusUrl;
    nextRetryAfterSeconds = pollResult.retryAfterSeconds;
  }
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

function createFileSelectHandler(
  t: TFunction,
  activeAttemptIdRef: React.MutableRefObject<number>,
  setFileName: React.Dispatch<React.SetStateAction<string>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>,
  setOcrProgress: React.Dispatch<React.SetStateAction<number>>,
  setStep: React.Dispatch<React.SetStateAction<InvoiceStep>>,
): (
  file: File,
  onSuccess: (invoiceData: InvoiceData, raw: InvoiceProduct[]) => void,
) => Promise<void> {
  return async (file, onSuccess) => {
    const validExtensions = VALID_INVOICE_EXTENSIONS as readonly string[];
    if (!validExtensions.includes(getFileExtension(file.name))) {
      setError(t('invoiceUpload.errors.invalidFile', 'Please select a PDF file.'));
      return;
    }
    const attemptId = activeAttemptIdRef.current + 1;
    activeAttemptIdRef.current = attemptId;
    setFileName(file.name);
    setError(null);
    setIsProcessing(true);
    setOcrProgress(0);
    try {
      const result = await extractInvoiceData(file, (progress) => { setOcrProgress(progress); });
      if (!isActiveAttempt(activeAttemptIdRef, attemptId)) return;
      if (result.success) {
        onSuccess(result.data, result.data.products);
      } else if (result.pending) {
        await pollPendingExtraction(activeAttemptIdRef, attemptId, result.statusUrl, result.retryAfterSeconds, setStep, setError, onSuccess);
      } else {
        setError(result.error);
      }
    } catch (err) {
      if (!isActiveAttempt(activeAttemptIdRef, attemptId)) return;
      logger.error('Invoice upload failed in UI', {
        fileName: file.name, fileSize: file.size, fileType: file.type,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
      });
      setError(buildProcessErrorMessage(err, t));
      setStep('upload');
    } finally {
      if (isActiveAttempt(activeAttemptIdRef, attemptId)) setIsProcessing(false);
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

  const handleFileSelectCore = useCallback(
    async (file: File, onSuccess: (invoiceData: InvoiceData, raw: InvoiceProduct[]) => void) => (
      createFileSelectHandler(t, activeAttemptIdRef, setFileName, setError, setIsProcessing, setOcrProgress, setStep)(file, onSuccess)
    ),
    [t, setFileName, setError, setIsProcessing, setOcrProgress, setStep],
  );

  const handleFxRateChange = useCallback((value: string) => (
    createFxRateChangeHandler(t, setIsFxManual, setFxRate, setFxRateError)(value)
  ), [t, setIsFxManual, setFxRate, setFxRateError]);

  return {
    step, setStep, isDragging, setIsDragging,
    invoiceData, setInvoiceData, rawProducts, setRawProducts,
    fileName, setFileName, ocrProgress, isProcessing, setIsProcessing,
    error, setError, fxRate, setFxRate, isFxManual, setIsFxManual,
    fxRateError, setFxRateError, handleFileSelectCore, handleFxRateChange, cancelActiveAttempt,
  };
}
