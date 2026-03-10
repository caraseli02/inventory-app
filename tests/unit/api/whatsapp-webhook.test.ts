import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const { createClientMock, validateTwilioSignatureMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  validateTwilioSignatureMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('../../../api/lib/twilio-signature.js', () => ({
  validateTwilioSignature: validateTwilioSignatureMock,
}));

import handler from '../../../api/whatsapp';

type JsonValue = Record<string, unknown> | null;

type PendingOrder = {
  customer_name: string;
  customer_phone: string;
  items: Array<{ product_id: string; name: string; qty: number; unit_price: number }>;
  total_price: number;
  pickup_time: string | null;
};

function createRequest(body: Record<string, unknown>): VercelRequest {
  return {
    method: 'POST',
    url: '/api/whatsapp',
    body,
    headers: {
      host: 'example.com',
      'x-forwarded-proto': 'https',
      'x-twilio-signature': 'valid-signature',
    },
  } as unknown as VercelRequest;
}

function createResponse() {
  const headers: Record<string, string> = {};

  const response = {
    statusCode: 200,
    jsonBody: null as JsonValue,
    sentBody: '' as string,
    ended: false,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
      return response;
    },
    send(payload: unknown) {
      response.sentBody = String(payload ?? '');
      return response;
    },
    json(payload: Record<string, unknown>) {
      response.jsonBody = payload;
      return response;
    },
    end() {
      response.ended = true;
      return response;
    },
    getHeader(name: string) {
      return headers[name];
    },
  };

  return response as unknown as VercelResponse & {
    statusCode: number;
    sentBody: string;
    jsonBody: JsonValue;
    ended: boolean;
    getHeader(name: string): string | undefined;
  };
}

function createSupabaseDouble(args: { pendingOrder: PendingOrder | null; orderNumber?: string }) {
  const maybeSingleMock = vi.fn().mockResolvedValue({
    data: args.pendingOrder ? { pending_order: args.pendingOrder } : { pending_order: null },
  });
  const historySelectEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
  const historySelectMock = vi.fn().mockReturnValue({ eq: historySelectEqMock });

  const historyUpdateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const historyUpdateMock = vi.fn().mockReturnValue({ eq: historyUpdateEqMock });

  const ordersSingleMock = vi.fn().mockResolvedValue({
    data: { order_number: args.orderNumber ?? 'ORD-001' },
  });
  const ordersSelectMock = vi.fn().mockReturnValue({ single: ordersSingleMock });
  const ordersInsertMock = vi.fn().mockReturnValue({ select: ordersSelectMock });

  const fromMock = vi.fn((table: string) => {
    if (table === 'conversation_history') {
      return {
        select: historySelectMock,
        update: historyUpdateMock,
      };
    }

    if (table === 'orders') {
      return {
        insert: ordersInsertMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: {
      from: fromMock,
    },
    spies: {
      fromMock,
      historySelectEqMock,
      historyUpdateMock,
      historyUpdateEqMock,
      ordersInsertMock,
    },
  };
}

describe('api/whatsapp quick reply buttons', () => {
  const originalTwilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    validateTwilioSignatureMock.mockReturnValue(true);
  });

  afterEach(() => {
    if (originalTwilioAuthToken === undefined) {
      delete process.env.TWILIO_AUTH_TOKEN;
    } else {
      process.env.TWILIO_AUTH_TOKEN = originalTwilioAuthToken;
    }

    if (originalSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalSupabaseAnonKey === undefined) {
      delete process.env.SUPABASE_ANON_KEY;
    } else {
      process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
  });

  it('confirms a pending order and inserts it as confirmed', async () => {
    const pendingOrder: PendingOrder = {
      customer_name: 'Ion Popescu',
      customer_phone: '+40711111111',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.42 }],
      total_price: 6.84,
      pickup_time: 'mâine 12:00',
    };

    const sb = createSupabaseDouble({ pendingOrder, orderNumber: 'ORD-025' });
    createClientMock.mockReturnValue(sb.client);

    const req = createRequest({
      From: 'whatsapp:+40711111111',
      ButtonPayload: 'confirm',
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.getHeader('Content-Type')).toBe('text/xml');
    expect(res.sentBody).toContain('✅ Comanda ORD-025 a fost înregistrată! Te așteptăm.');

    expect(sb.spies.historySelectEqMock).toHaveBeenCalledWith('phone_number', '+40711111111');
    expect(sb.spies.historyUpdateMock).toHaveBeenCalledWith({ pending_order: null });
    expect(sb.spies.historyUpdateEqMock).toHaveBeenCalledWith('phone_number', '+40711111111');
    expect(sb.spies.ordersInsertMock).toHaveBeenCalledWith({
      customer_name: 'Ion Popescu',
      customer_phone: '+40711111111',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.42 }],
      total_price: 6.84,
      pickup_time: 'mâine 12:00',
      status: 'confirmed',
    });
  });

  it('cancels a pending order without inserting a new order', async () => {
    const pendingOrder: PendingOrder = {
      customer_name: 'Ion Popescu',
      customer_phone: '+40711111111',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 1, unit_price: 3.42 }],
      total_price: 3.42,
      pickup_time: null,
    };

    const sb = createSupabaseDouble({ pendingOrder });
    createClientMock.mockReturnValue(sb.client);

    const req = createRequest({
      From: 'whatsapp:+40711111111',
      ButtonPayload: 'cancel',
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.getHeader('Content-Type')).toBe('text/xml');
    expect(res.sentBody).toContain('❌ Comanda a fost anulată.');

    expect(sb.spies.historySelectEqMock).toHaveBeenCalledWith('phone_number', '+40711111111');
    expect(sb.spies.historyUpdateMock).toHaveBeenCalledWith({ pending_order: null });
    expect(sb.spies.ordersInsertMock).not.toHaveBeenCalled();
  });
});
