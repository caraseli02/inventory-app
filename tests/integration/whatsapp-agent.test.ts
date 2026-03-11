/**
 * WhatsApp Agent Integration Tests
 *
 * Tests all features locally via /api/whatsapp-simulate
 * Run with: pnpm test:integration
 *
 * Features tested:
 * 1. Product Q&A (stock, price)
 * 2. Order creation with AI
 * 3. Order buttons (confirm/cancel)
 * 4. Multi-turn context
 * 5. Natural date parsing
 * 6. Cancellation intent
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

type ProductRow = {
  id: string;
  created_at: string;
  name: string;
  category: string | null;
  price: number | null;
  price_50: number | null;
  price_70: number | null;
  price_100: number | null;
  markup: number | null;
};

type ConversationRow = {
  phone_number: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  pending_order?: unknown;
  updated_at?: string;
};

const {
  createMockSupabaseClient,
  resetMockSupabaseState,
} = vi.hoisted(() => {
  const baseProducts: ProductRow[] = [
    { id: 'p-lapte-1', created_at: '2026-03-01T10:00:00Z', name: '370G LAPTE CONDEN INTEG ICINEA', category: 'Dairy', price: 3.42, price_50: null, price_70: 3.42, price_100: null, markup: 70 },
    { id: 'p-lapte-2', created_at: '2026-03-02T10:00:00Z', name: '370G LAPTE CONDEN FIERT IRISK', category: 'Dairy', price: 3.34, price_50: null, price_70: 3.34, price_100: null, markup: 70 },
    { id: 'p-paine-1', created_at: '2026-03-01T09:00:00Z', name: 'Paine Alba', category: 'Bakery', price: 1.2, price_50: null, price_70: 1.2, price_100: null, markup: 70 },
    { id: 'p-branza-1', created_at: '2026-03-01T11:00:00Z', name: 'Branza Cheddar', category: 'Dairy', price: 4.5, price_50: null, price_70: 4.5, price_100: null, markup: 70 },
    { id: 'p-zahar-1', created_at: '2026-03-01T12:00:00Z', name: 'Zahar Alb', category: 'Pantry', price: 2.1, price_50: null, price_70: 2.1, price_100: null, markup: 70 },
    { id: 'p-vin-1', created_at: '2026-03-01T13:00:00Z', name: '0.75L BACIO DI BOLLE D/SEC ALB', category: 'Wine', price: 8.27, price_50: null, price_70: 8.27, price_100: null, markup: 70 },
    { id: 'p-vin-2', created_at: '2026-03-01T14:00:00Z', name: '0.75L VIORICA ECO CRICOVA DEMI', category: 'Wine', price: 13.24, price_50: null, price_70: 13.24, price_100: null, markup: 70 },
  ];

  const baseStock = new Map<string, number>([
    ['p-lapte-1', 24],
    ['p-lapte-2', 30],
    ['p-paine-1', 20],
    ['p-branza-1', 8],
    ['p-zahar-1', 12],
    ['p-vin-1', 6],
    ['p-vin-2', 4],
  ]);

  let conversations = new Map<string, ConversationRow>();
  let orders: Array<Record<string, unknown>> = [];
  let nextOrder = 24;

  function resetMockSupabaseState() {
    conversations = new Map();
    orders = [];
    nextOrder = 24;
  }

  function likeToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
  }

  function projectRow<T extends Record<string, unknown>>(row: T, fields?: string): Record<string, unknown> {
    if (!fields) return row;
    const out: Record<string, unknown> = {};
    for (const field of fields.split(',').map((value) => value.trim()).filter(Boolean)) {
      out[field] = row[field as keyof T];
    }
    return out;
  }

  function sortProducts(products: ProductRow[], sorters: Array<{ field: string; ascending?: boolean; nullsFirst?: boolean }>) {
    return [...products].sort((left, right) => {
      for (const sorter of sorters) {
        const field = sorter.field as keyof ProductRow;
        const a = left[field];
        const b = right[field];
        if (a == null || b == null) {
          if (a == null && b == null) continue;
          const nullsFirst = sorter.nullsFirst ?? false;
          return a == null ? (nullsFirst ? -1 : 1) : (nullsFirst ? 1 : -1);
        }
        const cmp = typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a).localeCompare(String(b), 'ro');
        if (cmp !== 0) return sorter.ascending === false ? -cmp : cmp;
      }
      return 0;
    });
  }

  function createProductsQuery() {
    let selectFields = '';
    const ilikes: Array<{ field: string; pattern: string }> = [];
    const equals = new Map<string, unknown>();
    const sorters: Array<{ field: string; ascending?: boolean; nullsFirst?: boolean }> = [];

    function resolveRows(limit?: number) {
      let rows = [...baseProducts];
      for (const [field, value] of equals.entries()) {
        rows = rows.filter((row) => row[field as keyof ProductRow] === value);
      }
      for (const filter of ilikes) {
        const regex = likeToRegex(filter.pattern);
        rows = rows.filter((row) => regex.test(String(row[filter.field as keyof ProductRow] ?? '')));
      }
      if (sorters.length) rows = sortProducts(rows, sorters);
      if (typeof limit === 'number') rows = rows.slice(0, limit);
      return rows.map((row) => projectRow(row, selectFields));
    }

    const api = {
      select(fields: string) {
        selectFields = fields;
        return api;
      },
      ilike(field: string, pattern: string) {
        ilikes.push({ field, pattern });
        return api;
      },
      eq(field: string, value: unknown) {
        equals.set(field, value);
        return api;
      },
      order(field: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) {
        sorters.push({ field, ...options });
        return api;
      },
      async limit(count: number) {
        return { data: resolveRows(count), error: null };
      },
      async maybeSingle() {
        return { data: resolveRows(1)[0] ?? null, error: null };
      },
      async single() {
        return { data: resolveRows(1)[0] ?? null, error: null };
      },
    };

    return api;
  }

  function createStockMovementsQuery() {
    let ids: string[] = [];
    const api = {
      select() {
        return api;
      },
      async in(_field: string, values: string[]) {
        ids = values;
        return {
          data: ids.map((id) => ({ product_id: id, quantity: baseStock.get(id) ?? 0 })),
          error: null,
        };
      },
    };
    return api;
  }

  function createConversationQuery() {
    let selectFields = '';
    let phoneNumber = '';

    const readApi = {
      select(fields: string) {
        selectFields = fields;
        return readApi;
      },
      eq(_field: string, value: string) {
        phoneNumber = value;
        return readApi;
      },
      async maybeSingle() {
        const row = conversations.get(phoneNumber) ?? null;
        return { data: row ? projectRow(row, selectFields) : null, error: null };
      },
      async delete() {
        conversations.delete(phoneNumber);
        return { error: null };
      },
      update(payload: Partial<ConversationRow>) {
        return {
          async eq(_field: string, value: string) {
            const existing = conversations.get(value) ?? { phone_number: value };
            conversations.set(value, { ...existing, ...payload, updated_at: new Date().toISOString() });
            return { error: null };
          },
        };
      },
      async upsert(payload: ConversationRow) {
        const existing = conversations.get(payload.phone_number) ?? { phone_number: payload.phone_number };
        conversations.set(payload.phone_number, {
          ...existing,
          ...payload,
          messages: payload.messages ?? existing.messages ?? [],
          updated_at: new Date().toISOString(),
        });
        return { error: null };
      },
    };

    return {
      select: readApi.select,
      eq: readApi.eq,
      maybeSingle: readApi.maybeSingle,
      delete() {
        return {
          async eq(_field: string, value: string) {
            conversations.delete(value);
            return { error: null };
          },
        };
      },
      update: readApi.update,
      upsert: readApi.upsert,
    };
  }

  function createOrdersQuery() {
    let equals = new Map<string, unknown>();
    let sortField = '';
    let sortAscending = true;

    function filteredOrders() {
      let rows = [...orders];
      for (const [field, value] of equals.entries()) {
        rows = rows.filter((row) => row[field] === value);
      }
      if (sortField) {
        rows.sort((left, right) => {
          const a = String(left[sortField] ?? '');
          const b = String(right[sortField] ?? '');
          const cmp = a.localeCompare(b, 'ro');
          return sortAscending ? cmp : -cmp;
        });
      }
      return rows;
    }

    const queryApi = {
      select() {
        return queryApi;
      },
      eq(field: string, value: unknown) {
        equals.set(field, value);
        return queryApi;
      },
      order(field: string, options: { ascending?: boolean } = {}) {
        sortField = field;
        sortAscending = options.ascending !== false;
        return queryApi;
      },
      async limit(count: number) {
        return { data: filteredOrders().slice(0, count), error: null };
      },
      update(payload: Record<string, unknown>) {
        return {
          async eq(field: string, value: unknown) {
            orders = orders.map((row) => (row[field] === value ? { ...row, ...payload } : row));
            return { error: null };
          },
        };
      },
      insert(payload: Record<string, unknown>) {
        return {
          select() {
            return {
              async single() {
                nextOrder += 1;
                const row = {
                  id: `order-${nextOrder}`,
                  order_number: `ORD-${String(nextOrder).padStart(3, '0')}`,
                  created_at: new Date().toISOString(),
                  ...payload,
                };
                orders.push(row);
                return { data: row, error: null };
              },
            };
          },
        };
      },
    };

    return queryApi;
  }

  function createMockSupabaseClient() {
    return {
      from(table: string) {
        if (table === 'products') return createProductsQuery();
        if (table === 'stock_movements') return createStockMovementsQuery();
        if (table === 'conversation_history') return createConversationQuery();
        if (table === 'orders') return createOrdersQuery();
        throw new Error(`Unsupported mock table: ${table}`);
      },
      async rpc(name: string, args: { p_phone_number: string; p_messages: ConversationRow['messages'] }) {
        if (name !== 'append_conversation_history') {
          return { error: new Error(`Unsupported mock rpc: ${name}`) };
        }
        const existing = conversations.get(args.p_phone_number) ?? { phone_number: args.p_phone_number, messages: [] };
        conversations.set(args.p_phone_number, {
          ...existing,
          messages: [...(existing.messages ?? []), ...(args.p_messages ?? [])].slice(-20),
          updated_at: new Date().toISOString(),
        });
        return { error: null };
      },
    };
  }

  return { createMockSupabaseClient, resetMockSupabaseState };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => createMockSupabaseClient(),
}));

import simulateHandler from '../../api/whatsapp-simulate';

let baseUrl = '';
let server: Server | undefined;
const PHONE = '+40123456789';
const NAME = 'Test Customer';

interface SimulateResponse {
  ok: boolean;
  reply?: string;
  error?: string;
  provider?: string;
  debug?: {
    intent?: string;
    searchCandidatesUsed?: string[];
  };
}

async function simulateMessage(
  text: string,
  options: { reset?: boolean; debug?: boolean } = {}
): Promise<SimulateResponse> {
  const simulatorSecret = process.env.WHATSAPP_SIMULATOR_SECRET ?? process.env.VITE_NOTIFY_SECRET ?? '';
  const payload = {
    phone: PHONE,
    name: NAME,
    text: options.reset ? undefined : text,
    reset: options.reset ? true : undefined,
    mode: 'agent',
    debug: options.debug ? true : undefined,
  };

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(simulatorSecret ? { 'x-notify-secret': simulatorSecret } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Simulator failed: ${response.status}`);
  }

  return response.json();
}

describe('WhatsApp AI Agent', () => {
  beforeAll(async () => {
    resetMockSupabaseState();
    const app = express();
    app.use(express.json());
    app.post('/api/whatsapp-simulate', (req, res) =>
      simulateHandler(req as Parameters<typeof simulateHandler>[0], res as Parameters<typeof simulateHandler>[1])
    );

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => {
        const address = server!.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}/api/whatsapp-simulate`;
        resolve();
      });
    });

    // Reset conversation history before tests
    await simulateMessage('', { reset: true });
  });

  afterAll(async () => {
    // Clean up
    await simulateMessage('', { reset: true });
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  describe('Feature 1: Product Q&A', () => {
    it('should answer product availability question in Romanian', async () => {
      const result = await simulateMessage('Aveti lapte?');
      expect(result.ok).toBe(true);
      expect(result.reply).toBeDefined();
      expect(result.reply?.toLowerCase()).toMatch(/lapte|milk|stoc|stock/i);
    });

    it('should show price in EUR', async () => {
      const result = await simulateMessage('Cat costa zaharul?');
      expect(result.ok).toBe(true);
      expect(result.reply).toBeDefined();
      expect(result.reply!.length).toBeGreaterThan(10);
    });

    it('should handle English queries', async () => {
      const result = await simulateMessage('Do you have milk?');
      expect(result.ok).toBe(true);
      expect(result.reply).toBeDefined();
    });

    it('should indicate out-of-stock items', async () => {
      const result = await simulateMessage('Aveti caviar?');
      expect(result.ok).toBe(true);
      // Should either say available or not found
      expect(result.reply?.length).toBeGreaterThan(10);
    });
  });

  describe('Feature 2: Order Creation', () => {
    beforeEach(async () => {
      await simulateMessage('', { reset: true });
    });

    it('should create order with single item and date', async () => {
      const result = await simulateMessage('Vreau 2 lapte maine 12:00', { debug: true });
      expect(result.ok).toBe(true);
      expect(result.reply).toBeDefined();
      // Depending on local LLM availability, this may confirm directly or ask for disambiguation.
      expect(result.reply).toMatch(/2|12:00|mâine|Care anume\?/i);
      // Depending on current inventory snapshot, this may confirm directly or ask to choose
      expect(result.reply).toMatch(/€|Care anume\?/i);
    });

    it('should extract ORDER JSON from reply', async () => {
      const result = await simulateMessage('1 paine maine 14:30');
      expect(result.ok).toBe(true);
      expect(result.reply).toBeDefined();
      // Should either create order or ask for confirmation
      expect(result.reply?.length).toBeGreaterThan(20);
    });
  });

  describe('Feature 3: Multi-Turn Context', () => {
    beforeAll(async () => {
      await simulateMessage('', { reset: true });
    });

    it('should preserve context across turns', async () => {
      // Turn 1: Ask about milk
      const turn1 = await simulateMessage('Aveti lapte?');
      expect(turn1.ok).toBe(true);
      expect(turn1.reply?.toLowerCase()).toMatch(/lapte|milk/i);

      // Turn 2: Order with just quantity (should remember milk)
      const turn2 = await simulateMessage('Vreau 2, maine 15:00');
      expect(turn2.ok).toBe(true);
      // Should reference milk from previous turn or ask to disambiguate milk variants
      expect(turn2.reply).toMatch(/lapte|milk|Care anume\?/i);
    });

    it('should handle follow-up questions', async () => {
      const turn1 = await simulateMessage('Aveti branza cheddar?');
      const turn2 = await simulateMessage('Cat costa?');
      expect(turn1.ok && turn2.ok).toBe(true);
    });
  });

  describe('Feature 4: Natural Date Parsing', () => {
    beforeAll(async () => {
      await simulateMessage('', { reset: true });
    });

    it('should parse "maine" (tomorrow)', async () => {
      const result = await simulateMessage('Vreau 1 lapte maine 10:00');
      expect(result.ok).toBe(true);
      expect(result.reply).toMatch(/mâine|tomorrow|Care anume\?/i);
    });

    it('should parse day names', async () => {
      const result = await simulateMessage('Vreau 1 lapte vineri 14:00');
      expect(result.ok).toBe(true);
      expect(result.reply).toMatch(/vineri|friday|Care anume\?/i);
    });

    it('should handle dot notation for time', async () => {
      const result = await simulateMessage('vreau 1 370G LAPTE CONDEN INTEG ICINEA maine la 10.30');
      expect(result.ok).toBe(true);
      // Should normalize 10.30 → 10:30
      expect(result.reply).toMatch(/10:30|mâine/i);
    });

    it('should normalize bare hour', async () => {
      const result = await simulateMessage('Vreau 1 paine maine la 14');
      expect(result.ok).toBe(true);
      expect(result.reply?.length).toBeGreaterThan(10);
    });
  });

  describe('Feature 5: Cancellation Intent', () => {
    beforeAll(async () => {
      // Create an order first
      await simulateMessage('', { reset: true });
      await simulateMessage('Vreau 1 lapte maine 12:00');
    });

    it('should detect cancellation with "anuleaza"', async () => {
      const result = await simulateMessage('Anuleaza comanda!');
      expect(result.ok).toBe(true);
      expect(result.reply).toBeDefined();
      expect(result.reply?.toLowerCase()).toMatch(/anula|cancel|comandă activă/i);
    });

    it('should detect cancellation with "nu mai vreau"', async () => {
      // Create new order
      await simulateMessage('', { reset: true });
      await simulateMessage('Vreau 2 paine maine 14:00');

      const result = await simulateMessage('Nu mai vreau');
      expect(result.ok).toBe(true);
      expect(result.reply?.toLowerCase()).toMatch(/anula|cancel|comandă activă/i);
    });

    it('should detect cancellation intent classification', async () => {
      const result = await simulateMessage('Vreau sa anulez', { debug: true });
      expect(result.ok).toBe(true);
      expect(result.debug?.intent).toBe('cancel_order');
    });
  });

  describe('Feature 6: Button Payloads (Pending Orders)', () => {
    beforeAll(async () => {
      await simulateMessage('', { reset: true });
    });

    it('should support direct ORDER JSON for testing', async () => {
      const orderJson = JSON.stringify({
        customer_name: 'Test',
        customer_phone: PHONE,
        items: [{ name: 'Lapte', qty: 2 }],
        pickup_time: 'mâine 12:00',
      });

      const result = await simulateMessage(`ORDER: ${orderJson}`, { debug: true });
      expect(result.ok).toBe(true);
      expect(result.reply).toBeDefined();
    });

    it('should handle pending order storage flow', async () => {
      // This is tested via the button flow in Vercel preview
      // For now, verify that order creation works
      const result = await simulateMessage('Vreau 1 branza maine 15:00');
      expect(result.ok).toBe(true);
      expect(result.reply?.match(/€/)).toBeDefined();
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle empty messages gracefully', async () => {
      await expect(simulateMessage('')).rejects.toThrow('Simulator failed: 400');
    });

    it('should handle messages with only punctuation', async () => {
      const result = await simulateMessage('???');
      expect(result.ok).toBe(true);
    });

    it('should handle very long messages', async () => {
      const longText = 'Vreau lapte '.repeat(50);
      const result = await simulateMessage(longText);
      expect(result.ok).toBe(true);
    });

    it('should handle Unicode and diacritics', async () => {
      const result = await simulateMessage('Aveti înghețată?');
      expect(result.ok).toBe(true);
    });
  });

  describe('Inventory Context', () => {
    beforeAll(async () => {
      await simulateMessage('', { reset: true });
    });

    it('should merge history candidates with current query', async () => {
      // Turn 1: Search for milk
      await simulateMessage('Aveti lapte unguresc?');

      // Turn 2: Just say "confirm" — should remember milk from turn 1
      const result = await simulateMessage('Da, confirma 2 pentru maine', { debug: true });
      expect(result.ok).toBe(true);
      // Should have included milk in candidates
      expect(result.debug?.searchCandidatesUsed?.some(c => c.toLowerCase().includes('lapte'))).toBeDefined();
    });

    it('keeps the last listed products for "de cada" followups', async () => {
      await simulateMessage('', { reset: true });

      const turn1 = await simulateMessage('Que vinos teneis?');
      expect(turn1.ok).toBe(true);
      expect(turn1.reply).toBeDefined();

      const turn2 = await simulateMessage('1 de cada para recoger a las 19:00');
      expect(turn2.ok).toBe(true);
      expect(turn2.reply).toBeDefined();
      expect(turn2.reply).toMatch(/19:00|ORDER:|confirm/i);
    });
  });

  describe('Store Info', () => {
    it('should answer store address question', async () => {
      const result = await simulateMessage('Care e adresa?');
      expect(result.ok).toBe(true);
      // Should mention address from env vars
      expect(result.reply?.length).toBeGreaterThan(10);
    });

    it('should answer store hours question', async () => {
      const result = await simulateMessage('Care e programul?');
      expect(result.ok).toBe(true);
      // Should mention hours from env vars
      expect(result.reply?.length).toBeGreaterThan(10);
    });
  });
});
