import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const { validateTwilioSignatureMock } = vi.hoisted(() => ({
  validateTwilioSignatureMock: vi.fn(() => true),
}));

vi.mock('../../../api/lib/twilio-signature.js', () => ({
  validateTwilioSignature: validateTwilioSignatureMock,
}));

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import handler from '../../../api/whatsapp';

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
    headers: {
      host: 'example.com',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'example.com',
      'x-twilio-signature': 'valid-signature',
    },
    body,
  } as unknown as VercelRequest;
}

function createResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    setHeader(name: string, value: string) {
      response.headers[name.toLowerCase()] = value;
      return response;
    },
    send(payload: string) {
      response.body = payload;
      return response;
    },
    json(payload: Record<string, unknown>) {
      response.body = JSON.stringify(payload);
      return response;
    },
    end() {
      return response;
    },
  };

  return response as unknown as VercelResponse & {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  };
}

function createSupabaseStub(args: { pendingOrder?: PendingOrder | null; orderNumber?: string }) {
  const pendingOrder = args.pendingOrder ?? null;
  const orderNumber = args.orderNumber ?? 'A-001';
  const updateSpy = vi.fn(() => ({
    eq: vi.fn(async () => ({ data: null, error: null })),
  }));

  const maybeSingleSpy = vi.fn(async () => ({ data: { pending_order: pendingOrder } }));
  const selectPending = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: maybeSingleSpy,
    })),
  }));

  const singleSpy = vi.fn(async () => ({ data: { order_number: orderNumber }, error: null }));
  const insertSpy = vi.fn(() => ({
    select: vi.fn(() => ({
      single: singleSpy,
    })),
  }));

  const fromSpy = vi.fn((table: string) => {
    if (table === 'conversation_history') {
      return {
        select: selectPending,
        update: updateSpy,
      };
    }
    if (table === 'orders') {
      return {
        insert: insertSpy,
      };
    }
    return {
      select: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    };
  });

  return {
    client: { from: fromSpy },
    spies: { fromSpy, updateSpy, insertSpy, maybeSingleSpy, singleSpy },
  };
}

describe('api/whatsapp button payload handling', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_AUTH_TOKEN = 'twilio-auth-token';
    process.env.SUPABASE_URL = 'https://supabase.example';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns expiration message when confirm button has no pending order', async () => {
    const stub = createSupabaseStub({ pendingOrder: null });
    createClientMock.mockReturnValue(stub.client);

    const req = createRequest({
      From: 'whatsapp:+40712345678',
      ButtonPayload: 'confirm',
      Body: '',
    });
    const res = createResponse();

    await handler(req, res);

    expect(validateTwilioSignatureMock).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/xml');
    expect(res.body).toContain('Comanda a expirat');
    expect(stub.spies.insertSpy).not.toHaveBeenCalled();
  });

  it('creates order and returns confirmation when confirm button has pending order', async () => {
    const pendingOrder: PendingOrder = {
      customer_name: 'Ion',
      customer_phone: '+40712345678',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.5 }],
      total_price: 7,
      pickup_time: '11:00',
    };
    const stub = createSupabaseStub({ pendingOrder, orderNumber: 'ORD-123' });
    createClientMock.mockReturnValue(stub.client);

    const req = createRequest({
      From: 'whatsapp:+40712345678',
      ButtonPayload: 'confirm',
      Body: '',
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/xml');
    expect(res.body).toContain('Comanda ORD-123 a fost înregistrată');
    expect(stub.spies.insertSpy).toHaveBeenCalledTimes(1);
    expect(stub.spies.updateSpy).toHaveBeenCalledTimes(1);
  });

  it('clears pending order and returns cancellation message for cancel button', async () => {
    const pendingOrder: PendingOrder = {
      customer_name: 'Ana',
      customer_phone: '+40712345678',
      items: [{ product_id: 'p2', name: 'Brânză', qty: 1, unit_price: 10 }],
      total_price: 10,
      pickup_time: null,
    };
    const stub = createSupabaseStub({ pendingOrder });
    createClientMock.mockReturnValue(stub.client);

    const req = createRequest({
      From: 'whatsapp:+40712345678',
      ButtonPayload: 'cancel',
      Body: '',
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/xml');
    expect(res.body).toContain('Comanda a fost anulată');
    expect(stub.spies.updateSpy).toHaveBeenCalledTimes(1);
    expect(stub.spies.insertSpy).not.toHaveBeenCalled();
  });
});
