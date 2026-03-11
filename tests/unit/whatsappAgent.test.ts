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
  normalizePickupTime,
  parsePickupDateTime,
} from '../../api/whatsapp/conversation';
import {
  createPendingOrderFromPending,
  extractOrderJson,
} from '../../api/whatsapp/order-intent';

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
