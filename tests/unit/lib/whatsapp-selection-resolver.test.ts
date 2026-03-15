/**
 * Unit tests for selection-resolver.ts
 *
 * Covers:
 * - resolveSelectionByIndex: category_list, product_list, no_context, expired, out_of_range
 * - findMatchingCategory: exact match, diacritics, case-insensitive, no match
 * - sendCategoryPicker: caps at 10, stores pending_selection, text fallback
 * - handleCategorySelected: stores product_list, sends picker
 * - handleProductSelected: stores awaiting_qty, sends qty prompt
 * - clearPendingSelection: resets state
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock conversation-state ──────────────────────────────────────────────────

let mockPendingSelection: Record<string, unknown> | null = null;
let storedPendingPayload: Record<string, unknown> | null = null;
let appendedHistory: Array<{ role: string; content: string }> = [];

vi.mock('../../../lib/whatsapp/conversation-state.js', () => ({
  getPendingProductSelection: vi.fn(async () => mockPendingSelection),
  storePendingProductSelection: vi.fn(async (_sb: unknown, _phone: string, payload: Record<string, unknown>) => {
    storedPendingPayload = payload;
  }),
  getHistory: vi.fn(async () => []),
  appendHistory: vi.fn(async (_sb: unknown, _phone: string, _history: unknown[], entries: Array<{ role: string; content: string }>) => {
    appendedHistory.push(...entries);
  }),
}));

// ── Mock inventory ───────────────────────────────────────────────────────────

let mockCategories: string[] = ['Dairy', 'Bakery', 'Wine', 'Pantry'];
let mockProducts: string[] = ['Lapte', 'Branza'];

vi.mock('../../../lib/whatsapp/inventory.js', () => ({
  getDistinctCategories: vi.fn(async () => mockCategories),
  getProductsByCategory: vi.fn(async () => mockProducts),
}));

// ── Mock transport ───────────────────────────────────────────────────────────

const sentMessages: Array<{ to: string; body: string }> = [];
const sentTemplates: Array<{ to: string; contentSid: string; variables?: Record<string, string> }> = [];
const sentListPickers: Array<{ to: string; contentSid: string; items: string[] }> = [];

vi.mock('../../../lib/whatsapp/transport.js', () => ({
  sendRestMessage: vi.fn(async (to: string, body: string) => {
    sentMessages.push({ to, body });
  }),
  sendTemplateMessage: vi.fn(async (to: string, contentSid: string, variables?: Record<string, string>) => {
    sentTemplates.push({ to, contentSid, variables });
  }),
  sendListPickerTemplate: vi.fn(async (to: string, contentSid: string, _title: string, items: string[]) => {
    sentListPickers.push({ to, contentSid, items });
  }),
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import {
  resolveSelectionByIndex,
  findMatchingCategory,
  sendCategoryPicker,
  handleCategorySelected,
  handleProductSelected,
  clearPendingSelection,
} from '../../../lib/whatsapp/selection-resolver.js';

const fakeSb = {} as Parameters<typeof resolveSelectionByIndex>[0];
const testPhone = '+40700000001';
const testFrom = 'whatsapp:+40700000001';

beforeEach(() => {
  mockPendingSelection = null;
  storedPendingPayload = null;
  appendedHistory = [];
  sentMessages.length = 0;
  sentTemplates.length = 0;
  sentListPickers.length = 0;
  mockCategories = ['Dairy', 'Bakery', 'Wine', 'Pantry'];
  mockProducts = ['Lapte', 'Branza'];
  delete process.env.TWILIO_PRODUCT_LIST_SID;
  delete process.env.TWILIO_QTY_SID;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── resolveSelectionByIndex ─────────────────────────────────────────────────

describe('resolveSelectionByIndex', () => {
  it('returns no_context when no pending selection', async () => {
    const result = await resolveSelectionByIndex(fakeSb, testPhone, 0);
    expect(result).toEqual({ outcome: 'no_context' });
  });

  it('resolves category from category_list', async () => {
    mockPendingSelection = {
      selection_type: 'category_list',
      items: ['Dairy', 'Bakery', 'Wine'],
      created_at: new Date().toISOString(),
    };
    const result = await resolveSelectionByIndex(fakeSb, testPhone, 1);
    expect(result).toEqual({ outcome: 'category_selected', category: 'Bakery' });
  });

  it('resolves product from product_list', async () => {
    mockPendingSelection = {
      selection_type: 'product_list',
      items: ['Lapte', 'Branza', 'Unt'],
      created_at: new Date().toISOString(),
    };
    const result = await resolveSelectionByIndex(fakeSb, testPhone, 2);
    expect(result).toEqual({ outcome: 'product_selected', product: 'Unt' });
  });

  it('returns index_out_of_range for invalid index', async () => {
    mockPendingSelection = {
      selection_type: 'category_list',
      items: ['Dairy', 'Bakery'],
      created_at: new Date().toISOString(),
    };
    const result = await resolveSelectionByIndex(fakeSb, testPhone, 5);
    expect(result).toEqual({ outcome: 'index_out_of_range' });
  });

  it('returns expired for old pending selection (>30 min)', async () => {
    const thirtyOneMinAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    mockPendingSelection = {
      selection_type: 'category_list',
      items: ['Dairy'],
      created_at: thirtyOneMinAgo,
    };
    const result = await resolveSelectionByIndex(fakeSb, testPhone, 0);
    expect(result).toEqual({ outcome: 'expired' });
  });

  it('treats selection without created_at as valid (legacy)', async () => {
    mockPendingSelection = {
      selection_type: 'product_list',
      items: ['Lapte'],
    };
    const result = await resolveSelectionByIndex(fakeSb, testPhone, 0);
    expect(result).toEqual({ outcome: 'product_selected', product: 'Lapte' });
  });

  it('returns no_context for unknown selection_type', async () => {
    mockPendingSelection = {
      selection_type: 'awaiting_qty',
      product_name: 'Lapte',
      created_at: new Date().toISOString(),
    };
    const result = await resolveSelectionByIndex(fakeSb, testPhone, 0);
    expect(result).toEqual({ outcome: 'no_context' });
  });
});

// ─── findMatchingCategory ────────────────────────────────────────────────────

describe('findMatchingCategory', () => {
  it('matches exact category name', async () => {
    const result = await findMatchingCategory(fakeSb, 'Dairy');
    expect(result).toBe('Dairy');
  });

  it('matches case-insensitively', async () => {
    const result = await findMatchingCategory(fakeSb, 'dairy');
    expect(result).toBe('Dairy');
  });

  it('matches with diacritics stripped', async () => {
    mockCategories = ['Brânzeturi', 'Lactate'];
    const result = await findMatchingCategory(fakeSb, 'Branzeturi');
    expect(result).toBe('Brânzeturi');
  });

  it('returns null for no match', async () => {
    const result = await findMatchingCategory(fakeSb, 'Electronics');
    expect(result).toBeNull();
  });

  it('returns null for partial match', async () => {
    const result = await findMatchingCategory(fakeSb, 'Dai');
    expect(result).toBeNull();
  });
});

// ─── sendCategoryPicker ──────────────────────────────────────────────────────

describe('sendCategoryPicker', () => {
  it('sends text fallback when no SID set', async () => {
    const result = await sendCategoryPicker({ sb: fakeSb, from: testFrom, phone: testPhone });
    expect(result).toBe(true);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].body).toContain('Categorii disponibile');
    expect(sentMessages[0].body).toContain('1) Dairy');
  });

  it('sends text fallback when SID set but fewer than 6 categories', async () => {
    process.env.TWILIO_PRODUCT_LIST_SID = 'HX_test_sid';
    // mockCategories has 4 items — below the 6-slot template requirement
    const result = await sendCategoryPicker({ sb: fakeSb, from: testFrom, phone: testPhone });
    expect(result).toBe(true);
    expect(sentListPickers).toHaveLength(0);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].body).toContain('1) Dairy');
  });

  it('sends list-picker template when SID set and exactly 6 categories', async () => {
    process.env.TWILIO_PRODUCT_LIST_SID = 'HX_test_sid';
    mockCategories = ['Dairy', 'Bakery', 'Wine', 'Pantry', 'Meat', 'Produce'];
    const result = await sendCategoryPicker({ sb: fakeSb, from: testFrom, phone: testPhone });
    expect(result).toBe(true);
    expect(sentListPickers).toHaveLength(1);
    expect(sentListPickers[0].items).toEqual(['Dairy', 'Bakery', 'Wine', 'Pantry', 'Meat', 'Produce']);
  });

  it('caps categories at 6 and uses template (matching template slots)', async () => {
    mockCategories = Array.from({ length: 15 }, (_, i) => `Cat${i + 1}`);
    process.env.TWILIO_PRODUCT_LIST_SID = 'HX_test_sid';
    await sendCategoryPicker({ sb: fakeSb, from: testFrom, phone: testPhone });
    expect(sentListPickers).toHaveLength(1);
    expect(sentListPickers[0].items).toHaveLength(6);
  });

  it('stores pending_selection with category_list type and created_at', async () => {
    await sendCategoryPicker({ sb: fakeSb, from: testFrom, phone: testPhone });
    expect(storedPendingPayload).not.toBeNull();
    expect(storedPendingPayload!.selection_type).toBe('category_list');
    expect(storedPendingPayload!.items).toEqual(['Dairy', 'Bakery', 'Wine', 'Pantry']);
    expect(storedPendingPayload!.created_at).toBeDefined();
  });

  it('appends synthetic history', async () => {
    await sendCategoryPicker({ sb: fakeSb, from: testFrom, phone: testPhone });
    expect(appendedHistory).toHaveLength(1);
    expect(appendedHistory[0].content).toContain('Categorii disponibile');
  });

  it('returns false when no categories available', async () => {
    mockCategories = [];
    const result = await sendCategoryPicker({ sb: fakeSb, from: testFrom, phone: testPhone });
    expect(result).toBe(false);
    expect(sentMessages[0].body).toContain('Nu sunt categorii disponibile');
  });
});

// ─── handleCategorySelected ──────────────────────────────────────────────────

describe('handleCategorySelected', () => {
  it('sends product list as text fallback', async () => {
    await handleCategorySelected({ sb: fakeSb, from: testFrom, phone: testPhone, category: 'Dairy' });
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].body).toContain('Produse din Dairy');
    expect(sentMessages[0].body).toContain('1) Lapte');
  });

  it('stores product_list pending_selection', async () => {
    await handleCategorySelected({ sb: fakeSb, from: testFrom, phone: testPhone, category: 'Dairy' });
    expect(storedPendingPayload!.selection_type).toBe('product_list');
    expect(storedPendingPayload!.items).toEqual(['Lapte', 'Branza']);
    expect(storedPendingPayload!.created_at).toBeDefined();
  });

  it('sends "no products" message when category is empty', async () => {
    mockProducts = [];
    await handleCategorySelected({ sb: fakeSb, from: testFrom, phone: testPhone, category: 'Empty' });
    expect(sentMessages[0].body).toContain('Nu sunt produse disponibile');
  });
});

// ─── handleProductSelected ───────────────────────────────────────────────────

describe('handleProductSelected', () => {
  it('sends qty text prompt when no SID set', async () => {
    await handleProductSelected({ sb: fakeSb, from: testFrom, phone: testPhone, product: 'Lapte' });
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].body).toContain('Lapte');
    expect(sentMessages[0].body).toContain('cantitate');
  });

  it('sends qty template when SID set', async () => {
    process.env.TWILIO_QTY_SID = 'HX_qty_sid';
    await handleProductSelected({ sb: fakeSb, from: testFrom, phone: testPhone, product: 'Lapte' });
    expect(sentTemplates).toHaveLength(1);
    expect(sentTemplates[0].variables).toEqual({ product_name: 'Lapte' });
  });

  it('stores awaiting_qty pending_selection', async () => {
    await handleProductSelected({ sb: fakeSb, from: testFrom, phone: testPhone, product: 'Lapte' });
    expect(storedPendingPayload!.selection_type).toBe('awaiting_qty');
    expect(storedPendingPayload!.product_name).toBe('Lapte');
  });
});

// ─── clearPendingSelection ───────────────────────────────────────────────────

describe('clearPendingSelection', () => {
  it('stores empty object to clear state', async () => {
    await clearPendingSelection(fakeSb, testPhone);
    expect(storedPendingPayload).toEqual({});
  });
});
