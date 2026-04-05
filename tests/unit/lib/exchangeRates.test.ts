/**
 * Unit Tests: Exchange Rates (BNM)
 *
 * Tests for Moldovan National Bank exchange rate fetching.
 * Uses DOMParser from jsdom environment for XML parsing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch for network requests
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const VALID_XML = '<?xml version="1.0" encoding="UTF-8"?><ValCurs Date="03.04.2026"><Valute><CharCode>EUR</CharCode><Nominal>1</Nominal><Value>19.56</Value></Valute></ValCurs>';
const VALID_XML_WITH_COMMA = '<?xml version="1.0" encoding="UTF-8"?><ValCurs Date="03.04.2026"><Valute><CharCode>EUR</CharCode><Nominal>1</Nominal><Value>19,56</Value></Valute></ValCurs>';
const VALID_XML_100_EUR = '<?xml version="1.0" encoding="UTF-8"?><ValCurs Date="03.04.2026"><Valute><CharCode>EUR</CharCode><Nominal>100</Nominal><Value>1956.00</Value></Valute></ValCurs>';
const XML_NO_DATE = '<?xml version="1.0" encoding="UTF-8"?><ValCurs><Valute><CharCode>EUR</CharCode><Nominal>1</Nominal><Value>19.56</Value></Valute></ValCurs>';
const XML_NO_EUR = '<?xml version="1.0" encoding="UTF-8"?><ValCurs Date="03.04.2026"><Valute><CharCode>USD</CharCode><Nominal>1</Nominal><Value>17.50</Value></Valute></ValCurs>';
const INVALID_XML = '<invalid>not xml</invalid>';

describe('exchangeRates (BNM)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBnmEurRate - basic fetch', () => {
    it('fetches latest rate when no invoice date provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => VALID_XML,
      } as Response);

      const { getBnmEurRate } = await import('@/lib/exchangeRates');
      const result = await getBnmEurRate();

      expect(result.rate).toBeCloseTo(19.56, 2);
      expect(result.isFallback).toBe(false);
      expect(result.date).toBe('03.04.2026');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('fetches rate for specific invoice date', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => VALID_XML,
      } as Response);

      const { getBnmEurRate } = await import('@/lib/exchangeRates');
      const invoiceDate = new Date('2026-04-01T12:00:00Z');
      const result = await getBnmEurRate(invoiceDate);

      expect(result.rate).toBeCloseTo(19.56, 2);
      // Should call with date parameter
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('date='),
        { method: 'GET' }
      );
    });

    it('handles comma decimal separator', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => VALID_XML_WITH_COMMA,
      } as Response);

      const { getBnmEurRate } = await import('@/lib/exchangeRates');
      const result = await getBnmEurRate();

      expect(result.rate).toBeCloseTo(19.56, 2);
    });

    it('handles non-unit nominal (100 EUR)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => VALID_XML_100_EUR,
      } as Response);

      const { getBnmEurRate } = await import('@/lib/exchangeRates');
      const result = await getBnmEurRate();

      // 1956.00 / 100 = 19.56
      expect(result.rate).toBeCloseTo(19.56, 2);
    });
  });

  describe('getBnmEurRate - lookback behavior', () => {
    it('returns isFallback=true when using lookback day', async () => {
      let attemptCount = 0;
      fetchMock.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Not found');
        }
        return {
          ok: true,
          text: async () => VALID_XML,
        } as Response;
      });

      const { getBnmEurRate } = await import('@/lib/exchangeRates');
      const invoiceDate = new Date('2026-04-03');
      const result = await getBnmEurRate(invoiceDate, 7);

      expect(result.rate).toBeCloseTo(19.56, 2);
      expect(result.isFallback).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('tries multiple lookback days before giving up', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const { getBnmEurRate } = await import('@/lib/exchangeRates');
      const invoiceDate = new Date('2026-04-03');

      await expect(getBnmEurRate(invoiceDate, 2)).rejects.toThrow('Network error');
      expect(fetchMock).toHaveBeenCalledTimes(3); // offset 0, 1, 2
    });

    it('respects custom maxLookbackDays', async () => {
      fetchMock.mockRejectedValue(new Error('Not found'));

      const { getBnmEurRate } = await import('@/lib/exchangeRates');
      const invoiceDate = new Date('2026-04-03');

      await expect(getBnmEurRate(invoiceDate, 5)).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(6); // offset 0-5
    });
  });

  describe('getBnmEurRate - error handling', () => {
    it('throws on HTTP error response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
      } as Response);

      const { getBnmEurRate } = await import('@/lib/exchangeRates');

      await expect(getBnmEurRate()).rejects.toThrow('BNM request failed: 503');
    });

    it('throws on invalid XML', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => INVALID_XML,
      } as Response);

      const { getBnmEurRate } = await import('@/lib/exchangeRates');

      await expect(getBnmEurRate()).rejects.toThrow();
    });

    it('throws when EUR not found in response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => XML_NO_EUR,
      } as Response);

      const { getBnmEurRate } = await import('@/lib/exchangeRates');

      await expect(getBnmEurRate()).rejects.toThrow('EUR rate not found in BNM response');
    });

    it('throws on missing rate date', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => XML_NO_DATE,
      } as Response);

      const { getBnmEurRate } = await import('@/lib/exchangeRates');

      await expect(getBnmEurRate()).rejects.toThrow('Missing rate date in BNM response');
    });
  });

  describe('BnmRateResult type', () => {
    it('returns result with correct shape', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => VALID_XML,
      } as Response);

      const { getBnmEurRate } = await import('@/lib/exchangeRates');
      const result = await getBnmEurRate();

      expect(result).toHaveProperty('rate');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('isFallback');
      expect(typeof result.rate).toBe('number');
      expect(typeof result.date).toBe('string');
      expect(typeof result.isFallback).toBe('boolean');
    });
  });
});
