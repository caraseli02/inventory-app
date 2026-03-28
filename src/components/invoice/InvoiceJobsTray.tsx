import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt, Loader2, CircleAlert, CircleCheckBig, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInvoiceBackgroundJobs } from '@/hooks/useInvoiceBackgroundJobs';

function getStatusCopy(
  status: 'processing' | 'ready' | 'failed',
  t: ReturnType<typeof useTranslation>['t'],
) {
  switch (status) {
    case 'ready':
      return t('invoiceUpload.status.readyToReview', 'Ready to review');
    case 'failed':
      return t('invoiceUpload.status.failedShort', 'Failed');
    default:
      return t('invoiceUpload.status.processingShort', 'Processing');
  }
}

export function InvoiceJobsTray() {
  const { t } = useTranslation();
  const { jobs, dismissJob, openReviewSession } = useInvoiceBackgroundJobs();
  const [isOpen, setIsOpen] = useState(false);

  const summary = useMemo(() => ({
    processing: jobs.filter((job) => job.status === 'processing').length,
    ready: jobs.filter((job) => job.status === 'ready').length,
    failed: jobs.filter((job) => job.status === 'failed').length,
  }), [jobs]);

  if (jobs.length === 0) return null;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 border-2 border-stone-200 bg-white/80 backdrop-blur-sm hover:border-stone-300"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Receipt className="h-4 w-4" />
        <span className="hidden sm:inline">{t('invoiceUpload.tray.button', 'Invoice jobs')}</span>
        <Badge variant="outline" className="ml-1 border-stone-300 bg-stone-50 text-stone-700">
          {jobs.length}
        </Badge>
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[340px] rounded-2xl border-2 border-stone-200 bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-stone-900">{t('invoiceUpload.tray.title', 'Background jobs')}</p>
              <p className="text-xs text-stone-500">
                {summary.processing > 0 ? t('invoiceUpload.tray.processingCount', { count: summary.processing, defaultValue: '{{count}} processing' }) : t('invoiceUpload.tray.noneProcessing', 'No active processing')}
                {summary.ready > 0 ? `, ${t('invoiceUpload.tray.readyCount', { count: summary.ready, defaultValue: '{{count}} ready' })}` : ''}
                {summary.failed > 0 ? `, ${t('invoiceUpload.tray.failedCount', { count: summary.failed, defaultValue: '{{count}} failed' })}` : ''}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setIsOpen(false)}>
              {t('invoiceUpload.actions.close', 'Close')}
            </Button>
          </div>

          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.jobId} className="rounded-xl border border-stone-200 bg-stone-50/80 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {job.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-[var(--color-forest)]" />}
                      {job.status === 'ready' && <CircleCheckBig className="h-4 w-4 text-[var(--color-forest)]" />}
                      {job.status === 'failed' && <CircleAlert className="h-4 w-4 text-[var(--color-terracotta)]" />}
                      <p className="truncate text-sm font-medium text-stone-900">{job.fileName}</p>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">{getStatusCopy(job.status, t)}</p>
                    {job.error && (
                      <p className="mt-1 text-xs text-[var(--color-terracotta-dark)]">{job.error}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-stone-500"
                    onClick={() => dismissJob(job.jobId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {job.status === 'ready' && (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-dark)]"
                      onClick={() => {
                        openReviewSession(job.jobId);
                        setIsOpen(false);
                      }}
                    >
                      {t('invoiceUpload.tray.review', 'Review')}
                    </Button>
                  )}
                  {job.status === 'failed' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => dismissJob(job.jobId)}
                    >
                      {t('invoiceUpload.tray.dismiss', 'Dismiss')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
