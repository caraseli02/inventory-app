import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractInvoiceData, getInvoiceExtractionStatus } from '@/lib/invoiceOCR';
import { resolveSupabaseAccessToken } from '@/lib/invoiceAuth';

vi.mock('@/lib/invoiceAuth', () => ({
  resolveSupabaseAccessToken: vi.fn(),
}));

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];

  readonly upload = {
    addEventListener: vi.fn(),
  };

  readonly requestHeaders: Record<string, string> = {};

  responseText = '';
  status = 0;
  statusText = '';
  timeout = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  open = vi.fn();
  getAllResponseHeaders = vi.fn(() => '');

  setRequestHeader = vi.fn((key: string, value: string) => {
    this.requestHeaders[key] = value;
  });

  send = vi.fn(() => {
    this.status = 200;
    this.statusText = 'OK';
    this.responseText = JSON.stringify({
      products: [{ name: 'Test', quantity: 1, unit_price: 1.25, total_price: 1.25 }],
      total_amount: 1.25,
    });
    this.onload?.();
  });
}

describe('invoiceOCR upload headers', () => {
  const originalXHR = globalThis.XMLHttpRequest;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    MockXMLHttpRequest.instances = [];
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest as unknown as typeof XMLHttpRequest);
  });

  afterEach(() => {
    vi.stubGlobal('XMLHttpRequest', originalXHR);
    vi.stubGlobal('fetch', originalFetch);
  });

  it('sends authorization header and does not set content-type manually', async () => {
    vi.mocked(resolveSupabaseAccessToken).mockResolvedValue('token-123');
    const file = new File([new Blob(['%PDF-1.4'])], 'invoice.pdf', { type: 'application/pdf' });

    const result = await extractInvoiceData(file);

    expect(result.success).toBe(true);
    expect(MockXMLHttpRequest.instances).toHaveLength(1);

    const req = MockXMLHttpRequest.instances[0];
    expect(req.requestHeaders.Authorization).toBe('Bearer token-123');
    expect(req.requestHeaders['Content-Type']).toBeUndefined();
  });

  it('returns auth error and does not upload when token is unavailable', async () => {
    vi.mocked(resolveSupabaseAccessToken).mockResolvedValue(null);
    const file = new File([new Blob(['%PDF-1.4'])], 'invoice.pdf', { type: 'application/pdf' });

    const result = await extractInvoiceData(file);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Authentication required');
    }
    expect(MockXMLHttpRequest.instances).toHaveLength(0);
  });

  it('returns pending job metadata for accepted extraction jobs', async () => {
    vi.mocked(resolveSupabaseAccessToken).mockResolvedValue('token-123');
    const file = new File([new Blob(['%PDF-1.4'])], 'invoice.pdf', { type: 'application/pdf' });

    MockXMLHttpRequest.instances = [];
    vi.stubGlobal('XMLHttpRequest', class extends MockXMLHttpRequest {
      send = vi.fn(() => {
        this.status = 202;
        this.statusText = 'Accepted';
        this.responseText = JSON.stringify({
          job_id: 'ext-123',
          status: 'queued',
          status_url: '/invoice/extraction-jobs/ext-123',
        });
        this.getAllResponseHeaders = vi.fn(() => 'Retry-After: 2\r\nLocation: /invoice/extraction-jobs/ext-123\r\n');
        this.onload?.();
      });
    } as unknown as typeof XMLHttpRequest);

    const result = await extractInvoiceData(file);

    expect(result.success).toBe(false);
    expect(result.pending).toBe(true);
    if (!result.success && result.pending) {
      expect(result.jobId).toBe('ext-123');
      expect(result.jobStatus).toBe('queued');
      expect(result.statusUrl).toContain('/invoice/extraction-jobs/ext-123');
      expect(result.retryAfterSeconds).toBe(2);
    }
  });

  it('polls extraction status with auth header', async () => {
    vi.mocked(resolveSupabaseAccessToken).mockResolvedValue('token-123');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      job_id: 'ext-123',
      status: 'succeeded',
      result: {
        products: [{ name: 'Test', quantity: 1, unit_price: 1.25, total_price: 1.25 }],
        total_amount: 1.25,
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getInvoiceExtractionStatus('/invoice/extraction-jobs/ext-123');

    expect(fetchMock).toHaveBeenCalledWith('/invoice/extraction-jobs/ext-123', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token-123',
      },
    });
    expect(result.success).toBe(true);
  });
});
