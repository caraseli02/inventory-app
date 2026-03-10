import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { computeTwilioSignature } from '../../../api/lib/twilio-signature.js';

type JsonValue = Record<string, unknown> | null;

function makeSignature(params: Record<string, string>): string {
  return computeTwilioSignature({
    authToken: 'test-token',
    url: 'https://example.com/api/whatsapp',
    params,
  });
}

function createRequest(params: Record<string, string>, headers: Record<string, string> = {}): VercelRequest {
  return {
    method: 'POST',
    body: params,
    headers: {
      'x-twilio-signature': makeSignature(params),
      'x-forwarded-host': 'example.com',
      'x-forwarded-proto': 'https',
      ...headers,
    },
    url: '/api/whatsapp',
  } as unknown as VercelRequest;
}

function createResponse() {
  const res = {
    statusCode: 200,
    sentBody: null as string | null,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader(k: string, v: string) {
      res.headers[k] = v;
      return res;
    },
    send(body: string) {
      res.sentBody = body;
      return res;
    },
    json(body: unknown) {
      res.sentBody = JSON.stringify(body);
      return res;
    },
    end() {
      return res;
    },
  };
  return res as unknown as VercelResponse & {
    statusCode: number;
    sentBody: string | null;
    headers: Record<string, string>;
  };
}

describe('api/whatsapp (webhook handler)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const ENV_VARS = ['TWILIO_AUTH_TOKEN', 'TWILIO_ACCOUNT_SID', 'TWILIO_FROM_NUMBER', 'TWILIO_CONFIRM_CONTENT_SID'];
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save original env vars
    savedEnv = Object.fromEntries(ENV_VARS.map((k) => [k, process.env[k]]));

    // Set base Twilio env for tests
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.TWILIO_WEBHOOK_URL = 'https://example.com/api/whatsapp';

    // Mock global fetch for REST calls
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore env vars
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }

    // Restore global fetch
    vi.unstubAllGlobals();
  });

  describe('Security', () => {
    it('returns 405 for non-POST requests', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      const req = { method: 'GET', body: {}, headers: {} } as unknown as VercelRequest;
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(405);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 500 when TWILIO_AUTH_TOKEN is not set', async () => {
      delete process.env.TWILIO_AUTH_TOKEN;
      const { default: handler } = await import('../../../api/whatsapp');
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'hello' });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.sentBody).toContain('Twilio not configured');
    });

    it('returns 403 for missing Twilio signature', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'hello' });
      req.headers['x-twilio-signature'] = '';
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 403 for invalid Twilio signature', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'hello' });
      req.headers['x-twilio-signature'] = 'invalid-signature';
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 200 for valid Twilio signature', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: '' });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('Empty messages', () => {
    it('returns empty TwiML when Body is empty', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: '' });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      // Note: empty message path doesn't set Content-Type header
    });

    it('returns empty TwiML when Body is whitespace only', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: '   ' });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
    });

    it('returns empty TwiML when From is missing', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      const req = createRequest({ Body: 'hello' });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
    });
  });

  describe('REST credentials detection', () => {
    it('returns TwiML ack when REST credentials are set', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'test' });
      const res = createResponse();

      await handler(req, res);

      // Should return TwiML ack when REST credentials exist
      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      expect(res.headers['Content-Type']).toBe('text/xml');
      // Should contain acknowledgment message
      expect(res.sentBody).toMatch(/Am primit|Got it/i);
    });

    it('skips REST TwiML ack when REST credentials are missing', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_FROM_NUMBER;
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: '' });
      const res = createResponse();

      await handler(req, res);

      // Should return empty TwiML when no REST credentials
      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
    });
  });

  describe('Regression: waitUntil keeps function alive for async REST', () => {
    it('logs "starting async reply" when REST credentials present', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'test' });
      const res = createResponse();

      await handler(req, res);

      // The "[whatsapp] starting async reply..." log should appear
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('starting async reply'));

      logSpy.mockRestore();
    });

    it('returns TwiML ack immediately (before async work completes)', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';

      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'test' });
      const res = createResponse();

      // Call handler - it should return immediately with TwiML ack
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      // Should be the ack message, not the final AI response
      expect(res.sentBody).toMatch(/⏳/);
    });

    it('button payload confirm returns TwiML (not REST) for immediate response', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        ButtonPayload: 'confirm',
        Body: '',
      });
      const res = createResponse();

      await handler(req, res);

      // Button taps should return TwiML, not trigger async REST
      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
    });

    it('button payload cancel returns TwiML (not REST) for immediate response', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        ButtonPayload: 'cancel',
        Body: '',
      });
      const res = createResponse();

      await handler(req, res);

      // Button taps should return TwiML
      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
    });
  });

  describe('Language detection', () => {
    it('returns Romanian ack for Romanian messages', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';

      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'salut' });
      const res = createResponse();

      await handler(req, res);

      expect(res.sentBody).toContain('⏳ Am primit');
    });

    it('returns English ack for English messages (with English keywords)', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';

      // detectEnglish() checks for keywords like "address", "hours", "open", "close", "phone", "contact"
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'what is your address?' });
      const res = createResponse();

      await handler(req, res);

      expect(res.sentBody).toContain('⏳ Got it, processing');
    });
  });
});
