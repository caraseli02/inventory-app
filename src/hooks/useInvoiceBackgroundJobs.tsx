/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { InvoiceData, InvoiceExtractionJobStatus } from '@/lib/invoiceOCR';
import { getInvoiceExtractionStatus } from '@/lib/invoiceOCR';
import { logger } from '@/lib/logger';

export type InvoiceBackgroundJobUiStatus = 'processing' | 'ready' | 'failed';

export interface InvoiceBackgroundJob {
  jobId: string;
  fileName: string;
  statusUrl: string;
  status: InvoiceBackgroundJobUiStatus;
  backendStatus?: Extract<InvoiceExtractionJobStatus, 'queued' | 'processing'>;
  retryAfterSeconds: number | null;
  invoiceData?: InvoiceData;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceReviewSession {
  jobId: string;
  fileName: string;
  invoiceData: InvoiceData;
}

interface InvoiceBackgroundJobsContextValue {
  jobs: InvoiceBackgroundJob[];
  reviewSession: InvoiceReviewSession | null;
  registerPendingJob: (input: {
    jobId: string;
    fileName: string;
    statusUrl: string;
    retryAfterSeconds: number | null;
    backendStatus?: Extract<InvoiceExtractionJobStatus, 'queued' | 'processing'>;
  }) => void;
  dismissJob: (jobId: string) => void;
  openReviewSession: (jobId: string) => void;
  clearReviewSession: () => void;
}

const InvoiceBackgroundJobsContext = createContext<InvoiceBackgroundJobsContextValue | undefined>(undefined);

function waitForRetry(retryAfterSeconds: number | null): Promise<void> {
  const retryAfterMs = Math.max(0, (retryAfterSeconds ?? 2) * 1000);
  return new Promise((resolve) => window.setTimeout(resolve, retryAfterMs));
}

export function InvoiceBackgroundJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<InvoiceBackgroundJob[]>([]);
  const [reviewSession, setReviewSession] = useState<InvoiceReviewSession | null>(null);
  const activePollersRef = useRef(new Set<string>());

  const dismissJob = useCallback((jobId: string) => {
    activePollersRef.current.delete(jobId);
    setJobs((prev) => prev.filter((job) => job.jobId !== jobId));
    setReviewSession((prev) => (prev?.jobId === jobId ? null : prev));
  }, []);

  const registerPendingJob = useCallback((input: {
    jobId: string;
    fileName: string;
    statusUrl: string;
    retryAfterSeconds: number | null;
    backendStatus?: Extract<InvoiceExtractionJobStatus, 'queued' | 'processing'>;
  }) => {
    const timestamp = new Date().toISOString();
    setJobs((prev) => {
      const existing = prev.find((job) => job.jobId === input.jobId);
      const nextJob: InvoiceBackgroundJob = {
        jobId: input.jobId,
        fileName: input.fileName,
        statusUrl: input.statusUrl,
        status: 'processing',
        backendStatus: input.backendStatus,
        retryAfterSeconds: input.retryAfterSeconds,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        invoiceData: existing?.invoiceData,
        error: undefined,
      };

      if (!existing) return [nextJob, ...prev];
      return prev.map((job) => (job.jobId === input.jobId ? nextJob : job));
    });
  }, []);

  const clearReviewSession = useCallback(() => setReviewSession(null), []);

  const openReviewSession = useCallback((jobId: string) => {
    setJobs((prev) => {
      const job = prev.find((item) => item.jobId === jobId);
      if (job?.status === 'ready' && job.invoiceData) {
        setReviewSession({
          jobId: job.jobId,
          fileName: job.fileName,
          invoiceData: job.invoiceData,
        });
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    const processingJobs = jobs.filter((job) => job.status === 'processing');
    processingJobs.forEach((job) => {
      if (activePollersRef.current.has(job.jobId)) return;
      activePollersRef.current.add(job.jobId);

      void (async () => {
        let currentStatusUrl = job.statusUrl;
        let nextRetryAfterSeconds = job.retryAfterSeconds;

        while (activePollersRef.current.has(job.jobId)) {
          await waitForRetry(nextRetryAfterSeconds);
          if (!activePollersRef.current.has(job.jobId)) return;

          try {
            const result = await getInvoiceExtractionStatus(currentStatusUrl);
            if (!activePollersRef.current.has(job.jobId)) return;

            if (result.success) {
              activePollersRef.current.delete(job.jobId);
              setJobs((prev) => prev.map((item) => (
                item.jobId === job.jobId
                  ? {
                    ...item,
                    status: 'ready',
                    invoiceData: result.data,
                    backendStatus: undefined,
                    retryAfterSeconds: null,
                    updatedAt: new Date().toISOString(),
                    error: undefined,
                  }
                  : item
              )));
              return;
            }

            if (!result.pending) {
              activePollersRef.current.delete(job.jobId);
              setJobs((prev) => prev.map((item) => (
                item.jobId === job.jobId
                  ? {
                    ...item,
                    status: 'failed',
                    backendStatus: undefined,
                    retryAfterSeconds: null,
                    updatedAt: new Date().toISOString(),
                    error: result.error,
                  }
                  : item
              )));
              return;
            }

            currentStatusUrl = result.statusUrl;
            nextRetryAfterSeconds = result.retryAfterSeconds;
            setJobs((prev) => prev.map((item) => (
              item.jobId === job.jobId
                ? {
                  ...item,
                  statusUrl: result.statusUrl,
                  backendStatus: result.jobStatus,
                  retryAfterSeconds: result.retryAfterSeconds,
                  updatedAt: new Date().toISOString(),
                }
                : item
            )));
          } catch (error) {
            logger.error('Invoice background job polling crashed', {
              jobId: job.jobId,
              fileName: job.fileName,
              errorMessage: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
            });
            activePollersRef.current.delete(job.jobId);
            setJobs((prev) => prev.map((item) => (
              item.jobId === job.jobId
                ? {
                  ...item,
                  status: 'failed',
                  backendStatus: undefined,
                  retryAfterSeconds: null,
                  updatedAt: new Date().toISOString(),
                  error: error instanceof Error ? error.message : 'Failed to process invoice job.',
                }
                : item
            )));
            return;
          }
        }
      })();
    });

  }, [jobs]);

  const value = useMemo<InvoiceBackgroundJobsContextValue>(() => ({
    jobs,
    reviewSession,
    registerPendingJob,
    dismissJob,
    openReviewSession,
    clearReviewSession,
  }), [jobs, reviewSession, registerPendingJob, dismissJob, openReviewSession, clearReviewSession]);

  return (
    <InvoiceBackgroundJobsContext.Provider value={value}>
      {children}
    </InvoiceBackgroundJobsContext.Provider>
  );
}

export function useInvoiceBackgroundJobs() {
  const context = useContext(InvoiceBackgroundJobsContext);
  if (!context) {
    throw new Error('useInvoiceBackgroundJobs must be used within InvoiceBackgroundJobsProvider');
  }
  return context;
}
