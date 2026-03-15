/**
 * Shared selection resolution logic for both button clicks and typed text.
 *
 * When a user selects from a list-picker (button click) or types a number
 * (text input), both paths need to resolve the index against the stored
 * `pending_selection` state and trigger the next step in the flow.
 */
import {
  getPendingProductSelection,
  storePendingProductSelection,
  appendHistory,
  getHistory,
} from './conversation-state.js';
import type { ServerSupabaseClient } from './db.js';
import { getDistinctCategories, getProductsByCategory } from './inventory.js';
import { sendListPickerTemplate, sendRestMessage, sendTemplateMessage } from './transport.js';

/** Max items for list-picker template (Twilio template has product_1..product_6) */
const MAX_LIST_PICKER_ITEMS = 6;

/** Pending selection TTL in milliseconds (30 minutes) */
const PENDING_SELECTION_TTL_MS = 30 * 60 * 1000;

function buildNumberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}) ${item}`).join('\n');
}

function nowIso(): string {
  return new Date().toISOString();
}

function isSelectionExpired(selection: Record<string, unknown> | null): boolean {
  if (!selection?.created_at) return false; // no timestamp = legacy, treat as valid
  const createdAt = new Date(String(selection.created_at)).getTime();
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false;
  return Date.now() - createdAt > PENDING_SELECTION_TTL_MS;
}

/** Stamp a pending_selection payload with created_at */
function withTimestamp<T extends Record<string, unknown>>(payload: T): T & { created_at: string } {
  return { ...payload, created_at: nowIso() };
}

export type SelectionResult =
  | { outcome: 'category_selected'; category: string }
  | { outcome: 'product_selected'; product: string }
  | { outcome: 'no_context' }
  | { outcome: 'expired' }
  | { outcome: 'index_out_of_range' };

/**
 * Resolve a numeric index (0-based) against the current pending_selection.
 * Returns what was selected without performing side effects (sending messages).
 */
export async function resolveSelectionByIndex(
  sb: ServerSupabaseClient,
  phone: string,
  index: number,
): Promise<SelectionResult> {
  const selection = await getPendingProductSelection(sb, phone);
  if (!selection) return { outcome: 'no_context' };
  if (isSelectionExpired(selection)) return { outcome: 'expired' };

  if (selection.selection_type === 'category_list' && Array.isArray(selection.items)) {
    const selectedCategory = (selection.items as string[])[index];
    if (!selectedCategory) return { outcome: 'index_out_of_range' };
    return { outcome: 'category_selected', category: selectedCategory };
  }

  if (selection.selection_type === 'product_list' && Array.isArray(selection.items)) {
    const selectedProduct = (selection.items as string[])[index];
    if (!selectedProduct) return { outcome: 'index_out_of_range' };
    return { outcome: 'product_selected', product: selectedProduct };
  }

  return { outcome: 'no_context' };
}

/**
 * After resolving a category selection, fetch products and send the product picker.
 */
export async function handleCategorySelected(args: {
  sb: ServerSupabaseClient;
  from: string;
  phone: string;
  category: string;
}): Promise<void> {
  const products = await getProductsByCategory(args.sb, args.category);
  const productSid = process.env.TWILIO_PRODUCT_LIST_SID ?? '';

  if (products.length > 0) {
    const payload = withTimestamp({ selection_type: 'product_list', items: products });
    await storePendingProductSelection(args.sb, args.phone, payload);

    if (productSid) {
      await sendListPickerTemplate(args.from, productSid, 'Selectează produsul / Choose product', products);
    } else {
      await sendRestMessage(args.from, `Produse din ${args.category}:\n${buildNumberedList(products)}`);
    }

    // Append synthetic history so LLM has context for subsequent text
    await appendSyntheticHistory(args.sb, args.phone,
      `Am selectat categoria ${args.category}. Produse disponibile: ${products.join(', ')}`);
  } else {
    await sendRestMessage(args.from, `Nu sunt produse disponibile în ${args.category}.`);
  }
}

/**
 * After resolving a product selection, send the quantity prompt.
 */
export async function handleProductSelected(args: {
  sb: ServerSupabaseClient;
  from: string;
  phone: string;
  product: string;
}): Promise<void> {
  const payload = withTimestamp({ selection_type: 'awaiting_qty', product_name: args.product });
  await storePendingProductSelection(args.sb, args.phone, payload);

  const qtySid = process.env.TWILIO_QTY_SID ?? '';
  if (qtySid) {
    try {
      await sendTemplateMessage(args.from, qtySid, { product_name: args.product });
      return;
    } catch (err) {
      console.warn('[whatsapp] qty template send failed, using text fallback:', String(err));
    }
  }

  await sendRestMessage(args.from,
    `Ce cantitate doriți din *${args.product}*? / How many of *${args.product}* would you like?`);

  await appendSyntheticHistory(args.sb, args.phone,
    `Am selectat produsul ${args.product}. Câte bucăți doriți?`);
}

/**
 * Send the category list-picker (used by both browse button and browse text).
 */
export async function sendCategoryPicker(args: {
  sb: ServerSupabaseClient;
  from: string;
  phone: string;
}): Promise<boolean> {
  const categories = await getDistinctCategories(args.sb);
  if (!categories.length) {
    await sendRestMessage(args.from, 'Nu sunt categorii disponibile.');
    return false;
  }

  const capped = categories.slice(0, MAX_LIST_PICKER_ITEMS);
  const categorySid = process.env.TWILIO_PRODUCT_LIST_SID ?? '';

  const payload = withTimestamp({ selection_type: 'category_list', items: capped });
  await storePendingProductSelection(args.sb, args.phone, payload);

  if (categorySid) {
    await sendListPickerTemplate(args.from, categorySid, 'Selectează categoria / Choose category', capped);
  } else {
    await sendRestMessage(args.from, `Categorii disponibile:\n${buildNumberedList(capped)}`);
  }

  await appendSyntheticHistory(args.sb, args.phone,
    `Categorii disponibile: ${capped.join(', ')}`);

  return true;
}

/**
 * Clear pending_selection (e.g., on order confirm/cancel).
 */
export async function clearPendingSelection(
  sb: ServerSupabaseClient,
  phone: string,
): Promise<void> {
  await storePendingProductSelection(sb, phone, {});
}

/** Append a synthetic assistant message to conversation history for LLM context */
async function appendSyntheticHistory(
  sb: ServerSupabaseClient,
  phone: string,
  content: string,
): Promise<void> {
  try {
    const history = await getHistory(sb, phone);
    await appendHistory(sb, phone, history, [
      { role: 'assistant', content, timestamp: nowIso() },
    ]);
  } catch (err) {
    console.warn('[whatsapp] failed to append synthetic history:', err);
  }
}

/**
 * Check if user text matches a known category name.
 * Returns the matched category or null.
 */
export async function findMatchingCategory(
  sb: ServerSupabaseClient,
  text: string,
): Promise<string | null> {
  const categories = await getDistinctCategories(sb);
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const category of categories) {
    const normalizedCategory = category
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalizedCategory === normalized) return category;
  }

  return null;
}
