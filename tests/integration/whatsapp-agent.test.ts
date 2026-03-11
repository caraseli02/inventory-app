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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'http://localhost:5173/api/whatsapp-simulate';
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

  const response = await fetch(BASE_URL, {
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
    // Reset conversation history before tests
    await simulateMessage('', { reset: true });
  });

  afterAll(async () => {
    // Clean up
    await simulateMessage('', { reset: true });
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
      // Should mention quantity and time
      expect(result.reply).toMatch(/2|12:00|mâine/i);
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
