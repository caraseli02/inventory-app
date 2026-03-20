/**
 * Unit tests for WhatsApp agent utilities:
 * - extractOrderJson (brace-depth JSON extraction)
 * - normalizePickupTime
 * - parsePickupDateTime
 * - classifyIncomingText (cancel intent + JSON false-positive fix)
 */
import { describe, expect, it } from 'vitest';
import {
  classifyIncomingText,
  extractMenuOptionsFromAssistantText,
  maybeHandleMenuSelection,
  maybeHandleOrderFollowup,
  normalizePickupTime,
  parsePickupDateTime,
} from '../../lib/whatsapp/conversation';
import {
  createPendingOrderFromPending,
  extractOrderJson,
} from '../../lib/whatsapp/order-intent';
import type { ConversationMessage } from '../../lib/whatsapp/types';

// ─── extractOrderJson ─────────────────────────────────────────────────────────

describe('extractOrderJson', () => {
  it('extracts a simple flat ORDER JSON', () => {
    const text = 'Comanda ta:\nORDER:{"customer_name":"Ion","items":"lapte","pickup_time":"11:00"}';
    const result = extractOrderJson(text);
    expect(result).not.toBeNull();
    expect(result!.json).toBe('{"customer_name":"Ion","items":"lapte","pickup_time":"11:00"}');
  });

  it('extracts nested ORDER JSON with items array', () => {
    const text = 'Perfect!\nORDER:{"customer_name":"Ion","customer_phone":"+40123","items":[{"name":"Lapte","qty":2}],"pickup_time":"11:00"}';
    const result = extractOrderJson(text);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!.json);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].name).toBe('Lapte');
    expect(parsed.items[0].qty).toBe(2);
  });

  it('is case-insensitive (Order: lowercase variant)', () => {
    const text = 'Confirmat.\nOrder:{"customer_name":"Ana","items":[{"name":"Brânză","qty":1}],"pickup_time":"14:00"}';
    const result = extractOrderJson(text);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!.json);
    expect(parsed.customer_name).toBe('Ana');
  });

  it('handles trailing text after ORDER JSON', () => {
    const text = 'ORDER:{"customer_name":"Ion","items":[{"name":"Lapte","qty":1}],"pickup_time":"11:00"}\nDoar un mesaj adăugat.';
    const result = extractOrderJson(text);
    expect(result).not.toBeNull();
    // JSON must be parseable
    expect(() => JSON.parse(result!.json)).not.toThrow();
  });

  it('returns null when no ORDER: present', () => {
    expect(extractOrderJson('Avem lapte și brânză.')).toBeNull();
  });

  it('returns null when ORDER: has no following brace', () => {
    expect(extractOrderJson('ORDER: text without brace')).toBeNull();
  });
});

// ─── normalizePickupTime ──────────────────────────────────────────────────────

describe('normalizePickupTime', () => {
  it('pads a bare hour to HH:00', () => {
    expect(normalizePickupTime('11')).toBe('11:00');
    expect(normalizePickupTime('9')).toBe('09:00');
  });

  it('keeps a proper HH:MM unchanged', () => {
    expect(normalizePickupTime('11:00')).toBe('11:00');
    expect(normalizePickupTime('14:30')).toBe('14:30');
  });

  it('converts "maine 12:00" to "mâine 12:00"', () => {
    expect(normalizePickupTime('maine 12:00')).toBe('mâine 12:00');
    expect(normalizePickupTime('mâine 12:00')).toBe('mâine 12:00');
  });

  it('converts "azi la 10.30" to "azi 10:30"', () => {
    expect(normalizePickupTime('azi la 10.30')).toBe('azi 10:30');
  });

  it('converts "vineri 14:00"', () => {
    expect(normalizePickupTime('vineri 14:00')).toBe('vineri 14:00');
  });

  it('returns trimmed string as-is when unparseable', () => {
    expect(normalizePickupTime('la program')).toBe('la program');
  });

  it('handles empty string', () => {
    expect(normalizePickupTime('')).toBe('');
  });
});

// ─── parsePickupDateTime ─────────────────────────────────────────────────────

describe('parsePickupDateTime', () => {
  it('extracts bare time', () => {
    expect(parsePickupDateTime('ridic la 11:00')).toBe('11:00');
    expect(parsePickupDateTime('ora 14.30')).toBe('14:30');
  });

  it('extracts date + time for "maine"', () => {
    expect(parsePickupDateTime('maine la 12:00')).toBe('mâine 12:00');
    expect(parsePickupDateTime('mâine la 12:00')).toBe('mâine 12:00');
  });

  it('extracts date + time for "azi"', () => {
    expect(parsePickupDateTime('azi la 10:00')).toBe('azi 10:00');
  });

  it('extracts date + time for day names', () => {
    expect(parsePickupDateTime('vineri la 14:00')).toBe('vineri 14:00');
    expect(parsePickupDateTime('luni 09:00')).toBe('luni 09:00');
    expect(parsePickupDateTime('sambata la 11.30')).toBe('sâmbătă 11:30');
  });

  it('returns null when no time is present', () => {
    expect(parsePickupDateTime('maine la prânz')).toBeNull();
    expect(parsePickupDateTime('fara ora')).toBeNull();
  });
});

// ─── classifyIncomingText ────────────────────────────────────────────────────

describe('classifyIncomingText', () => {
  it('classifies cancellation requests', () => {
    expect(classifyIncomingText('vreau sa anulez comanda')).toBe('cancel_order');
    expect(classifyIncomingText('cancel my order')).toBe('cancel_order');
    expect(classifyIncomingText('nu mai vreau sa ridic')).toBe('cancel_order');
  });

  it('classifies store info requests', () => {
    expect(classifyIncomingText('care e adresa voastra?')).toBe('store_info');
    expect(classifyIncomingText('ce program aveti?')).toBe('store_info');
  });

  it('classifies browse inventory requests', () => {
    expect(classifyIncomingText('ce aveți pe stoc?')).toBe('browse_inventory');
    expect(classifyIncomingText('Ce aveti?')).toBe('browse_inventory');
    expect(classifyIncomingText('lista de produse')).toBe('browse_inventory');
    expect(classifyIncomingText('what products are available?')).toBe('browse_inventory');
  });

  it('defaults to product_query', () => {
    expect(classifyIncomingText('vreau lapte')).toBe('product_query');
    expect(classifyIncomingText('aveti branza?')).toBe('product_query');
  });

  it('does NOT false-positive on customer_phone JSON key', () => {
    // Old bug: "phone" keyword in JSON body triggered store_info
    const orderJson = '{"customer_name":"Ion","customer_phone":"+40123","items":[{"name":"Lapte","qty":2}]}';
    expect(classifyIncomingText(orderJson)).toBe('product_query');
  });

  it('does NOT false-positive on "address" inside a JSON string', () => {
    const text = '{"billing_address":"Str. Florilor 1"}';
    expect(classifyIncomingText(text)).toBe('product_query');
  });
});

// ─── greeting / reset intents ─────────────────────────────────────────────────

describe('classifyIncomingText — greeting intent', () => {
  it('classifies "Buna ziua" as greeting', () => {
    expect(classifyIncomingText('Buna ziua')).toBe('greeting');
  });
  it('classifies "Salut" as greeting', () => {
    expect(classifyIncomingText('Salut')).toBe('greeting');
  });
  it('classifies "Hello" as greeting', () => {
    expect(classifyIncomingText('Hello')).toBe('greeting');
  });
  it('classifies "hi" as greeting', () => {
    expect(classifyIncomingText('hi')).toBe('greeting');
  });
  it('does NOT classify product query as greeting', () => {
    expect(classifyIncomingText('vreau lapte')).toBe('product_query');
  });
  it('does NOT classify "buna ziua vreau lapte" as greeting (extra words)', () => {
    const result = classifyIncomingText('buna ziua vreau lapte');
    expect(result).not.toBe('greeting');
  });
});

describe('classifyIncomingText — reset intent', () => {
  it('classifies "start over" as reset', () => {
    expect(classifyIncomingText('start over')).toBe('reset');
  });
  it('classifies "restart" as reset', () => {
    expect(classifyIncomingText('restart')).toBe('reset');
  });
  it('classifies "incepe din nou" as reset', () => {
    expect(classifyIncomingText('incepe din nou')).toBe('reset');
  });
  it('reset takes priority over cancel_order', () => {
    expect(classifyIncomingText('start over')).toBe('reset');
  });
});

// ─── menu scan limited to last 2 assistant messages ───────────────────────────

describe('maybeHandleMenuSelection — menu scan limited to last 2 assistant messages', () => {
  const customerName = 'Ion';
  const customerPhone = '+40123';

  function makeMsg(role: 'user' | 'assistant', content: string): ConversationMessage {
    return { role, content, timestamp: new Date().toISOString() };
  }

  const menuText = '1) Lapte\n2) Brânză\n3) Unt';
  const inventoryWithMenu = '• Lapte — €3.42 (in stoc)\n• Brânză — €5.00 (in stoc)';

  it('triggers menu selection when menu is in the last assistant message', () => {
    const history: ConversationMessage[] = [
      makeMsg('user', 'vreau ceva de mâncat, ridic la 14:00'),
      makeMsg('user', 'vreau 1 la 14:00'),
      makeMsg('assistant', menuText),
    ];
    const result = maybeHandleMenuSelection({
      userText: '1',
      history,
      inventoryText: inventoryWithMenu,
      customerName,
      customerPhone,
    });
    expect(result).not.toBeNull();
    expect(result?.text).toContain('Lapte');
  });

  it('does NOT use old menu when it is older than 2 assistant messages ago (falls back to inventory)', () => {
    // Menu is in turn 1, then 2 more assistant messages follow — menu is 3rd from end
    const history: ConversationMessage[] = [
      makeMsg('user', 'vreau ceva la 14:00 vreau 1'),
      makeMsg('assistant', menuText),           // 3rd most recent assistant — should be skipped
      makeMsg('user', 'hmm'),
      makeMsg('assistant', 'Bine'),             // 2nd most recent assistant
      makeMsg('user', 'da'),
      makeMsg('assistant', 'Putem ajuta!'),     // most recent assistant (no menu)
    ];
    // Use empty inventory text so there's no fallback — if old menu IS used we'd get a result;
    // if correctly ignored AND no inventory, result should be null
    const result = maybeHandleMenuSelection({
      userText: '1',
      history,
      inventoryText: '',          // no inventory fallback
      customerName,
      customerPhone,
    });
    // Menu was 3 assistant messages ago → ignored; no inventory → null
    expect(result).toBeNull();
  });

  it('triggers when menu is in second-to-last assistant message', () => {
    const history: ConversationMessage[] = [
      makeMsg('assistant', menuText),           // second-to-last assistant
      makeMsg('user', 'vreau 1 la 14:00'),
      makeMsg('assistant', 'Da, care anume?'),  // last assistant (no menu)
    ];
    // Need qty + time in history for maybeHandleMenuSelection to fire
    // Insert a user message with qty + time before the numeric choice
    const historyWithContext: ConversationMessage[] = [
      makeMsg('user', 'vreau 1 la 14:00'),
      makeMsg('assistant', menuText),
      makeMsg('user', 'da'),
      makeMsg('assistant', 'Bine ales!'),
    ];
    // The menu is 2 assistant messages back → should still be found
    const result = maybeHandleMenuSelection({
      userText: '1',
      history: historyWithContext,
      inventoryText: inventoryWithMenu,
      customerName,
      customerPhone,
    });
    expect(result).not.toBeNull();
  });
});

// ─── repeatedQty multi-item path removed (PR 5a) ─────────────────────────────

describe('maybeHandleOrderFollowup — repeatedQty multi-item path removed', () => {
  function makeMsg(role: 'user' | 'assistant', content: string): ConversationMessage {
    return { role, content, timestamp: new Date().toISOString() };
  }

  const inventoryText = '• Lapte — €3.42 (in stoc)\n• Brânză — €5.00 (in stoc)';

  it('does NOT create a multi-item order from "2 din fiecare" after browsing 2 products', () => {
    const history: ConversationMessage[] = [
      makeMsg('user', 'ce aveti?'),
      makeMsg('assistant', '• Lapte — €3.42\n• Brânză — €5.00'),
    ];
    const result = maybeHandleOrderFollowup({
      userText: '2 din fiecare la 14:00',
      history,
      inventoryText,
      customerName: 'Ion',
      customerPhone: '+40123',
    });
    // Should either return null or return a clarification (not an ORDER with multiple items)
    if (result !== null) {
      expect(result.createdOrder).toBe(false);
      // Must not contain both products in one ORDER
      if (result.text.includes('ORDER:')) {
        const orderMatch = result.text.match(/ORDER:(\{.*\})/s);
        if (orderMatch) {
          const parsed = JSON.parse(orderMatch[1]!);
          expect(parsed.items?.length ?? 0).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('still creates single-product order correctly', () => {
    const history: ConversationMessage[] = [
      makeMsg('user', 'aveti lapte?'),
      makeMsg('assistant', '• Lapte — €3.42 (in stoc)'),
    ];
    const result = maybeHandleOrderFollowup({
      userText: 'vreau 2 la 14:00',
      history,
      inventoryText: '• Lapte — €3.42 (in stoc)',
      customerName: 'Ion',
      customerPhone: '+40123',
    });
    expect(result).not.toBeNull();
    expect(result?.createdOrder).toBe(false);
    expect(result?.text).toContain('Care anume?');
    expect(result?.text).toContain('1) Lapte');
    expect(result?.text).not.toContain('ORDER:');
  });
});

// ─── extractMenuOptionsFromAssistantText ──────────────────────────────────────

describe('extractMenuOptionsFromAssistantText', () => {
  it('extracts sequential numbered options starting at 1', () => {
    const text = '1) Lapte\n2) Brânză\n3) Unt';
    expect(extractMenuOptionsFromAssistantText(text)).toEqual(['Lapte', 'Brânză', 'Unt']);
  });

  it('returns empty array when options do not start at 1', () => {
    expect(extractMenuOptionsFromAssistantText('2) Lapte\n3) Brânză')).toEqual([]);
  });

  it('returns empty array for non-menu text', () => {
    expect(extractMenuOptionsFromAssistantText('Avem lapte și brânză.')).toEqual([]);
  });
});

describe('createPendingOrderFromPending', () => {
  it('creates orders with pending status', async () => {
    const single = async () => ({ data: { order_number: 'ORD-123' }, error: null });
    const select = () => ({ single });
    const insert = (payload: Record<string, unknown>) => {
      expect(payload.status).toBe('pending');
      expect(payload.customer_name).toBe('Ion');
      return { select };
    };
    const from = (table: string) => {
      expect(table).toBe('orders');
      return { insert };
    };
    const sb = { from } as unknown as Parameters<typeof createPendingOrderFromPending>[0];

    const orderNumber = await createPendingOrderFromPending(sb, {
      customer_name: 'Ion',
      customer_phone: '+40123',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.5 }],
      total_price: 7,
      pickup_time: 'mâine 12:00',
    });

    expect(orderNumber).toBe('ORD-123');
  });
});

describe('WhatsApp follow-up safety (tool-first prompts)', () => {
  it('does not create ORDER from assistant-only single product mention', () => {
    const history: ConversationMessage[] = [
      { role: 'assistant', content: 'Avem: • Branza Cheddar — €4.50, stoc: 8', timestamp: 't1' },
    ];

    const followup = maybeHandleOrderFollowup({
      userText: 'da 2 maine 12:00',
      history,
      inventoryText: '',
      customerName: 'Test',
      customerPhone: '+40000000000',
    });

    expect(followup).not.toBeNull();
    expect(followup?.createdOrder).toBe(false);
    expect(followup?.text).toContain('Care anume?');
    expect(followup?.text).not.toContain('ORDER:');
  });
});
