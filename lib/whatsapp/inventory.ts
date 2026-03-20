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

export interface ProductSearchResult {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  currentStock: number;
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
    .replace(/\s+[—-]\s*€?\s*\d+(?:[.,]\d{1,2})?\s*$/u, '')
    .replace(/\(([^)]*)\)/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripOrderItemPackaging(rawName: string): string {
  return rawName
    .replace(/^\s*\d+\s*[x×]\s*/i, '')
    .replace(/\s+[—-]\s*€?\s*\d+(?:[.,]\d{1,2})?\s*$/u, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLookupTerms(rawName: string): string[] {
  const normalized = normalizeProductText(rawName);
  if (!normalized) return [];

  return Array.from(new Set(
    normalized
      .split(' ')
      .map((term) => term.trim())
      .filter((term) => term.length >= 4 && /[\p{L}\p{N}]/u.test(term)),
  ));
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
    if (nameTokens.has(token)) {
      overlap += 1;
      continue;
    }

    const partial = Array.from(nameTokens).some((nameToken) => (
      nameToken.startsWith(token) || token.startsWith(nameToken)
    ));
    if (partial) overlap += 0.75;
  }

  return overlap > 0 ? 40 + overlap * 10 : 0;
}

function clampLimit(raw: unknown, fallback: number, max: number): number {
  const num = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(num)));
}

function sanitizeSearchQuery(raw: unknown): string {
  const query = String(raw ?? '')
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!query) return '';
  return query.length > 200 ? query.slice(0, 200) : query;
}

export async function searchProducts(
  sb: InventoryQueryableClient,
  args: { query: string; limit?: number },
): Promise<ProductSearchResult[]> {
  const limit = clampLimit(args.limit, 10, 25);
  const rawQuery = sanitizeSearchQuery(args.query);
  const normalizedQuery = normalizeProductText(rawQuery);
  if (!normalizedQuery) return [];

  const stockMovementsTable = sb.from('stock_movements') as StockMovementsQuery;

  const searchTerms = new Set<string>([rawQuery]);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (tokens.includes('milk')) searchTerms.add('lapte');
  const scoringQuery = normalizeProductText([...searchTerms].join(' ')) || normalizedQuery;

  const candidateMap = new Map<string, ProductRow>();
  for (const term of [...searchTerms].map((value) => value.trim()).filter(Boolean)) {
    const productsTable = sb.from('products') as ProductsQuery;
    const { data: rows } = await productsTable
      .select('id, created_at, name, category, price, price_50, price_70, price_100, markup')
      .ilike('name', `%${term}%`)
      .limit(80);
    for (const row of (rows as ProductRow[] | null) ?? []) {
      candidateMap.set(row.id, row);
    }
  }

  const products = [...candidateMap.values()]
    .map((product) => ({
      product,
      score: scoreProductName(normalizeProductText(product.name), scoringQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return new Date(right.product.created_at).getTime() - new Date(left.product.created_at).getTime();
    });

  const deduped: ProductRow[] = [];
  const seenNames = new Set<string>();
  for (const entry of products) {
    if (seenNames.has(entry.product.name)) continue;
    seenNames.add(entry.product.name);
    deduped.push(entry.product);
    if (deduped.length >= limit) break;
  }

  if (!deduped.length) return [];

  const ids = deduped.map((product) => product.id);
  const { data: movements } = await stockMovementsTable.select('product_id, quantity').in('product_id', ids);

  const stockMap: Record<string, number> = {};
  for (const movement of (movements ?? []) as MovementRow[]) {
    stockMap[movement.product_id] = (stockMap[movement.product_id] ?? 0) + movement.quantity;
  }

  return deduped.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category ?? null,
    price: getStorePrice(product),
    currentStock: stockMap[product.id] ?? 0,
  }));
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
  const strippedName = stripOrderItemPackaging(rawName);
  const lookupCandidates = Array.from(new Set([rawName.trim(), sanitizedName, strippedName].filter(Boolean)));
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

  for (const term of extractLookupTerms(sanitizedName || rawName)) {
    const { data: fuzzyRows } = await makeProductsQuery()
      .ilike('name', `%${term}%`)
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

export async function getDistinctCategories(sb: InventoryQueryableClient): Promise<string[]> {
  const productsTable = sb.from('products') as ProductsQuery;
  const { data } = await productsTable
    .select('category')
    .order('category', { ascending: true })
    .limit(1000);

  if (!data?.length) return [];
  const unique = [...new Set(
    (data as Array<{ category: string | null }>)
      .map((r) => r.category)
      .filter((cat) => cat != null) as string[]
  )];
  return unique.slice(0, 6); // Cap for list-picker template (6 variable slots: product_1..product_6)
}

export async function getProductsByCategory(sb: InventoryQueryableClient, category: string): Promise<string[]> {
  const productsTable = sb.from('products') as ProductsQuery;
  const { data } = await productsTable
    .select('name, price, price_50, price_70, price_100, markup')
    .eq('category', category)
    .order('name', { ascending: true })
    .limit(30);  // Fetch enough to survive duplicates; will filter to 6 distinct names

  if (!data?.length) return [];

  // Group by name, keep cheapest variant per name
  const cheapestByName = new Map<string, { name: string; price: number }>();
  for (const row of data as Array<{ name: string; price: number | null; price_50: number | null; price_70: number | null; price_100: number | null; markup: number | null }>) {
    const storePrice = getStorePrice(row as ProductRow) ?? Infinity;
    const existing = cheapestByName.get(row.name);
    if (!existing || storePrice < existing.price) {
      cheapestByName.set(row.name, { name: row.name, price: storePrice });
    }
  }

  return [...cheapestByName.values()]
    .slice(0, 6)
    .map((entry) => entry.name.substring(0, 60));
}

export async function searchProductNames(
  sb: InventoryQueryableClient,
  args: { candidates: string[]; limit?: number },
): Promise<string[]> {
  const limit = clampLimit(args.limit, 10, 12);
  const makeProductsQuery = () => (sb.from('products') as ProductsQuery)
    .select('name, created_at')
    .order('created_at', { ascending: false });

  let rows: Array<{ name: string; created_at: string }> = [];

  if (args.candidates.length) {
    let best: { rows: Array<{ name: string; created_at: string }>; count: number } | null = null;
    for (const term of args.candidates) {
      const safeTerm = sanitizeSearchQuery(term);
      if (!safeTerm) continue;
      const { data } = await makeProductsQuery().ilike('name', `%${safeTerm}%`).limit(25);
      const hit = ((data as Array<{ name: string; created_at: string }> | null) ?? []);
      if (hit.length === 1) {
        rows = hit;
        break;
      }
      if (hit.length > 1 && (!best || hit.length < best.count)) {
        best = { rows: hit, count: hit.length };
      }
    }
    if (!rows.length && best) rows = best.rows;
  }

  if (!rows.length) {
    const { data } = await (sb.from('products') as ProductsQuery)
      .select('name, created_at')
      .order('name', { ascending: true })
      .limit(30);
    rows = ((data as Array<{ name: string; created_at: string }> | null) ?? []);
  }

  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = String(row.name ?? '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name.substring(0, 60));
    if (names.length >= limit) break;
  }

  return names;
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
    let best: { rows: unknown[]; count: number } | null = null;
    for (const term of candidates) {
      const { data } = await makeProductsQuery().ilike('name', `%${term}%`).limit(20);
      if (data?.length) {
        // Prefer the most selective term (ideally a single unique hit).
        if (data.length === 1) {
          products = data as unknown[];
          break;
        }
        if (!best || data.length < best.count) {
          best = { rows: data as unknown[], count: data.length };
        }
      }
    }
    if (!products && best) {
      products = best.rows;
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
