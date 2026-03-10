import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const {
  getUserMock,
  singleMock,
  maybeSingleMock,
  createClientMock,
} = vi.hoisted(() => {
  const getUser = vi.fn();
  const single = vi.fn();
  const maybeSingle = vi.fn();
  const createClient = vi.fn(() => ({
    auth: { getUser },
    from: (table: string) => ({
      select: () => {
        if (table === 'orders') {
          return {
            eq: () => ({
              single,
            }),
          };
        }

        return {
          eq: () => ({
            maybeSingle,
          }),
        };
      },
    }),
  }));

  return {
    getUserMock: getUser,
    singleMock: single,
    maybeSingleMock: maybeSingle,
    createClientMock: createClient,
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import handler from '../../../api/whatsapp-notify';

function createRequest(args: {
  method?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}): VercelRequest {
  return {
    method: args.method ?? 'POST',
    body: args.body ?? {},
    headers: args.headers ?? {},
  } as unknown as VercelRequest;
}

function createResponse() {
  const response = {
    statusCode: 200,
    jsonBody: null as Record<string, unknown> | null,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(payload: Record<string, unknown>) {
      response.jsonBody = payload;
      return response;
    },
    end() {
      return response;
    },
  };

  return response as unknown as VercelResponse & {
    statusCode: number;
    jsonBody: Record<string, unknown> | null;
  };
}

describe('api/whatsapp-notify', () => {
  const ENV_VARS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  let savedEnv: Record<string, string | undefined> = {};
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_VARS.map((key) => [key, process.env[key]]));
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_FROM_NUMBER = '+123456789';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';

    getUserMock.mockReset();
    singleMock.mockReset();
    maybeSingleMock.mockReset();
    createClientMock.mockClear();

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    vi.unstubAllGlobals();
  });

  it('rejects missing bearer tokens', async () => {
    const req = createRequest({
      body: { orderId: 'order-1', action: 'confirm' },
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Unauthorized' });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('rejects invalid bearer tokens before touching Twilio', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });

    const req = createRequest({
      body: { orderId: 'order-1', action: 'confirm' },
      headers: { authorization: 'Bearer not-valid' },
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Unauthorized' });
    expect(singleMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a WhatsApp message for valid bearer tokens', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    singleMock.mockResolvedValue({
      data: {
        order_number: 'ORD-123',
        customer_phone: '+40123456789',
        total_price: 12.5,
        pickup_time: 'mâine 12:00',
      },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: {
        messages: [{ role: 'user', content: 'Привет' }],
      },
    });

    const req = createRequest({
      body: { orderId: 'order-1', action: 'confirm' },
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true, order_number: 'ORD-123' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
