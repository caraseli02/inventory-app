import type { IncomingIntent } from './types.js';
import { extractSearchCandidates } from './conversation.js';

interface ProductsQuery {
  select(columns: string): ProductsQuery;
  eq(column: string, value: string): ProductsQuery;
  ilike(column: string, value: string): ProductsQuery;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): ProductsQuery;
  limit(limit: number): Promise<{ data: unknown[] | null }>;
  maybeSingle(): Promise<{ data: unknown | null }>;
}

interface StockMovementsQuery {
  select(columns: string): {
    in(column: string, values: string[]): Promise<{ data: unknown[] | null }>;
  };
}

interface InventoryQueryableClient {
  from(table: string): unknown;
}

export interface ProductRow {
  id: string;
  created_at: string;
  name: string;
  category: string | null;
  price: number | null;
  price_50: number | null;
  price_70: number | null;
  price_100: number | null;
  markup: number | null;
}

interface MovementRow {
  product_id: string;
  quantity: number;
}

type ProductMatchResult =
  | { type: 'match'; product: ProductRow }
  | { type: 'not_found' }
  | { type: 'ambiguous'; candidates: string[] };

export function getStorePrice(product: ProductRow): number | null {
  const tier = (product.markup as 50 | 70 | 100) || 70;
  if (tier === 50) return product.price_50 ?? product.price;
  if (tier === 100) return product.price_100 ?? product.price;
  return product.price_70 ?? product.price;
}

function normalizeProductText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeOrderItemName(rawName: string): string {
  return rawName
    .replace(/^\s*\d+\s*[x×]\s*/i, '')
    .replace(/\s*\(([^)]*)\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreProductName(name: string, query: string): number {
  if (!name || !query) return 0;
  if (name === query) return 100;
  if (name.startsWith(query)) return 85;
  if (name.includes(query)) return 70;

  const queryTokens = new Set(query.split(' ').filter(Boolean));
  const nameTokens = new Set(name.split(' ').filter(Boolean));
  let overlap = 0;

  for (const token of queryTokens) {
    if (nameTokens.has(token)) overlap += 1;
  }

  return overlap > 0 ? 40 + overlap * 10 : 0;
}

export async function resolveProductById(
  sb: InventoryQueryableClient,
  id: string,
): Promise<ProductMatchResult> {
  const productsTable = sb.from('products') as ProductsQuery;
  const { data: product } = await productsTable
    .select('id, created_at, name, category, price, price_50, price_70, price_100, markup')
    .eq('id', id)
    .maybeSingle();

  return product ? { type: 'match', product: product as ProductRow } : { type: 'not_found' };
}

export async function resolveProductByName(
  sb: InventoryQueryableClient,
  rawName: string,
  targetPrice?: number,
): Promise<ProductMatchResult> {
  const makeProductsQuery = () => (sb.from('products') as ProductsQuery)
    .select('id, created_at, name, category, price, price_50, price_70, price_100, markup');
  const sanitizedName = sanitizeOrderItemName(rawName);
  const lookupCandidates = Array.from(new Set([rawName.trim(), sanitizedName].filter(Boolean)));
  const query = normalizeProductText(sanitizedName || rawName);
  if (!query) return { type: 'not_found' };

  for (const lookupName of lookupCandidates) {
    const { data: exactRows } = await makeProductsQuery()
      .ilike('name', lookupName)
      .limit(10);

    const exact = (exactRows as ProductRow[] | null) ?? [];
    if (exact.length === 1) return { type: 'match', product: exact[0] };

    if (exact.length > 1) {
      if (targetPrice) {
        const match = exact.find((product) => {
          const prices = [product.price, product.price_50, product.price_70, product.price_100].filter((value) => value != null);
          return prices.some((price) => Math.abs(price - targetPrice) < 0.01);
        });
        if (match) return { type: 'match', product: match };
      }

      const sorted = exact.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
      return { type: 'match', product: sorted[0] };
    }
  }

  const candidateMap = new Map<string, ProductRow>();
  for (const lookupName of lookupCandidates) {
    const { data: fuzzyRows } = await makeProductsQuery()
      .ilike('name', `%${lookupName}%`)
      .limit(12);

    for (const candidate of (fuzzyRows as ProductRow[] | null) ?? []) {
      candidateMap.set(candidate.id, candidate);
    }
  }

  const candidates = Array.from(candidateMap.values());
  if (!candidates.length) return { type: 'not_found' };

  const ranked = candidates
    .map((product) => ({
      product,
      score: scoreProductName(normalizeProductText(product.name), query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name, 'ro'));

  if (!ranked.length || ranked[0].score < 50) return { type: 'not_found' };
  if (ranked.length > 1 && ranked[0].score - ranked[1].score <= 5) {
    return { type: 'ambiguous', candidates: ranked.slice(0, 3).map((entry) => entry.product.name) };
  }

  return { type: 'match', product: ranked[0].product };
}

export async function resolveOrderItems(
  sb: InventoryQueryableClient,
  items: Array<{ product_id?: string; name: string; qty: number; unit_price?: number }>,
): Promise<{ items: Array<{ product_id: string; name: string; qty: number; unit_price: number }>; totalPrice: number }> {
  const stockMovementsTable = sb.from('stock_movements') as StockMovementsQuery;
  const resolvedItems: Array<{ product_id: string; name: string; qty: number; unit_price: number }> = [];

  for (const item of items ?? []) {
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
    const name = String(item.name ?? '').trim();
    if (!name) continue;

    const match = item.product_id
      ? await resolveProductById(sb, item.product_id)
      : await resolveProductByName(sb, name, item.unit_price);

    if (match.type === 'not_found') throw new Error(`NOT_FOUND_ITEM:${name}`);
    if (match.type === 'ambiguous') throw new Error(`AMBIGUOUS_ITEM:${name}|${match.candidates.join(', ')}`);

    const product = match.product;
    const unit = getStorePrice(product);
    if (unit == null) throw new Error(`Missing price for item: ${product.name}`);

    resolvedItems.push({
      product_id: product.id,
      name: product.name,
      qty,
      unit_price: Number(unit.toFixed(2)),
    });
  }

  if (!resolvedItems.length) throw new Error('No valid items');

  const ids = resolvedItems.map((item) => item.product_id);
  const { data: movements } = await stockMovementsTable.select('product_id, quantity').in('product_id', ids);

  const stockMap: Record<string, number> = {};
  for (const movement of (movements ?? []) as MovementRow[]) {
    stockMap[movement.product_id] = (stockMap[movement.product_id] ?? 0) + movement.quantity;
  }

  for (const item of resolvedItems) {
    const stock = stockMap[item.product_id] ?? 0;
    if (stock < item.qty) throw new Error(`OUT_OF_STOCK_ITEM:${item.name}`);
  }

  const totalPrice = resolvedItems.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  return { items: resolvedItems, totalPrice: Number(totalPrice.toFixed(2)) };
}

export async function getInventorySummary(
  sb: InventoryQueryableClient,
  args: { intent: IncomingIntent; text: string; candidatesOverride?: string[] },
): Promise<string> {
  const makeProductsQuery = () => (sb.from('products') as ProductsQuery)
    .select('id, created_at, name, category, price, price_50, price_70, price_100, markup');
  const stockMovementsTable = sb.from('stock_movements') as StockMovementsQuery;

  if (args.intent === 'browse_inventory') {
    const { data: allProducts } = await makeProductsQuery()
      .order('category', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .limit(200);

    if (!allProducts?.length) {
      console.error('[whatsapp] getInventorySummary: no products returned from Supabase (intent=browse_inventory)');
      return 'Inventar indisponibil.';
    }

    const byCategory: Record<string, ProductRow[]> = {};
    for (const product of allProducts as ProductRow[]) {
      const category = product.category ?? 'Altele';
      if (!byCategory[category]) byCategory[category] = [];
      if (byCategory[category].length < 5) byCategory[category].push(product);
    }

    const sampled: ProductRow[] = [];
    for (const rows of Object.values(byCategory)) {
      sampled.push(...rows);
      if (sampled.length >= 40) break;
    }

    const ids = sampled.map((product) => product.id);
    const { data: movements } = await stockMovementsTable.select('product_id, quantity').in('product_id', ids);

    const stockMap: Record<string, number> = {};
    for (const movement of (movements ?? []) as MovementRow[]) {
      stockMap[movement.product_id] = (stockMap[movement.product_id] ?? 0) + movement.quantity;
    }

    const lines: string[] = [];
    for (const [category, rows] of Object.entries(byCategory)) {
      lines.push(`${category}:`);
      for (const product of rows) {
        const stock = stockMap[product.id] ?? 0;
        const storePrice = getStorePrice(product);
        const price = storePrice != null ? `€${storePrice.toFixed(2)}` : 'preț nedefinit';
        const availability = stock > 0 ? `stoc: ${stock}` : 'indisponibil';
        lines.push(`  • ${product.name} — ${price}, ${availability}`);
      }
    }

    return lines.join('\n');
  }

  const candidates = args.candidatesOverride ?? extractSearchCandidates(args.text);

  let products: unknown[] | null | undefined;
  if (candidates.length) {
    for (const term of candidates) {
      const { data } = await makeProductsQuery().ilike('name', `%${term}%`).limit(20);
      if (data?.length) {
        products = data as unknown[];
        break;
      }
    }
  }

  if (!products?.length) {
    const { data } = await makeProductsQuery().order('name', { ascending: true }).limit(20);
    products = data as unknown[] | null | undefined;
  }

  if (!products?.length) {
    console.error('[whatsapp] getInventorySummary: no products returned from Supabase (intent=%s candidates=%j)', args.intent, candidates);
    return 'Inventar indisponibil.';
  }

  const rows = products as ProductRow[];
  const ids = rows.map((product) => product.id);
  const { data: movements } = await stockMovementsTable.select('product_id, quantity').in('product_id', ids);

  const stockMap: Record<string, number> = {};
  for (const movement of (movements ?? []) as MovementRow[]) {
    stockMap[movement.product_id] = (stockMap[movement.product_id] ?? 0) + movement.quantity;
  }

  let alternatives: ProductRow[] = [];
  if (rows[0]) {
    const first = rows[0];
    const firstStock = stockMap[first.id] ?? 0;
    if (firstStock <= 0 && first.category) {
      const { data: sameCategory } = await makeProductsQuery().eq('category', first.category).limit(25);
      const candidateIds = ((sameCategory ?? []) as Array<{ id: string }>).map((product) => product.id);
      const { data: altMovements } = candidateIds.length
        ? await stockMovementsTable.select('product_id, quantity').in('product_id', candidateIds)
        : { data: [] as unknown[] };

      const altStockMap: Record<string, number> = {};
      for (const movement of (altMovements ?? []) as MovementRow[]) {
        altStockMap[movement.product_id] = (altStockMap[movement.product_id] ?? 0) + movement.quantity;
      }

      alternatives = ((sameCategory as ProductRow[] | null) ?? [])
        .filter((product) => product.id !== first.id)
        .filter((product) => (altStockMap[product.id] ?? 0) > 0)
        .slice(0, 3);
    }
  }

  const lines = rows.map((product) => {
    const stock = stockMap[product.id] ?? 0;
    const storePrice = getStorePrice(product);
    const price = storePrice != null ? `€${storePrice.toFixed(2)}` : 'preț nedefinit';
    const availability = stock > 0 ? `stoc: ${stock}` : 'indisponibil';
    const category = product.category ? ` (${product.category})` : '';
    return `• ${product.name}${category} — ${price}, ${availability}`;
  });

  if (alternatives.length) {
    lines.push('Alternative (în stoc):');
    for (const product of alternatives) {
      const storePrice = getStorePrice(product);
      const price = storePrice != null ? `€${storePrice.toFixed(2)}` : 'preț nedefinit';
      lines.push(`• ${product.name} — ${price}`);
    }
  }

  return lines.join('\n');
}
