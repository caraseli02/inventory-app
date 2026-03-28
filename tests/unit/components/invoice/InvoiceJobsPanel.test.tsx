import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InvoiceJobsPanel } from '@/components/invoice/InvoiceJobsPanel';
import i18n from '@/i18n';

describe('InvoiceJobsPanel', () => {
  it('renders processing and ready jobs inline and forwards actions', async () => {
    await i18n.changeLanguage('en');
    const onReview = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InvoiceJobsPanel
        jobs={[
          {
            jobId: 'job-processing',
            fileName: 'processing.pdf',
            statusUrl: '/invoice/extraction-jobs/job-processing',
            status: 'processing',
            backendStatus: 'processing',
            retryAfterSeconds: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            jobId: 'job-ready',
            fileName: 'ready.pdf',
            statusUrl: '/invoice/extraction-jobs/job-ready',
            status: 'ready',
            retryAfterSeconds: null,
            invoiceData: {
              products: [],
              supplier: 'Demo Supplier',
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
        onReview={onReview}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText(/Background imports stay visible here/i)).toBeInTheDocument();
    expect(screen.getByText('processing.pdf')).toBeInTheDocument();
    expect(screen.getByText('ready.pdf')).toBeInTheDocument();
    expect(screen.getByText(/1 processing, 1 ready/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Review$/i }));
    expect(onReview).toHaveBeenCalledWith('job-ready');

    fireEvent.click(screen.getAllByLabelText(/Dismiss invoice job/i)[0]!);
    expect(onDismiss).toHaveBeenCalledWith('job-processing');
  });
});
