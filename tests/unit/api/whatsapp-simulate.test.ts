import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const {
  buildLocalSimulationReplyMock,
  buildSimulatorReplyMock,
  resetConversationHistoryMock,
} = vi.hoisted(() => ({
  buildLocalSimulationReplyMock: vi.fn(),
  buildSimulatorReplyMock: vi.fn(),
  resetConversationHistoryMock: vi.fn(),
}));

vi.mock('../../../lib/whatsapp/simulator.js', () => ({
  buildLocalSimulationReply: buildLocalSimulationReplyMock,
  buildSimulatorReply: buildSimulatorReplyMock,
}));

vi.mock('../../../lib/whatsapp/conversation-state.js', () => ({
  resetConversationHistory: resetConversationHistoryMock,
}));

import handler from '../../../api/whatsapp-simulate';

type JsonValue = Record<string, unknown> | null;

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
    jsonBody: null as JsonValue,
    ended: false,
    status(code: number) {
      response.statusCode = code;
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
  };

  return response as unknown as VercelResponse & {
    statusCode: number;
    jsonBody: JsonValue;
    ended: boolean;
  };
}

describe('api/whatsapp-simulate', () => {
  const originalSecret = process.env.WHATSAPP_SIMULATOR_SECRET;
  const originalNotifySecret = process.env.VITE_NOTIFY_SECRET;
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WHATSAPP_SIMULATOR_SECRET;
    delete process.env.VITE_NOTIFY_SECRET;
    delete process.env.VERCEL;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.WHATSAPP_SIMULATOR_SECRET;
    else process.env.WHATSAPP_SIMULATOR_SECRET = originalSecret;

    if (originalNotifySecret === undefined) delete process.env.VITE_NOTIFY_SECRET;
    else process.env.VITE_NOTIFY_SECRET = originalNotifySecret;

    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it('returns 404 on Vercel because the simulator is local-only', async () => {
    process.env.VERCEL = '1';

    const req = createRequest({
      body: { text: 'hello' },
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.jsonBody).toEqual({ error: 'Not Found' });
    expect(buildSimulatorReplyMock).not.toHaveBeenCalled();
  });

  it('rejects requests with the wrong simulator secret', async () => {
    process.env.WHATSAPP_SIMULATOR_SECRET = 'expected-secret';

    const req = createRequest({
      body: { text: 'hello' },
      headers: { 'x-notify-secret': 'wrong-secret' },
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Unauthorized' });
    expect(buildSimulatorReplyMock).not.toHaveBeenCalled();
  });

  it('normalizes the phone and resets history when reset is true', async () => {
    const req = createRequest({
      body: { phone: '40712345678', reset: true },
    });
    const res = createResponse();

    await handler(req, res);

    expect(resetConversationHistoryMock).toHaveBeenCalledWith('+40712345678');
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true });
  });

  it('uses the local simulator flow in direct mode', async () => {
    buildLocalSimulationReplyMock.mockResolvedValue('local reply');

    const req = createRequest({
      body: {
        phone: '40712345678',
        name: ' Test User ',
        text: 'ORDER:{}',
        mode: 'direct',
      },
    });
    const res = createResponse();

    await handler(req, res);

    expect(buildLocalSimulationReplyMock).toHaveBeenCalledWith('+40712345678', 'Test User', 'ORDER:{}');
    expect(buildSimulatorReplyMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true, reply: 'local reply', provider: 'local' });
  });

  it('passes through debug data in agent mode only when requested', async () => {
    buildSimulatorReplyMock.mockResolvedValue({
      reply: 'agent reply',
      provider: 'openai',
      transaction: { status: 'reply' },
      debug: { intent: 'product_query', repairedOrder: false },
    });

    const req = createRequest({
      body: {
        text: 'aveti lapte?',
        debug: true,
      },
    });
    const res = createResponse();

    await handler(req, res);

    expect(buildSimulatorReplyMock).toHaveBeenCalledWith('+40000000000', 'Simulator', 'aveti lapte?');
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      ok: true,
      reply: 'agent reply',
      provider: 'openai',
      transaction: { status: 'reply' },
      debug: { intent: 'product_query', repairedOrder: false },
    });
  });

  it('returns 400 when text is missing outside reset mode', async () => {
    const req = createRequest({
      body: { text: '   ' },
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'text is required' });
  });

  it('returns 500 when the simulator flow throws', async () => {
    buildSimulatorReplyMock.mockRejectedValue(new Error('boom'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const req = createRequest({
      body: { text: 'aveti cafea?' },
    });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual({ ok: false, error: 'Simulation failed' });

    errorSpy.mockRestore();
  });
});
