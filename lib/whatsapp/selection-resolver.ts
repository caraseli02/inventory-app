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
  storePendingOrder,
  appendHistory,
  getHistory,
} from './conversation-state.js';
import type { ServerSupabaseClient } from './db.js';
import { getDistinctCategories, getProductsByCategory, resolveOrderItems } from './inventory.js';
import { normalizePickupTime } from './conversation.js';
import { sendListPickerTemplate, sendRestMessage, sendTemplateMessage } from './transport.js';

export interface CartItem { name: string; qty: number; }

/** Max items for list-picker template (Twilio template has product_1..product_6) */
const MAX_LIST_PICKER_ITEMS = 6;

/** Pending selection TTL in milliseconds (30 minutes) */
const PENDING_SELECTION_TTL_MS = 30 * 60 * 1000;

export function buildNumberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}) ${item}`).join('\n');
}

function nowIso(): string {
  return new Date().toISOString();
}

function isSelectionExpired(selection: Record<string, unknown> | null): boolean {
  if (!selection?.created_at) return false; // no timestamp = legacy, treat as valid
  const createdAt = new Date(String(selection.created_at)).getTime();
  if (!Number.isFinite(createdAt) || createdAt <= 0) return true; // corrupt timestamp → treat as expired
  return Date.now() - createdAt > PENDING_SELECTION_TTL_MS;
}

/** Stamp a pending_selection payload with created_at */
function withTimestamp<T extends Record<string, unknown>>(payload: T): T & { created_at: string } {
  return { ...payload, created_at: nowIso() };
}

export type SelectionResult =
  | { outcome: 'category_selected'; category: string; cart: CartItem[] }
  | { outcome: 'product_selected'; product: string; cart: CartItem[] }
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

  const cart = (selection.cart as CartItem[] | undefined) ?? [];

  if (selection.selection_type === 'category_list' && Array.isArray(selection.items)) {
    const selectedCategory = (selection.items as string[])[index];
    if (!selectedCategory) return { outcome: 'index_out_of_range' };
    return { outcome: 'category_selected', category: selectedCategory, cart };
  }

  if (selection.selection_type === 'product_list' && Array.isArray(selection.items)) {
    const selectedProduct = (selection.items as string[])[index];
    if (!selectedProduct) return { outcome: 'index_out_of_range' };
    return { outcome: 'product_selected', product: selectedProduct, cart };
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
  cart?: CartItem[];
}): Promise<void> {
  const products = await getProductsByCategory(args.sb, args.category);
  const productSid = process.env.TWILIO_PRODUCT_LIST_SID ?? '';
  const cart = args.cart ?? [];

  if (products.length > 0) {
    const payload = withTimestamp({ selection_type: 'product_list', items: products, cart });
    const stored = await storePendingProductSelection(args.sb, args.phone, payload);
    if (!stored) {
      await sendRestMessage(args.from, 'A apărut o eroare. Încearcă din nou.');
      return;
    }

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
  cart?: CartItem[];
}): Promise<void> {
  const cart = args.cart ?? [];
  const payload = withTimestamp({ selection_type: 'awaiting_qty', product_name: args.product, cart });
  const stored = await storePendingProductSelection(args.sb, args.phone, payload);
  if (!stored) {
    await sendRestMessage(args.from, 'A apărut o eroare. Încearcă din nou.');
    return;
  }

  const qtySid = process.env.TWILIO_QTY_SID ?? '';
  let templateSent = false;
  if (qtySid) {
    templateSent = await sendTemplateMessage(args.from, qtySid, { product_name: args.product });
    if (!templateSent) {
      console.warn('[whatsapp] qty template send failed, using text fallback');
    }
  }

  if (!templateSent) {
    await sendRestMessage(args.from,
      `Ce cantitate doriți din *${args.product}*? (Trimiteți un număr, ex: 2)`);
  }

  // Always append synthetic history so LLM knows which product was selected
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
  /** When true, carries the existing cart through to the new category_list state */
  preserveCart?: boolean;
}): Promise<boolean> {
  const categories = await getDistinctCategories(args.sb);
  if (!categories.length) {
    await sendRestMessage(args.from, 'Nu sunt categorii disponibile.');
    return false;
  }

  const capped = categories.slice(0, MAX_LIST_PICKER_ITEMS);
  const categorySid = process.env.TWILIO_PRODUCT_LIST_SID ?? '';

  let cart: CartItem[] = [];
  if (args.preserveCart) {
    const existing = await getPendingProductSelection(args.sb, args.phone);
    cart = (existing?.cart as CartItem[] | undefined) ?? [];
  }

  const payload = withTimestamp({ selection_type: 'category_list', items: capped, cart });
  const stored = await storePendingProductSelection(args.sb, args.phone, payload);
  if (!stored) {
    await sendRestMessage(args.from, 'A apărut o eroare. Încearcă din nou.');
    return false;
  }

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

function parseSingleQuantity(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\b/);
  if (!match) return null;
  const value = Math.floor(Number(match[1]));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(99, value);
}

/**
 * Handle a qty reply when pending_selection.selection_type === 'awaiting_qty'.
 * Adds the item to the in-progress cart and prompts add-more vs confirm.
 * Returns true if intercepted.
 */
export async function handleQtyInput(args: {
  sb: ServerSupabaseClient;
  from: string;
  phone: string;
  text: string;
}): Promise<boolean> {
  const selection = await getPendingProductSelection(args.sb, args.phone);
  if (!selection || selection.selection_type !== 'awaiting_qty') return false;
  if (isSelectionExpired(selection)) return false;

  const product = String(selection.product_name ?? '');
  if (!product) return false;

  const qty = parseSingleQuantity(args.text);
  if (!qty) return false;

  const existingCart: CartItem[] = (selection.cart as CartItem[] | undefined) ?? [];
  const cart: CartItem[] = [...existingCart, { name: product, qty }];

  const stored = await storePendingProductSelection(args.sb, args.phone, withTimestamp({ selection_type: 'building_order', cart }));
  if (!stored) {
    await sendRestMessage(args.from, 'A apărut o eroare. Încearcă din nou.');
    return true; // intercepted — we handled the message
  }

  const summary = cart.map((item) => `• ${item.qty}x ${item.name}`).join('\n');
  await sendRestMessage(args.from,
    `🛒 Coș curent:\n${summary}\n\nDoriți să adăugați alt produs?\n1) Da, mai adaug\n2) Nu, confirmă comanda`);

  return true;
}

/**
 * Handle pickup time text when pending_selection.selection_type === 'awaiting_pickup_time'.
 * Creates the pending order and sends confirmation.
 * Returns true if intercepted.
 */
export async function handleCartPickupTime(args: {
  sb: ServerSupabaseClient;
  from: string;
  phone: string;
  text: string;
  customerName: string;
  customerPhone: string;
}): Promise<boolean> {
  const selection = await getPendingProductSelection(args.sb, args.phone);
  if (!selection || selection.selection_type !== 'awaiting_pickup_time') return false;
  if (isSelectionExpired(selection)) return false;

  const cart: CartItem[] = (selection.cart as CartItem[] | undefined) ?? [];
  if (!cart.length) return false;

  const pickupTime = normalizePickupTime(args.text);

  let resolved: Awaited<ReturnType<typeof resolveOrderItems>>;
  try {
    resolved = await resolveOrderItems(args.sb, cart);
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    // Roll back to building_order so the user can modify their cart and retry.
    const rollback = () =>
      storePendingProductSelection(args.sb, args.phone, withTimestamp({ selection_type: 'building_order', cart }));
    if (msg.startsWith('OUT_OF_STOCK_ITEM:')) {
      const name = msg.slice('OUT_OF_STOCK_ITEM:'.length);
      await sendRestMessage(args.from, `⚠️ *${name}* nu mai este în stoc în cantitatea cerută. Modificați cantitatea sau eliminați produsul.`);
      await rollback();
    } else if (msg.startsWith('NOT_FOUND_ITEM:')) {
      await sendRestMessage(args.from, 'Un produs din coș nu a putut fi găsit. Încearcă din nou cu "Caut un produs".');
      await rollback();
    } else if (msg.startsWith('AMBIGUOUS_ITEM:')) {
      const name = msg.slice('AMBIGUOUS_ITEM:'.length).split('|')[0];
      await sendRestMessage(args.from, `⚠️ *${name}* corespunde mai multor produse. Contactați magazinul pentru clarificare.`);
      await rollback();
    } else {
      throw err; // let outer error handler deal with it
    }
    return true; // intercepted
  }

  const pending = {
    customer_name: args.customerName,
    customer_phone: args.customerPhone,
    items: resolved.items,
    total_price: resolved.totalPrice,
    pickup_time: pickupTime || null,
  };

  await storePendingOrder(args.sb, args.phone, pending);
  await storePendingProductSelection(args.sb, args.phone, {});

  const summary = resolved.items.map((item) => `${item.qty}x ${item.name} — €${(item.unit_price * item.qty).toFixed(2)}`).join('\n');
  const confirmSid = process.env.TWILIO_CONFIRM_CONTENT_SID ?? '';
  if (confirmSid) {
    await sendTemplateMessage(args.from, confirmSid);
  } else {
    await sendRestMessage(args.from,
      `📋 Rezumat comandă:\n${summary}\n💶 Total: €${resolved.totalPrice.toFixed(2)}\n🕐 Ridicare: ${pickupTime || 'la preluare'}\n\nConfirmați? (DA / NU)`);
  }

  return true;
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
