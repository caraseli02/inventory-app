/**
 * Unit Tests: Invoice OCR (FastAPI Integration)
 *
 * Tests for FastAPI /extract endpoint integration.
 * Uses mocking to avoid actual API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractInvoiceData, type InvoiceData, type InvoiceProduct } from '@/lib/invoiceOCR';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock import.meta.env
vi.mock('import.meta', () => ({
  env: {
    VITE_INVOICE_API_URL: 'http://localhost:8000',
    VITE_INVOICE_API_KEY: 'test-api-key',
    VITE_INVOICE_API_REQUIRE_AUTH: 'false',
  },
}));

// Helper to create mock Response
function createMockResponse(data: any, status: number = 200, ok: boolean = true) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: new Headers(),
    json: async () => data,
  } as unknown as Response;
}

describe('Invoice OCR (FastAPI Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe('Success Mapping', () => {
    it('should map FastAPI response fields to InvoiceData correctly', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        products: [
          {
            name: 'Milk 1L',
            quantity: 12,
            unit_price: 1.35,
            total_price: 16.2,
            raw_code: '0123456789012',
          },
          {
            name: 'Bread',
            quantity: 5,
            unit_price: 2.50,
            total_price: 12.50,
            raw_code: '9876543210987',
          },
        ],
        supplier: 'Test Supplier',
        invoice_number: 'INV-123',
        date: '2026-02-01',
        total_amount: 28.70,
        currency: 'EUR',
        confidence_score: 0.92,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(true);

      if (result.success) {
        const data = result.data;

        expect(data.supplier).toBe('Test Supplier');
        expect(data.invoiceNumber).toBe('INV-123');
        expect(data.invoiceDate).toBe('2026-02-01');
        expect(data.totalAmount).toBe(28.70);
        expect(data.products).toHaveLength(2);

        const product1 = data.products[0] as InvoiceProduct;
        expect(product1.name).toBe('Milk 1L');
        expect(product1.quantity).toBe(12);
        expect(product1.unitPrice).toBe(1.35);
        expect(product1.totalPrice).toBe(16.2);
        expect(product1.barcode).toBe('0123456789012');

        const product2 = data.products[1] as InvoiceProduct;
        expect(product2.name).toBe('Bread');
        expect(product2.quantity).toBe(5);
        expect(product2.unitPrice).toBe(2.50);
        expect(product2.totalPrice).toBe(12.50);
        expect(product2.barcode).toBe('9876543210987');
      }
    });

    it('should handle products without barcodes', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        products: [
          {
            name: 'Product without barcode',
            quantity: 1,
            unit_price: 10.00,
            total_price: 10.00,
          },
        ],
        total_amount: 10.00,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(true);

      if (result.success) {
        const product = result.data.products[0] as InvoiceProduct;
        expect(product.barcode).toBeUndefined();
      }
    });

    it('should ignore currency and confidence_score fields', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        products: [
          {
            name: 'Test Product',
            quantity: 1,
            unit_price: 10.00,
            total_price: 10.00,
          },
        ],
        total_amount: 10.00,
        currency: 'EUR',
        confidence_score: 0.95,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(true);

      if (result.success) {
        const data = result.data;
        expect((data as any).currency).toBeUndefined();
        expect((data as any).confidence_score).toBeUndefined();
      }
    });
  });

  describe('Authentication Errors', () => {
    it('should return error on 401 unauthorized', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      mockFetch.mockResolvedValueOnce(createMockResponse(null, 401, false));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Invalid or missing API key');
      }
    });
  });

  describe('Invalid PDF Errors', () => {
    it('should return error on 400 invalid file type', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      mockFetch.mockResolvedValueOnce(createMockResponse(null, 400, false));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Invalid PDF file');
      }
    });

    it('should return error on 422 validation error', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      mockFetch.mockResolvedValueOnce(createMockResponse(null, 422, false));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Invalid PDF file');
      }
    });
  });

  describe('Missing Total Amount Error', () => {
    it('should return error when total_amount is missing', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        products: [
          {
            name: 'Product',
            quantity: 1,
            unit_price: 10.00,
            total_price: 10.00,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Invoice total amount not found');
      }
    });

    it('should return error when total_amount is null', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        products: [
          {
            name: 'Product',
            quantity: 1,
            unit_price: 10.00,
            total_price: 10.00,
          },
        ],
        total_amount: null,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Invoice total amount not found');
      }
    });
  });

  describe('Empty Products Error', () => {
    it('should return error when products array is empty', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        products: [],
        total_amount: 0.00,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toMatch(/No products found in the invoice/);
      }
    });
  });

  describe('Network Errors', () => {
    it('should return error on network failure', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Network error');
      }
    });

    it('should return error on fetch timeout', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const timeoutError = new Error('Failed to fetch');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Network error');
      }
    });
  });

  describe('File Validation', () => {
    it('should reject non-PDF files by type', async () => {
      const imageBlob = new Blob(['fake image'], { type: 'image/jpeg' });
      const imageFile = new File([imageBlob], 'invoice.jpg', { type: 'image/jpeg' });

      const result = await extractInvoiceData(imageFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Invalid file type');
        expect(result.error).toContain('PDF');
      }
    });

    it('should reject non-PDF files by extension', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const txtFile = new File([pdfBlob], 'invoice.txt', { type: 'application/pdf' });

      const result = await extractInvoiceData(txtFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Invalid file extension');
        expect(result.error).toContain('PDF');
      }
    });

    it('should reject files larger than 10MB', async () => {
      const largeSize = 11 * 1024 * 1024;
      const largeBlob = new Blob([new ArrayBuffer(largeSize)], { type: 'application/pdf' });
      const largeFile = new File([largeBlob], 'large.pdf', { type: 'application/pdf' });

      const result = await extractInvoiceData(largeFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('File size exceeds 10MB limit');
      }
    });

    it('should accept valid PDF files under 10MB', async () => {
      const smallBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const smallFile = new File([smallBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        products: [{ name: 'Product', quantity: 1, unit_price: 10.00, total_price: 10.00 }],
        total_amount: 10.00,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await extractInvoiceData(smallFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Progress Callback', () => {
    it('should call progress callback during extraction', async () => {
      const progressValues: number[] = [];
      const onProgress = (progress: number) => {
        progressValues.push(progress);
      };

      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        products: [{ name: 'Product', quantity: 1, unit_price: 10.00, total_price: 10.00 }],
        total_amount: 10.00,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      await extractInvoiceData(pdfFile, onProgress);

      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });

    it('should handle progress callback errors gracefully', async () => {
      const onProgress = vi.fn(() => {
        throw new Error('Progress callback error');
      });

      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        products: [{ name: 'Product', quantity: 1, unit_price: 10.00, total_price: 10.00 }],
        total_amount: 10.00,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await extractInvoiceData(pdfFile, onProgress);

      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Response Structure', () => {
    it('should return error on malformed JSON response', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Invalid response');
      }
    });

    it('should return error when products field is missing', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        total_amount: 10.00,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Invalid product data');
      }
    });

    it('should return error when products field is not an array', async () => {
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'invoice.pdf', { type: 'application/pdf' });

      const mockResponse = {
        products: 'not an array',
        total_amount: 10.00,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await extractInvoiceData(pdfFile);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toContain('Invalid product data');
      }
    });
  });
});
