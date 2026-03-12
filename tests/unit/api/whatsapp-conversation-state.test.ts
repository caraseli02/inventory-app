import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationMessage, PendingOrder } from '../../../lib/whatsapp/types';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import {
  appendHistory,
  clearPendingOrder,
  consumePendingOrder,
  getHistory,
  hasConversationHistory,
  peekPendingOrder,
  resetConversationHistory,
  storePendingOrder,
} from '../../../lib/whatsapp/conversation-state';

function createConversationStateDouble(args: {
  selectData?: Record<string, unknown> | null;
  rpcError?: unknown;
}) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: args.selectData ?? null, error: null });
  const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

  const updateSelectMaybeSingleMock = vi.fn().mockResolvedValue({ data: args.selectData ?? null, error: null });
  const updateSelectMock = vi.fn().mockReturnValue({ maybeSingle: updateSelectMaybeSingleMock });
  const updateNotMock = vi.fn().mockReturnValue({ select: updateSelectMock });
  const updateEqPromiseMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn((field: string, value: string) => {
      updateEqPromiseMock(field, value);
      return { not: updateNotMock };
    }),
  });

  const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });

  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const rpcMock = vi.fn().mockImplementation(async () => {
    if (args.rpcError) throw args.rpcError;
    return { data: null, error: null };
  });

  return {
    client: {
      from: vi.fn(() => ({
        select: selectMock,
        update: updateMock,
        delete: deleteMock,
        upsert: upsertMock,
      })),
      rpc: rpcMock,
    },
    spies: {
      selectMock,
      eqMock,
      maybeSingleMock,
      updateMock,
      updateEqPromiseMock,
      updateNotMock,
      updateSelectMock,
      updateSelectMaybeSingleMock,
      deleteMock,
      deleteEqMock,
      upsertMock,
      rpcMock,
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.CONVERSATION_TTL_DAYS;
  delete process.env.WHATSAPP_PENDING_ORDER_TTL_MINUTES;
});

describe('api/whatsapp/conversation-state', () => {
  it('reports stored history without applying TTL rules', async () => {
    const sb = createConversationStateDouble({
      selectData: { messages: [{ role: 'user', content: 'hello', timestamp: 't1' }] },
    }).client as never;

    await expect(hasConversationHistory(sb, '+40123')).resolves.toBe(true);
  });

  it('returns false when history lookup fails', async () => {
    const sb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              throw new Error('boom');
            },
          }),
        }),
      }),
    } as never;

    await expect(hasConversationHistory(sb, '+40123')).resolves.toBe(false);
  });

  it('stores pending orders in conversation_history', async () => {
    const pendingOrder: PendingOrder = {
      customer_name: 'Ion',
      customer_phone: '+40123',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.42 }],
      total_price: 6.84,
      pickup_time: 'mâine 12:00',
    };
    const sb = createConversationStateDouble({}).client as never;
    const upsertSpy = (sb.from('conversation_history') as { upsert: ReturnType<typeof vi.fn> }).upsert;

    await storePendingOrder(sb, '+40123', pendingOrder);

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        phone_number: '+40123',
        pending_order: expect.objectContaining(pendingOrder),
      }),
      { onConflict: 'phone_number' }
    );
    expect(upsertSpy.mock.calls[0]?.[0]).toMatchObject({
      pending_order: {
        pending_order_created_at: expect.any(String),
      },
    });
  });

  it('peeks pending orders without clearing them', async () => {
    const pendingOrder: PendingOrder = {
      customer_name: 'Ion',
      customer_phone: '+40123',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 1, unit_price: 3.42 }],
      total_price: 3.42,
      pickup_time: null,
      pending_order_created_at: new Date().toISOString(),
    };
    const state = createConversationStateDouble({ selectData: { pending_order: pendingOrder } });
    const sb = state.client as never;

    await expect(peekPendingOrder(sb, '+40123')).resolves.toEqual(pendingOrder);
    expect(state.spies.updateMock).not.toHaveBeenCalled();
  });

  it('consumes pending orders only when explicitly requested', async () => {
    const pendingOrder: PendingOrder = {
      customer_name: 'Ion',
      customer_phone: '+40123',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 1, unit_price: 3.42 }],
      total_price: 3.42,
      pickup_time: null,
      pending_order_created_at: new Date().toISOString(),
    };
    const state = createConversationStateDouble({ selectData: { pending_order: pendingOrder } });
    const sb = state.client as never;

    await expect(consumePendingOrder(sb, '+40123')).resolves.toEqual({ status: 'fresh', order: pendingOrder });
    expect(state.spies.updateMock).toHaveBeenCalledWith({ pending_order: null });
    expect(state.spies.updateEqPromiseMock).toHaveBeenCalledWith('phone_number', '+40123');
    expect(state.spies.updateNotMock).toHaveBeenCalledWith('pending_order', 'is', null);
    expect(state.spies.updateSelectMock).toHaveBeenCalledWith('pending_order');
  });

  it('clears expired pending orders before returning them', async () => {
    process.env.WHATSAPP_PENDING_ORDER_TTL_MINUTES = '5';
    const pendingOrder: PendingOrder = {
      customer_name: 'Ion',
      customer_phone: '+40123',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 1, unit_price: 3.42 }],
      total_price: 3.42,
      pickup_time: null,
      pending_order_created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };
    const state = createConversationStateDouble({ selectData: { pending_order: pendingOrder } });
    const sb = state.client as never;

    await expect(peekPendingOrder(sb, '+40123')).resolves.toBeNull();
    expect(state.spies.updateMock).toHaveBeenCalledWith({ pending_order: null });
    expect(state.spies.updateEqPromiseMock).toHaveBeenCalledWith('phone_number', '+40123');
  });

  it('returns the latest 20 messages when history is fresh', async () => {
    const messages = Array.from({ length: 25 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `m${index + 1}`,
      timestamp: `t${index + 1}`,
    })) as ConversationMessage[];
    const sb = createConversationStateDouble({
      selectData: {
        messages,
        updated_at: new Date().toISOString(),
      },
    }).client as never;

    const history = await getHistory(sb, '+40123');

    expect(history).toHaveLength(20);
    expect(history[0]?.content).toBe('m6');
    expect(history.at(-1)?.content).toBe('m25');
  });

  it('drops expired history based on conversation TTL', async () => {
    process.env.CONVERSATION_TTL_DAYS = '1';
    const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const sb = createConversationStateDouble({
      selectData: {
        messages: [{ role: 'user', content: 'old', timestamp: 't1' }],
        updated_at: oldDate,
      },
    }).client as never;

    await expect(getHistory(sb, '+40123')).resolves.toEqual([]);
  });

  it('uses RPC append first and skips fallback upsert when RPC succeeds', async () => {
    const state = createConversationStateDouble({});
    const sb = state.client as never;

    await appendHistory(
      sb,
      '+40123',
      [{ role: 'user', content: 'old', timestamp: 't1' }],
      [{ role: 'assistant', content: 'new', timestamp: 't2' }]
    );

    expect(state.spies.rpcMock).toHaveBeenCalledWith('append_conversation_history', {
      p_phone_number: '+40123',
      p_messages: [{ role: 'assistant', content: 'new', timestamp: 't2' }],
    });
    expect(state.spies.upsertMock).not.toHaveBeenCalled();
  });

  it('falls back to upsert when RPC append throws', async () => {
    const state = createConversationStateDouble({ rpcError: new Error('rpc failed') });
    const sb = state.client as never;

    await appendHistory(
      sb,
      '+40123',
      [{ role: 'user', content: 'm1', timestamp: 't1' }],
      [{ role: 'assistant', content: 'm2', timestamp: 't2' }]
    );

    expect(state.spies.upsertMock).toHaveBeenCalledWith(
      {
        phone_number: '+40123',
        messages: [
          { role: 'user', content: 'm1', timestamp: 't1' },
          { role: 'assistant', content: 'm2', timestamp: 't2' },
        ],
      },
      { onConflict: 'phone_number' }
    );
  });

  it('creates a fresh client when resetting conversation history', async () => {
    const state = createConversationStateDouble({});
    createClientMock.mockReturnValue(state.client);

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';

    await resetConversationHistory('+40123');

    expect(createClientMock).toHaveBeenCalledOnce();
    expect(state.spies.deleteEqMock).toHaveBeenCalledWith('phone_number', '+40123');
  });

  it('clears pending orders explicitly', async () => {
    const state = createConversationStateDouble({});
    const sb = state.client as never;

    await clearPendingOrder(sb, '+40123');

    expect(state.spies.updateMock).toHaveBeenCalledWith({ pending_order: null });
    expect(state.spies.updateEqPromiseMock).toHaveBeenCalledWith('phone_number', '+40123');
  });
});
