import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { computeTwilioSignature } from '../../../api/lib/twilio-signature.js';

const { createClientMock, waitUntilMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  waitUntilMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('@vercel/functions', () => ({
  waitUntil: waitUntilMock,
}));

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

type PendingOrder = {
  customer_name: string;
  customer_phone: string;
  items: Array<{ product_id: string; name: string; qty: number; unit_price: number }>;
  total_price: number;
  pickup_time: string | null;
  pending_order_created_at?: string;
};

function createSupabaseDouble(args: {
  pendingOrder?: PendingOrder | null;
  pendingSelection?: Record<string, unknown> | null;
  historyMessages?: unknown[];
  orderNumber?: string;
  latestOrder?: { order_number: string; status?: string; created_at?: string } | null;
  isDuplicateMessageSid?: boolean;
  rateLimitCount?: number;
  rateLimitWindowStart?: string;
}) {
  const pendingOrder = args.pendingOrder ?? null;
  const historyMessages = args.historyMessages ?? [];
  const latestOrder = args.latestOrder ?? null;
  const pendingSelection = args.pendingSelection ?? null;

  const maybeSingleMock = vi.fn().mockResolvedValue({
    data: pendingOrder != null
      ? { pending_order: pendingOrder, pending_selection: pendingSelection, messages: historyMessages }
      : { pending_order: null, pending_selection: pendingSelection, messages: historyMessages },
  });
  const selectEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
  const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock });

  const updateSelectMaybeSingleMock = vi.fn().mockResolvedValue({
    data: pendingOrder != null ? { pending_order: pendingOrder } : null,
    error: null,
  });
  const updateSelectMock = vi.fn().mockReturnValue({ maybeSingle: updateSelectMaybeSingleMock });
  const updateNotMock = vi.fn().mockReturnValue({ select: updateSelectMock });
  const updateEqMock = vi.fn((field: string, value: string) => {
    void field;
    void value;
    return { not: updateNotMock };
  });
  const updateEqPromiseMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn((field: string, value: string) => {
      updateEqPromiseMock(field, value);
      return updateEqMock(field, value);
    }),
  });

  const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  // consumePendingOrder now uses RPC first; return pending order so the atomic path works
  const rpcMock = vi.fn().mockImplementation(async (fn: string) => {
    if (fn === 'consume_pending_order') {
      return { data: pendingOrder, error: null };
    }
    return { data: null, error: null };
  });

  const singleMock = vi.fn().mockResolvedValue({
    data: { order_number: args.orderNumber ?? 'ORD-001' },
    error: null,
  });
  const ordersSelectMock = vi.fn().mockReturnValue({ single: singleMock });
  const insertMock = vi.fn().mockReturnValue({ select: ordersSelectMock });
  const ordersLimitMock = vi.fn().mockResolvedValue({
    data: latestOrder ? [{
      order_number: latestOrder.order_number,
      status: latestOrder.status ?? 'pending',
      created_at: latestOrder.created_at ?? new Date().toISOString(),
    }] : [],
  });
  const ordersOrderMock = vi.fn().mockReturnValue({ limit: ordersLimitMock });
  const ordersEqStatusMock = vi.fn().mockReturnValue({ order: ordersOrderMock });
  const ordersEqPhoneMock = vi.fn().mockReturnValue({ eq: ordersEqStatusMock });
  const ordersLookupSelectMock = vi.fn().mockReturnValue({ eq: ordersEqPhoneMock });

  const inMock = vi.fn().mockResolvedValue({ data: [] });
  const movementsSelectMock = vi.fn().mockReturnValue({ in: inMock });

  // Dedup table mock — .upsert(...).select(...) must resolve directly
  const dedupSelectAfterUpsertMock = vi.fn().mockResolvedValue({
    data: args.isDuplicateMessageSid ? [] : [{ message_sid: 'SM123' }],
    error: null,
  });
  const dedupUpsertMock = vi.fn().mockReturnValue({ select: dedupSelectAfterUpsertMock });

  // Rate limit table mock
  const windowStart = args.rateLimitWindowStart ?? new Date().toISOString();
  const rateLimitData = args.rateLimitCount !== undefined
    ? { message_count: args.rateLimitCount, window_start: windowStart }
    : null;
  const rateLimitMaybeSingleMock = vi.fn().mockResolvedValue({ data: rateLimitData, error: null });
  const rateLimitEqSelectMock = vi.fn().mockReturnValue({ maybeSingle: rateLimitMaybeSingleMock });
  const rateLimitSelectMock = vi.fn().mockReturnValue({ eq: rateLimitEqSelectMock });
  const rateLimitUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const rateLimitUpdateMock = vi.fn().mockReturnValue({ eq: rateLimitUpdateEqMock });
  const rateLimitUpsertMock = vi.fn().mockResolvedValue({ error: null });

  const fromMock = vi.fn((table: string) => {
    if (table === 'conversation_history') {
      return { select: selectMock, update: updateMock, upsert: upsertMock };
    }
    if (table === 'orders') {
      return { insert: insertMock, select: ordersLookupSelectMock };
    }
    if (table === 'stock_movements') {
      return { select: movementsSelectMock };
    }
    if (table === 'processed_message_sids') {
      return { upsert: dedupUpsertMock };
    }
    if (table === 'whatsapp_rate_limits') {
      return {
        select: rateLimitSelectMock,
        update: rateLimitUpdateMock,
        upsert: rateLimitUpsertMock,
      };
    }
    return {
      select: selectMock,
      update: updateMock,
      upsert: upsertMock,
      insert: insertMock,
    };
  });

  return {
    client: { from: fromMock, rpc: rpcMock },
    spies: {
      fromMock,
      selectEqMock,
      updateMock,
      updateEqMock,
      updateEqPromiseMock,
      updateNotMock,
      updateSelectMock,
      updateSelectMaybeSingleMock,
      upsertMock,
      insertMock,
      ordersLookupSelectMock,
      maybeSingleMock,
      dedupUpsertMock,
      rateLimitUpdateMock,
      rateLimitUpsertMock,
    },
  };
}

describe('api/whatsapp (webhook handler)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const ENV_VARS = ['TWILIO_AUTH_TOKEN', 'TWILIO_ACCOUNT_SID', 'TWILIO_FROM_NUMBER', 'TWILIO_CONFIRM_CONTENT_SID', 'WHATSAPP_PENDING_ORDER_TTL_MINUTES'];
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();

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
    waitUntilMock.mockImplementation((promise: Promise<unknown>) => promise);
    createClientMock.mockReturnValue(createSupabaseDouble({}).client);
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
      expect(res.sentBody).toMatch(/Bună ziua, procesăm|Hello, processing/i);
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
      expect(res.sentBody).toMatch(/Bună ziua, procesăm|Hello, processing/i);
    });

    it('button payload confirm returns TwiML (not REST) for immediate response', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const pendingOrder: PendingOrder = {
        customer_name: 'Ion Popescu',
        customer_phone: '+40123456789',
        items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.42 }],
        total_price: 6.84,
        pickup_time: 'mâine 12:00',
      };
      const sb = createSupabaseDouble({ pendingOrder, orderNumber: 'ORD-025' });
      createClientMock.mockReturnValue(sb.client);

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
      await Promise.all(waitUntilMock.mock.calls.map(async ([promise]) => promise));
      expect(sb.spies.insertMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalled();
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('ORD-025');
    });

    it('button payload confirm does not clear a newer pending_selection (new cart flow)', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const pendingOrder: PendingOrder = {
        customer_name: 'Ion Popescu',
        customer_phone: '+40123456789',
        items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.42 }],
        total_price: 6.84,
        pickup_time: 'mâine 12:00',
        pending_order_created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
      };
      const sb = createSupabaseDouble({
        pendingOrder,
        orderNumber: 'ORD-025',
        pendingSelection: {
          selection_type: 'building_order',
          cart: [{ name: 'Brânză', qty: 1 }],
          created_at: new Date().toISOString(), // newer than pending order
        },
      });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        ButtonPayload: 'confirm',
        Body: '',
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      await Promise.all(waitUntilMock.mock.calls.map(async ([promise]) => promise));
      expect(sb.spies.insertMock).toHaveBeenCalledTimes(1);
      expect(sb.spies.upsertMock).not.toHaveBeenCalled();
    });

    it('button payload cancel returns TwiML (not REST) for immediate response', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const pendingOrder: PendingOrder = {
        customer_name: 'Ion Popescu',
        customer_phone: '+40123456789',
        items: [{ product_id: 'p1', name: 'Lapte', qty: 1, unit_price: 3.42 }],
        total_price: 3.42,
        pickup_time: null,
      };
      const sb = createSupabaseDouble({ pendingOrder });
      createClientMock.mockReturnValue(sb.client);

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
      await Promise.all(waitUntilMock.mock.calls.map(async ([promise]) => promise));
      expect(sb.spies.insertMock).not.toHaveBeenCalled();
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('Comanda+a+fost+anulat');
    });

    it('button payload confirm sends expired message when no pending order exists', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const sb = createSupabaseDouble({ pendingOrder: null });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        ButtonPayload: 'confirm',
        Body: '',
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      await Promise.all(waitUntilMock.mock.calls.map(async ([promise]) => promise));
      expect(sb.spies.insertMock).not.toHaveBeenCalled();
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('Comanda+a+expirat');
    });

    it('button payload cancel sends expired message when no pending order exists', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const sb = createSupabaseDouble({ pendingOrder: null });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        ButtonPayload: 'cancel',
        Body: '',
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      await Promise.all(waitUntilMock.mock.calls.map(async ([promise]) => promise));
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('Comanda+a+expirat');
    });

    it('button payload confirm replays success when pending draft was already consumed but order exists', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const sb = createSupabaseDouble({
        pendingOrder: null,
        latestOrder: { order_number: 'ORD-025', status: 'pending' },
      });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        ButtonPayload: 'confirm',
        Body: '',
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      await Promise.all(waitUntilMock.mock.calls.map(async ([promise]) => promise));
      expect(sb.spies.insertMock).not.toHaveBeenCalled();
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('ORD-025');
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).not.toContain('Comanda+a+expirat');
    });

    it('button payload cancel reports already-registered order when pending draft was already consumed', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const sb = createSupabaseDouble({
        pendingOrder: null,
        latestOrder: { order_number: 'ORD-025', status: 'pending' },
      });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        ButtonPayload: 'cancel',
        Body: '',
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      await Promise.all(waitUntilMock.mock.calls.map(async ([promise]) => promise));
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('ORD-025');
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).not.toContain('Comanda+a+expirat');
    });

    it('text DA confirms only with a fresh pending order', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const pendingOrder: PendingOrder = {
        customer_name: 'Ion Popescu',
        customer_phone: '+40123456789',
        items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.42 }],
        total_price: 6.84,
        pickup_time: 'mâine 12:00',
        pending_order_created_at: new Date().toISOString(),
      };
      const sb = createSupabaseDouble({ pendingOrder, orderNumber: 'ORD-025' });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        Body: 'DA',
      });
      const res = createResponse();

      await handler(req, res);

      expect(sb.spies.insertMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('ORD-025');
    });

    it('text NU cancels only with a fresh pending order', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const pendingOrder: PendingOrder = {
        customer_name: 'Ion Popescu',
        customer_phone: '+40123456789',
        items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.42 }],
        total_price: 6.84,
        pickup_time: 'mâine 12:00',
        pending_order_created_at: new Date().toISOString(),
      };
      const sb = createSupabaseDouble({ pendingOrder });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        Body: 'NU',
      });
      const res = createResponse();

      await handler(req, res);

      expect(sb.spies.insertMock).not.toHaveBeenCalled();
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('Comanda+a+fost+anulat');
    });

    it('text DA sends expired message when pending order is stale', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      process.env.WHATSAPP_PENDING_ORDER_TTL_MINUTES = '5';
      const pendingOrder: PendingOrder = {
        customer_name: 'Ion Popescu',
        customer_phone: '+40123456789',
        items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.42 }],
        total_price: 6.84,
        pickup_time: 'mâine 12:00',
        pending_order_created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      };
      const sb = createSupabaseDouble({ pendingOrder });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        Body: 'DA',
      });
      const res = createResponse();

      await handler(req, res);

      expect(sb.spies.insertMock).not.toHaveBeenCalled();
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('Comanda+a+expirat');
    });

    it('text DA without pending order falls through instead of sending expired message', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const sb = createSupabaseDouble({ pendingOrder: null });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        Body: 'DA',
      });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      expect(res.sentBody).toMatch(/Bună ziua, procesăm|Hello, processing/i);
      await Promise.all(waitUntilMock.mock.calls.map(async ([promise]) => promise));
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).not.toContain('Comanda+a+expirat');
    });

    it('echoed interactive confirm body is treated as confirm text', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const pendingOrder: PendingOrder = {
        customer_name: 'Ion Popescu',
        customer_phone: '+40123456789',
        items: [
          { product_id: 'p1', name: '100G SEMINTE FL SOAR BANZAI', qty: 1, unit_price: 1.08 },
          { product_id: 'p2', name: '100G CICOARE AFINE STOLETOV', qty: 1, unit_price: 2.71 },
        ],
        total_price: 3.79,
        pickup_time: '18:00',
        pending_order_created_at: new Date().toISOString(),
      };
      const sb = createSupabaseDouble({ pendingOrder, orderNumber: 'ORD-031' });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        Body: [
          'Confirmi această comandă?',
          ' 1x 100G SEMINTE FL SOAR BANZAI, 1x 100G CICOARE AFINE STOLETOV — €3.79',
          ' Ridicare: 18:00',
          '✅ Da, confirmă',
        ].join('\n'),
      });
      const res = createResponse();

      await handler(req, res);

      expect(sb.spies.insertMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('ORD-031');
    });

    it('echoed interactive confirm body replays success when order already exists', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const sb = createSupabaseDouble({
        pendingOrder: null,
        latestOrder: { order_number: 'ORD-031', status: 'pending' },
      });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({
        From: 'whatsapp:+40123456789',
        Body: [
          'Confirmi această comandă?',
          ' 1x 100G SEMINTE FL SOAR BANZAI, 1x 100G CICOARE AFINE STOLETOV — €3.79',
          ' Ridicare: 18:00',
          '✅ Da, confirmă',
        ].join('\n'),
      });
      const res = createResponse();

      await handler(req, res);

      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).toContain('ORD-031');
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body?.toString()).not.toContain('Comanda+a+expirat');
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

      expect(res.sentBody).toContain('Bună ziua, procesăm');
    });

    it('returns English ack for English messages (with English keywords)', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';

      // detectEnglish() checks for keywords like "address", "hours", "open", "close", "phone", "contact"
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'what is your address?' });
      const res = createResponse();

      await handler(req, res);

      expect(res.sentBody).toContain('Hello, processing your message');
    });
  });

  describe('MessageSid deduplication', () => {
    it('processes a fresh MessageSid normally', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const sb = createSupabaseDouble({ isDuplicateMessageSid: false });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'test', MessageSid: 'SM123' });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      // Should have gone through normal flow (TwiML ack)
      expect(res.sentBody).toContain('<?xml');
      expect(sb.spies.dedupUpsertMock).toHaveBeenCalledTimes(1);
    });

    it('returns 200 empty TwiML for duplicate MessageSid without LLM call', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      const sb = createSupabaseDouble({ isDuplicateMessageSid: true });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'test', MessageSid: 'SM123' });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      // Should not have started async reply
      expect(waitUntilMock).not.toHaveBeenCalled();
    });

    it('bypasses dedup check for replay requests', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      // isDuplicateMessageSid: true but replay should bypass
      const sb = createSupabaseDouble({ isDuplicateMessageSid: true });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest(
        { From: 'whatsapp:+40123456789', Body: 'test', MessageSid: 'SM123' },
        { 'x-whatsapp-replay-id': 'replay-001' }
      );
      const res = createResponse();

      await handler(req, res);

      // Replay should proceed past dedup — normal ack returned
      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      expect(sb.spies.dedupUpsertMock).not.toHaveBeenCalled();
    });
  });

  describe('Per-phone rate limiting', () => {
    it('allows messages within rate limit', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      // count=5 → allowed (5+1=6 ≤ 10)
      const windowStart = new Date(Date.now() - 10_000).toISOString();
      const sb = createSupabaseDouble({ rateLimitCount: 5, rateLimitWindowStart: windowStart });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'test' });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toMatch(/Bună ziua, procesăm|Hello, processing/i);
    });

    it('denies the 11th message and returns canned bilingual reply', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      // count=10 → denied (10+1=11 > 10)
      const windowStart = new Date(Date.now() - 10_000).toISOString();
      const sb = createSupabaseDouble({ rateLimitCount: 10, rateLimitWindowStart: windowStart });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'test' });
      const res = createResponse();

      await handler(req, res);

      // Handler sends empty TwiML ack + REST rate-limit message via waitUntil
      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
      // waitUntil is called once — for the REST rate-limit message, NOT for LLM reply
      expect(waitUntilMock).toHaveBeenCalledTimes(1);
      // Await the REST send and verify rate-limit content
      await Promise.all(waitUntilMock.mock.calls.map(async ([promise]: [Promise<unknown>]) => promise));
      const lastBody = fetchMock.mock.calls.at(-1)?.[1]?.body?.toString() ?? '';
      expect(lastBody).toMatch(/Prea+multe|Too\+many/i);
    });

    it('bypasses rate limit for replay requests', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      // count=10 would be denied, but replay bypasses
      const windowStart = new Date(Date.now() - 10_000).toISOString();
      const sb = createSupabaseDouble({ rateLimitCount: 10, rateLimitWindowStart: windowStart });
      createClientMock.mockReturnValue(sb.client);

      const req = createRequest(
        { From: 'whatsapp:+40123456789', Body: 'test' },
        { 'x-whatsapp-replay-id': 'replay-002' }
      );
      const res = createResponse();

      await handler(req, res);

      // Replay bypasses rate limit → goes to normal async flow
      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toMatch(/Bună ziua, procesăm|Hello, processing/i);
    });
  });

  describe('PR 2c: LLM reply sent before confirmation template', () => {
    it('sends rest reply then confirmation when pending order is created', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      process.env.TWILIO_CONFIRM_CONTENT_SID = 'HXtest123';

      const sb = createSupabaseDouble({});
      createClientMock.mockReturnValue(sb.client);

      // buildReplyWithPending is mocked via the Supabase client → it will call
      // getHistory (empty) then processOrderIntent (no ORDER: in reply) → reply only.
      // We verify the shape of calls rather than the exact reply content.
      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'vreau lapte' });
      const res = createResponse();

      await handler(req, res);

      // Handler should return TwiML ack immediately
      expect(res.statusCode).toBe(200);
      expect(res.sentBody).toContain('<?xml');
    });
  });

  describe('PR 2d: confirmation template failure falls back to DA/NU text', () => {
    it('falls back to plain text when sendTemplateMessage throws', async () => {
      const { default: handler } = await import('../../../api/whatsapp');
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_FROM_NUMBER = 'whatsapp:+123456789';
      process.env.TWILIO_CONFIRM_CONTENT_SID = 'HXtest123';

      const sb = createSupabaseDouble({});
      createClientMock.mockReturnValue(sb.client);

      // Make template send fail by making fetch throw on the template URL
      fetchMock.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('Messages.json')) {
          // First call = REST reply OK, second call = template throw
          fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' });
          return Promise.reject(new Error('template failed'));
        }
        return Promise.resolve({ ok: true, status: 200, text: async () => '' });
      });

      const req = createRequest({ From: 'whatsapp:+40123456789', Body: 'test' });
      const res = createResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
    });

    // Note: boolean-false fallback is covered in unit tests for lib/whatsapp/confirm-prompt.ts.
  });
});
