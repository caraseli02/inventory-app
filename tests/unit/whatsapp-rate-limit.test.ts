/**
 * Unit tests for WhatsApp per-phone rate limiting.
 * Tests: window-based counting, denial on 11th message, window reset, fail-open.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RATE_LIMIT_MAX_MESSAGES,
  RATE_LIMIT_WINDOW_SECONDS,
  buildRateLimitReply,
  checkRateLimit,
} from '../../lib/whatsapp/rate-limit';

type RateLimitRow = { message_count: number; window_start: string } | null;

function createRateLimitDouble(opts: {
  existing?: RateLimitRow;
  upsertError?: unknown;
  updateError?: unknown;
}) {
  const upsertMock = vi.fn().mockResolvedValue({ error: opts.upsertError ?? null });
  const updateEqMock = vi.fn().mockResolvedValue({ error: opts.updateError ?? null });
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: opts.existing ?? null, error: null });
  const eqSelectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqSelectMock });

  const client = {
    from: vi.fn(() => ({
      select: selectMock,
      upsert: upsertMock,
      update: updateMock,
    })),
  };

  return { client, spies: { upsertMock, updateMock, updateEqMock, maybeSingleMock } };
}

describe('checkRateLimit', () => {
  describe('fresh window (no existing record)', () => {
    it('allows first message when no record exists', async () => {
      const { client } = createRateLimitDouble({ existing: null });
      const result = await checkRateLimit(client as never, '+40123456789');
      expect(result).toEqual({ allowed: true });
    });

    it('upserts count=1 for fresh window', async () => {
      const { client, spies } = createRateLimitDouble({ existing: null });
      await checkRateLimit(client as never, '+40123456789');
      expect(spies.upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ phone_number: '+40123456789', message_count: 1 }),
        { onConflict: 'phone_number' }
      );
    });
  });

  describe(`within ${RATE_LIMIT_WINDOW_SECONDS}s window`, () => {
    it(`allows up to ${RATE_LIMIT_MAX_MESSAGES} messages`, async () => {
      const windowStart = new Date(Date.now() - 10_000).toISOString(); // 10s ago
      // Simulate count=9 (9 previous messages, this is the 10th)
      const { client } = createRateLimitDouble({
        existing: { message_count: 9, window_start: windowStart },
      });
      const result = await checkRateLimit(client as never, '+40123456789');
      expect(result).toEqual({ allowed: true });
    });

    it(`denies the ${RATE_LIMIT_MAX_MESSAGES + 1}th message`, async () => {
      const windowStart = new Date(Date.now() - 10_000).toISOString();
      // count=10 means this call would make 11 total
      const { client } = createRateLimitDouble({
        existing: { message_count: 10, window_start: windowStart },
      });
      const result = await checkRateLimit(client as never, '+40123456789');
      expect(result).toEqual({ allowed: false });
    });

    it('increments message_count on each allowed message', async () => {
      const windowStart = new Date(Date.now() - 10_000).toISOString();
      const { client, spies } = createRateLimitDouble({
        existing: { message_count: 5, window_start: windowStart },
      });
      await checkRateLimit(client as never, '+40123456789');
      expect(spies.updateMock).toHaveBeenCalledWith({ message_count: 6 });
      expect(spies.updateEqMock).toHaveBeenCalledWith('phone_number', '+40123456789');
    });
  });

  describe('window reset (> 60s elapsed)', () => {
    it('allows message after window resets', async () => {
      // window_start is older than RATE_LIMIT_WINDOW_SECONDS ago → expired
      const windowStart = new Date(
        Date.now() - (RATE_LIMIT_WINDOW_SECONDS + 5) * 1000
      ).toISOString();
      const { client } = createRateLimitDouble({
        existing: { message_count: 99, window_start: windowStart },
      });
      const result = await checkRateLimit(client as never, '+40123456789');
      expect(result).toEqual({ allowed: true });
    });

    it('resets count to 1 when window expires', async () => {
      const windowStart = new Date(
        Date.now() - (RATE_LIMIT_WINDOW_SECONDS + 5) * 1000
      ).toISOString();
      const { client, spies } = createRateLimitDouble({
        existing: { message_count: 99, window_start: windowStart },
      });
      await checkRateLimit(client as never, '+40123456789');
      expect(spies.upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ phone_number: '+40123456789', message_count: 1 }),
        { onConflict: 'phone_number' }
      );
    });
  });

  describe('fail-open on DB errors', () => {
    it('allows message when DB throws', async () => {
      const client = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockRejectedValue(new Error('db down')),
            })),
          })),
        })),
      };
      const result = await checkRateLimit(client as never, '+40123456789');
      expect(result).toEqual({ allowed: true });
    });
  });
});

describe('buildRateLimitReply', () => {
  it('returns a bilingual throttle message', () => {
    const reply = buildRateLimitReply();
    expect(reply).toMatch(/prea multe/i);
    expect(reply).toMatch(/too many/i);
  });
});

// Snapshot: exported constants match documented values
describe('rate limit constants', () => {
  it('window is 60 seconds', () => {
    expect(RATE_LIMIT_WINDOW_SECONDS).toBe(60);
  });
  it('max messages is 10', () => {
    expect(RATE_LIMIT_MAX_MESSAGES).toBe(10);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
});
