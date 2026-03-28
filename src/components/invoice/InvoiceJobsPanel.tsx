import { Loader2, CircleAlert, CircleCheckBig, Receipt, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { InvoiceBackgroundJob } from '@/hooks/useInvoiceBackgroundJobs';

interface InvoiceJobsPanelProps {
  jobs: InvoiceBackgroundJob[];
  onReview: (jobId: string) => void;
  onDismiss: (jobId: string) => void;
}

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

export function InvoiceJobsPanel({ jobs, onReview, onDismiss }: InvoiceJobsPanelProps) {
  const { t } = useTranslation();

  if (jobs.length === 0) return null;

  const processingCount = jobs.filter((job) => job.status === 'processing').length;
  const readyCount = jobs.filter((job) => job.status === 'ready').length;
  const failedCount = jobs.filter((job) => job.status === 'failed').length;

  return (
    <section className="rounded-2xl border-2 border-sky-200 bg-gradient-to-r from-sky-50 via-white to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
            <Receipt className="h-3.5 w-3.5" />
            {t('invoiceUpload.panel.badge', 'Invoice jobs')}
          </div>
          <h2 className="text-lg font-semibold text-stone-900">
            {t('invoiceUpload.panel.title', 'Background imports stay visible here')}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {t(
              'invoiceUpload.panel.description',
              'Track invoice extraction here while it runs, then open review as soon as it is ready.',
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-white/90 px-3 py-2 text-right shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            {t('invoiceUpload.panel.summary', 'Summary')}
          </p>
          <p className="mt-1 text-sm font-medium text-stone-700">
            {processingCount > 0 ? t('invoiceUpload.tray.processingCount', { count: processingCount, defaultValue: '{{count}} processing' }) : t('invoiceUpload.tray.noneProcessing', 'No active processing')}
            {readyCount > 0 ? `, ${t('invoiceUpload.tray.readyCount', { count: readyCount, defaultValue: '{{count}} ready' })}` : ''}
            {failedCount > 0 ? `, ${t('invoiceUpload.tray.failedCount', { count: failedCount, defaultValue: '{{count}} failed' })}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {jobs.map((job) => (
          <article
            key={job.jobId}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              job.status === 'processing'
                ? 'border-emerald-200'
                : job.status === 'ready'
                  ? 'border-stone-200'
                  : 'border-[var(--color-terracotta)]/30'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  job.status === 'failed' ? 'bg-orange-50 text-[var(--color-terracotta)]' : 'bg-emerald-50 text-[var(--color-forest)]'
                }`}>
                  {job.status === 'processing' && <Loader2 className="h-5 w-5 animate-spin" />}
                  {job.status === 'ready' && <CircleCheckBig className="h-5 w-5" />}
                  {job.status === 'failed' && <CircleAlert className="h-5 w-5" />}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">{job.fileName}</p>
                  <p className="mt-1 text-sm text-stone-600">{getStatusCopy(job.status, t)}</p>
                  {job.status === 'processing' && (
                    <p className="mt-1 text-xs text-stone-500">
                      {t(
                        'invoiceUpload.panel.processingDescription',
                        'Upload finished. Extraction is still running in the background.',
                      )}
                    </p>
                  )}
                  {job.status === 'ready' && (
                    <p className="mt-1 text-xs text-stone-500">
                      {t(
                        'invoiceUpload.panel.readyDescription',
                        'Extraction completed. Open the existing review dialog to inspect imported rows.',
                      )}
                    </p>
                  )}
                  {job.error && (
                    <p className="mt-1 text-xs text-[var(--color-terracotta-dark)]">{job.error}</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  job.status === 'processing'
                    ? 'bg-emerald-50 text-[var(--color-forest)]'
                    : job.status === 'ready'
                      ? 'bg-stone-100 text-stone-700'
                      : 'bg-orange-50 text-[var(--color-terracotta-dark)]'
                }`}>
                  {job.status === 'processing'
                    ? t('invoiceUpload.panel.running', 'Running')
                    : job.status === 'ready'
                      ? t('invoiceUpload.panel.readyBadge', 'Ready')
                      : t('invoiceUpload.panel.failedBadge', 'Failed')}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-stone-500"
                  onClick={() => onDismiss(job.jobId)}
                  aria-label={t('invoiceUpload.panel.dismissJob', 'Dismiss invoice job')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {job.status === 'processing' && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[11px] text-stone-500">
                  <span>{t('invoiceUpload.panel.serverStatus', 'Server status')}</span>
                  <span>{job.backendStatus ?? t('invoiceUpload.status.processingShort', 'Processing')}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600" />
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              {job.status === 'ready' && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-dark)]"
                  onClick={() => onReview(job.jobId)}
                >
                  {t('invoiceUpload.tray.review', 'Review')}
                </Button>
              )}
              {job.status === 'failed' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onDismiss(job.jobId)}
                >
                  {t('invoiceUpload.tray.dismiss', 'Dismiss')}
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
