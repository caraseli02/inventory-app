import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractInvoiceData } from '@/lib/invoiceOCR';
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

  beforeEach(() => {
    MockXMLHttpRequest.instances = [];
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest as unknown as typeof XMLHttpRequest);
  });

  afterEach(() => {
    vi.stubGlobal('XMLHttpRequest', originalXHR);
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
});
