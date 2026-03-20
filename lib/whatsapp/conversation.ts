import type { ConversationMessage, IncomingIntent } from './types.js';

interface OrdersSelectChain {
  eq(column: string, value: string): OrdersSelectChain;
  order(column: string, options: { ascending: boolean }): {
    limit(limit: number): Promise<{ data: unknown[] | null }>;
  };
}

interface OrdersUpdateChain {
  eq(column: string, value: string): Promise<{ error: unknown }>;
}

interface OrdersTableClient {
  select(columns: string): OrdersSelectChain;
  update(values: Record<string, unknown>): OrdersUpdateChain;
}

interface OrdersQueryableClient {
  from(table: string): unknown;
}

export function detectEnglish(text: string): boolean {
  const t = text.toLowerCase();
  return /(address|hours|open|close|phone|contact|\bthe\b|\bwant\b|\bhave\b|\bdo you\b|\bi would\b|\bplease\b|\border\b|\bstock\b|\bavailable\b|\bprice\b|\bhello\b|\bhi\b)/.test(t);
}

export function buildStoreInfoReply(text: string): string {
  const storeName = process.env.STORE_NAME ?? 'our store';
  const storeAddress = process.env.STORE_ADDRESS ?? '';
  const storeHours = process.env.STORE_HOURS ?? '';
  const storePhone = process.env.STORE_PHONE ?? '';

  const isEn = detectEnglish(text);
  const hasAny = Boolean(storeAddress || storeHours || storePhone);

  if (!hasAny) {
    return isEn
      ? "Sorry — store info isn't configured yet. Please ask in-store."
      : 'Ne pare rău — informațiile magazinului nu sunt configurate încă. Te rog întreabă în magazin.';
  }

  const lines: string[] = [];
  lines.push(isEn ? `Store: ${storeName}` : `Magazin: ${storeName}`);
  if (storeAddress) lines.push(isEn ? `Address: ${storeAddress}` : `Adresă: ${storeAddress}`);
  if (storeHours) lines.push(isEn ? `Hours: ${storeHours}` : `Program: ${storeHours}`);
  if (storePhone) lines.push(isEn ? `Phone: ${storePhone}` : `Telefon: ${storePhone}`);
  return lines.join('\n');
}

export function buildOverloadedReply(text: string): string {
  return detectEnglish(text)
    ? "Sorry — we're busy right now. Please try again in 1–2 minutes."
    : 'Ne pare rău — sistemul e ocupat acum. Te rog încearcă din nou în 1–2 minute.';
}

export function classifyIncomingText(text: string): IncomingIntent {
  const stripped = text.replace(/\{[\s\S]*?\}/g, ' ');
  const t = normalizeFreeText(stripped);
  if (/(start over|restart|incepe din nou|reset|sterge istoricul|sterg istoricul)/.test(t)) {
    return 'reset';
  }
  if (/^(buna ziua|buna dimineata|buna seara|buna|salut|hello|hi|hey|buna\s*!?|salut\s*!?|hello\s*!?|hi\s*!?)$/.test(t.trim())) {
    return 'greeting';
  }
  if (/(anule[az]|anulez|anulati|anulați|cancel|revocare|stornez|nu mai vreau|nu mai vin)/.test(t)) {
    return 'cancel_order';
  }
  if (/(adresa|address|unde|locati|program|orar|hours|open|inchis|telefon|phone|contact)/.test(t)) {
    return 'store_info';
  }
  if (/(ce aveti|lista|list|inventar|produse|products|available|aveti pe stoc)/.test(t)) {
    return 'browse_inventory';
  }
  return 'product_query';
}

export function extractSearchCandidates(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const stop = new Set([
    'ai', 'aveti', 'aveți', 'are', 'ati', 'ați', 'as', 'aș', 'as', 'vrea', 'vreau', 'imi', 'îmi', 'mi', 'un', 'o',
    'la', 'in', 'în', 'pe', 'cu', 'de', 'din', 'si', 'și', 'sau', 'care', 'ce', 'cat', 'cât', 'este', 'mai', 'mult',
    'comand', 'comanda', 'comandă', 'comandați', 'comandati', 'doriți', 'doriti', 'doresc', 'vreți', 'vreti',
    'ridic', 'ridica', 'ridicat', 'ridicare', 'ridicarea', 'ridicarii', 'ridicării', 'ora', 'pentru',
    'confirma', 'confirmat', 'confirmati', 'confirmați', 'confirm', 'confirmed',
    'ok', 'okay', 'will', 'get', 'take', 'want', 'buy', 'order', 'pickup', 'pick', 'up', 'for', 'sale', 'im', 'i',
    'do', 'you', 'have', 'any', 'is', 'it', 'there', 'a', 'an', 'the', 'of', 'to', 'for', 'in', 'on', 'with', 'please',
    'price', 'cost', 'stock', 'available',
  ]);

  const candidates = cleaned.filter((word) => word.length >= 3 && !stop.has(word));
  if (!candidates.length) return [];

  const unique = Array.from(new Set(candidates.flatMap((word) => {
    if (word === 'milk') return ['lapte', 'milk'];
    return [word];
  })));

  unique.sort((a, b) => b.length - a.length);
  return unique.slice(0, 3);
}

export function extractSearchCandidatesFromHistory(history: ConversationMessage[]): string[] {
  const recent = history.slice(-4);
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];
    if (message?.role !== 'user' || !message.content) continue;
    const candidates = extractSearchCandidates(message.content);
    if (candidates.length) return candidates;
  }
  return [];
}

function normalizeFreeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractInventoryNames(inventoryText: string): string[] {
  return inventoryText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('•'))
    .map((line) => line.replace(/^•\s*/, ''))
    .map((line) => line.split(' — ')[0] ?? '')
    .map((left) => left.replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter(Boolean);
}

function extractProductNamesFromAssistantText(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const inlineBullet = line.indexOf('•');
      return inlineBullet > 0 ? line.slice(inlineBullet) : line;
    })
    .filter((line) => /^([*•-]\s+|\d+\)\s+)/.test(line))
    .map((line) => line.replace(/^([*•-]\s+|\d+\)\s+)/, ''))
    .map((line) => line.split(' — ')[0] ?? '')
    .map((line) => line.replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter(Boolean);
}

const DATE_WORDS: Record<string, string> = {
  azi: 'azi', astazi: 'azi', 'astăzi': 'azi',
  maine: 'mâine', 'mâine': 'mâine',
  poimaine: 'poimâine', 'poimâine': 'poimâine',
  luni: 'luni', marti: 'marți', 'marți': 'marți', miercuri: 'miercuri',
  joi: 'joi', vineri: 'vineri', sambata: 'sâmbătă', 'sâmbătă': 'sâmbătă',
  duminica: 'duminică', 'duminică': 'duminică',
};

export function parsePickupDateTime(text: string): string | null {
  const normalized = text.toLowerCase().replace(/\./g, ':');
  const timeMatch = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!timeMatch) return null;

  const timePart = `${timeMatch[1]!.padStart(2, '0')}:${timeMatch[2]}`;
  for (const [key, label] of Object.entries(DATE_WORDS)) {
    if (normalized.includes(key)) return `${label} ${timePart}`;
  }

  return timePart;
}

function parsePickupTime(text: string): string | null {
  return parsePickupDateTime(text);
}

export function normalizePickupTime(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^\d{1,2}$/.test(trimmed)) return `${trimmed.padStart(2, '0')}:00`;
  return parsePickupDateTime(trimmed) ?? trimmed;
}

function parseSingleQuantity(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\b/);
  if (!match) return null;
  const value = Math.floor(Number(match[1]));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(99, value);
}

function parseRepeatedQuantity(text: string): number | null {
  const normalized = normalizeFreeText(text);
  const match = normalized.match(/\b(\d{1,2})\s+(?:de\s+cada|cada\s+uno|din\s+fiecare|each)\b/);
  if (!match) return null;
  const qty = Number(match[1]);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return Math.min(99, Math.floor(qty));
}

function parseMenuChoice(text: string): number | null {
  const match = text.trim().match(/^([1-9])\s*[).]?\s*$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 1 && value <= 9 ? value : null;
}

export function extractMenuOptionsFromAssistantText(text: string): string[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const options: Array<{ idx: number; name: string }> = [];

  for (const line of lines) {
    const match = line.match(/^(\d)\)\s+(.*)$/);
    if (!match) continue;
    const idx = Number(match[1]);
    const name = String(match[2] ?? '').trim();
    if (!name) continue;
    options.push({ idx, name });
  }

  if (!options.length) return [];
  options.sort((a, b) => a.idx - b.idx);
  if (options[0]!.idx !== 1) return [];

  for (let index = 0; index < options.length; index += 1) {
    if (options[index]!.idx !== index + 1) return [];
  }

  return options.map((option) => option.name);
}

function findLastMenuOptions(history: ConversationMessage[]): string[] {
  let assistantMessagesSeen = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role !== 'assistant' || !message.content) continue;
    assistantMessagesSeen += 1;
    if (assistantMessagesSeen > 2) break;
    const options = extractMenuOptionsFromAssistantText(message.content);
    if (options.length >= 2) return options;
  }
  return [];
}

function findRecentAssistantProductMentions(history: ConversationMessage[]): string[] {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role !== 'assistant' || !message.content) continue;

    const menuOptions = extractMenuOptionsFromAssistantText(message.content);
    if (menuOptions.length >= 1) return menuOptions;

    const listedProducts = extractProductNamesFromAssistantText(message.content);
    if (listedProducts.length >= 1) return listedProducts;
  }
  return [];
}

function findLastQtyAndPickupTime(history: ConversationMessage[]): { qty: number; pickupTime: string } | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role !== 'user' || !message.content) continue;
    const qty = parseSingleQuantity(message.content);
    const pickupTime = parsePickupTime(message.content);
    if (qty && pickupTime) return { qty, pickupTime };
  }
  return null;
}

export function looksLikeOrderRequest(text: string): boolean {
  const normalized = normalizeFreeText(text);
  return /(vreau|comand|comanda|order|buy|take|get|i will|yes|da)\b/.test(normalized);
}

export function maybeHandleMenuSelection(args: {
  userText: string;
  history: ConversationMessage[];
  inventoryText: string;
  customerName: string;
  customerPhone: string;
}): { text: string } | null {
  const choice = parseMenuChoice(args.userText);
  if (!choice) return null;

  const context = findLastQtyAndPickupTime(args.history);
  if (!context) return null;

  const optionsFromMenu = findLastMenuOptions(args.history);
  const optionsFromInventory = extractInventoryNames(args.inventoryText).slice(0, 3);
  const options = optionsFromMenu.length ? optionsFromMenu : optionsFromInventory;
  if (!options.length) return null;

  const chosen = options[choice - 1];
  if (!chosen) return null;

  const payload = {
    customer_name: args.customerName,
    customer_phone: args.customerPhone,
    items: [{ name: chosen, qty: context.qty }],
    pickup_time: context.pickupTime,
  };

  return {
    text: `Perfect — confirm: ${context.qty} × ${chosen}, ridicare la ${context.pickupTime}.\nORDER:${JSON.stringify(payload)}`,
  };
}

export function maybeHandleOrderFollowup(args: {
  userText: string;
  history: ConversationMessage[];
  inventoryText: string;
  customerName: string;
  customerPhone: string;
}): { text: string; createdOrder: boolean } | null {
  if (!looksLikeOrderRequest(args.userText)) return null;

  const pickupTime = parsePickupTime(args.userText);
  const qty = parseSingleQuantity(args.userText);
  const repeatedQty = parseRepeatedQuantity(args.userText);
  if (!pickupTime || (!qty && !repeatedQty)) return null;

  const recentNames = findRecentAssistantProductMentions(args.history);
  const hasAssistantContext = recentNames.length > 0;
  const inventoryNames = recentNames.length
    ? []
    : (!args.inventoryText || args.inventoryText.trim() === 'Inventar indisponibil.')
      ? []
      : extractInventoryNames(args.inventoryText);
  const candidateNames = recentNames.length ? recentNames : inventoryNames;
  if (!candidateNames.length) return null;

  const normalizedUserText = normalizeFreeText(args.userText);
  const matches = candidateNames.filter((name) => normalizedUserText.includes(normalizeFreeText(name)));

  // Safety: if the only context is from assistant mentions (and the user didn't repeat the name),
  // do not create an ORDER automatically — require explicit selection/mention.
  if (matches.length === 1) {
    const chosen = matches[0]!;
    const quantity = qty ?? repeatedQty ?? 1;
    const payload = {
      customer_name: args.customerName,
      customer_phone: args.customerPhone,
      items: [{ name: chosen, qty: quantity }],
      pickup_time: pickupTime,
    };
    return {
      text: `Perfect — confirm: ${quantity} × ${chosen}, ridicare la ${pickupTime}.\nORDER:${JSON.stringify(payload)}`,
      createdOrder: true,
    };
  }

  if (candidateNames.length === 1 && !hasAssistantContext) {
    const chosen = candidateNames[0]!;
    const quantity = qty ?? repeatedQty ?? 1;
    const payload = {
      customer_name: args.customerName,
      customer_phone: args.customerPhone,
      items: [{ name: chosen, qty: quantity }],
      pickup_time: pickupTime,
    };
    return {
      text: `Perfect — confirm: ${quantity} × ${chosen}, ridicare la ${pickupTime}.\nORDER:${JSON.stringify(payload)}`,
      createdOrder: true,
    };
  }

  const options = candidateNames.slice(0, 3);
  return {
    text: `Am mai multe opțiuni în inventar. Care anume?\n${options.map((name, index) => `${index + 1}) ${name}`).join('\n')}`,
    createdOrder: false,
  };
}

export function maybeRepairOrderReply(args: {
  replyText: string;
  userText: string;
  historyContext?: string;
  inventoryText: string;
  customerName: string;
  customerPhone: string;
}): { text: string; repairedOrder: boolean } {
  if (/ORDER:\s*\{[\s\S]*\}/i.test(args.replyText)) {
    return { text: args.replyText, repairedOrder: false };
  }

  const fullContext = [args.historyContext, args.userText].filter(Boolean).join(' ');
  if (!looksLikeOrderRequest(fullContext)) {
    return { text: args.replyText, repairedOrder: false };
  }

  const pickupTimeFromUser = parsePickupTime(args.userText);
  const qtyFromUser = parseSingleQuantity(args.userText);
  if (!pickupTimeFromUser || !qtyFromUser) {
    return { text: args.replyText, repairedOrder: false };
  }

  const pickupTime = pickupTimeFromUser;
  const qty = qtyFromUser;

  const names = extractInventoryNames(args.inventoryText);
  if (!names.length) return { text: args.replyText, repairedOrder: false };

  const normalizedContext = normalizeFreeText(fullContext);
  const matches = names.filter((name) => normalizedContext.includes(normalizeFreeText(name)));
  if (matches.length !== 1) return { text: args.replyText, repairedOrder: false };

  const payload = {
    customer_name: args.customerName,
    customer_phone: args.customerPhone,
    items: [{ name: matches[0], qty }],
    pickup_time: pickupTime,
  };

  return {
    text: `${args.replyText.trim()}\nORDER:${JSON.stringify(payload)}`,
    repairedOrder: true,
  };
}

export async function handleCancellationRequest(
  sb: OrdersQueryableClient,
  phone: string,
  userText: string,
): Promise<string> {
  const isEn = detectEnglish(userText);
  const ordersTable = sb.from('orders') as OrdersTableClient;

  const { data: orders } = await ordersTable
    .select('id, order_number, items, pickup_time')
    .eq('customer_phone', phone)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!orders?.length) {
    return isEn
      ? 'No active orders found for your number. If you need help, please call the store.'
      : 'Nu am găsit nicio comandă activă pentru numărul tău. Dacă ai nevoie de ajutor, te rog sună la magazin.';
  }

  const order = orders[0] as { id: string; order_number: string };
  const { error } = await ordersTable.update({ status: 'cancelled' }).eq('id', order.id);

  if (error) {
    console.error('[whatsapp] cancellation failed:', error);
    return isEn
      ? 'Sorry — could not cancel your order. Please call the store.'
      : 'Ne pare rău — nu am putut anula comanda. Te rog sună la magazin.';
  }

  return isEn
    ? `Order ${order.order_number} has been cancelled. Sorry you couldn't make it — we're here whenever you need us!`
    : `Comanda ${order.order_number} a fost anulată. Ne pare rău că nu poți ridica comanda — suntem la dispoziție oricând!`;
}
