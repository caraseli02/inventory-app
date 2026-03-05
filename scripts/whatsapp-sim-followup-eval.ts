import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';

type Args = {
  baseUrl: string;
  cleanup: boolean;
  phone: string;
  name: string;
  secret: string;
  term: string;
};

function readArg(args: string[], key: string): string | null {
  const idx = args.indexOf(key);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function readFlag(args: string[], key: string): boolean {
  return args.includes(key);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value) return value;
  throw new Error(`Missing env var: ${name}`);
}

function getSupabaseServerEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_ANON_KEY
    ?? process.env.VITE_SUPABASE_ANON_KEY
    ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? '';

  if (!url || !key) {
    throw new Error('Missing Supabase env vars (SUPABASE_URL + SUPABASE_ANON_KEY, or VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)');
  }

  return { url, key };
}

type ProductRow = {
  id: string;
  name: string;
  price: number | null;
  price_50: number | null;
  price_70: number | null;
  price_100: number | null;
  markup: number | null;
};

type MovementRow = { product_id: string; quantity: number };

function getStorePrice(p: ProductRow): number | null {
  const tier = (p.markup as 50 | 70 | 100) || 70;
  if (tier === 50) return p.price_50 ?? p.price;
  if (tier === 100) return p.price_100 ?? p.price;
  return p.price_70 ?? p.price;
}

async function pickInStockNamesByTerm(
  sb: ReturnType<typeof createClient>,
  term: string
): Promise<string[]> {
  const { data: products, error } = await sb
    .from('products')
    .select('id, name, price, price_50, price_70, price_100, markup')
    .ilike('name', `%${term}%`)
    .limit(30);

  if (error) throw new Error(`Supabase products query failed: ${error.message}`);
  const rows = (products as ProductRow[] | null) ?? [];
  if (!rows.length) return [];

  const ids = rows.map((p) => p.id);
  const { data: movements, error: moveError } = await sb
    .from('stock_movements')
    .select('product_id, quantity')
    .in('product_id', ids);
  if (moveError) throw new Error(`Supabase stock_movements query failed: ${moveError.message}`);

  const stockMap: Record<string, number> = {};
  for (const m of (movements as MovementRow[] | null) ?? []) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + m.quantity;
  }

  return rows
    .filter((p) => (stockMap[p.id] ?? 0) > 0)
    .filter((p) => getStorePrice(p) != null)
    .map((p) => p.name)
    .slice(0, 3);
}

async function postJson<T>(
  url: string,
  secret: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-notify-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json()) as T;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function parseOrderNumber(reply: string): string | null {
  const m = reply.match(/Comanda\s+([A-Z0-9-]+)/i);
  return m?.[1] ?? null;
}

function extractMenuOptions(reply: string): string[] {
  const lines = reply.split('\n').map((l) => l.trim()).filter(Boolean);
  const options: Array<{ idx: number; name: string }> = [];
  for (const line of lines) {
    const m = line.match(/^(\d)\)\s+(.*)$/);
    if (!m) continue;
    const idx = Number(m[1]);
    const name = String(m[2] ?? '').trim();
    if (!name) continue;
    options.push({ idx, name });
  }
  options.sort((a, b) => a.idx - b.idx);
  return options.map((o) => o.name);
}

function parseArgs(argv: string[]): Args {
  const baseUrl = readArg(argv, '--base-url') ?? 'http://localhost:5173';
  const secret = readArg(argv, '--secret')
    ?? process.env.WHATSAPP_SIMULATOR_SECRET
    ?? process.env.VITE_NOTIFY_SECRET
    ?? '';

  const cleanup = !readFlag(argv, '--no-cleanup');
  const phone = readArg(argv, '--phone') ?? '+40000000000';
  const name = readArg(argv, '--name') ?? 'Eval';
  const term = readArg(argv, '--term') ?? 'lapte';

  return { baseUrl, cleanup, phone, name, secret, term };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  requiredEnv('OPENAI_API_KEY');

  const { url, key } = getSupabaseServerEnv();
  const sb = createClient(url, key);

  const names = await pickInStockNamesByTerm(sb, args.term);
  if (names.length < 2) {
    throw new Error(`Need >=2 in-stock products matching term="${args.term}" to run followup eval. Found: ${names.length}`);
  }

  const simulateUrl = `${args.baseUrl.replace(/\/$/, '')}/api/whatsapp-simulate`;

  await postJson(simulateUrl, args.secret, { phone: args.phone, reset: true });

  await postJson(simulateUrl, args.secret, {
    phone: args.phone,
    name: args.name,
    text: `aveti ${args.term}?`,
    mode: 'agent',
    debug: true,
  });

  const followup = await postJson<{ ok: boolean; reply?: string; provider?: string }>(simulateUrl, args.secret, {
    phone: args.phone,
    name: args.name,
    text: 'da 2, sa ridic la 18.30',
    mode: 'agent',
    debug: true,
  });

  const menuReply = String(followup.reply ?? '');
  const menuOptions = extractMenuOptions(menuReply);
  if (menuOptions.length < 2) {
    throw new Error(`Expected a menu with options. Provider=${String(followup.provider ?? '')}. Reply:\n${menuReply}`);
  }

  const confirm = await postJson<{ ok: boolean; reply?: string; provider?: string }>(simulateUrl, args.secret, {
    phone: args.phone,
    name: args.name,
    text: '1',
    mode: 'agent',
    debug: true,
  });

  const confirmReply = String(confirm.reply ?? '');
  const orderNumber = parseOrderNumber(confirmReply);
  if (!orderNumber) {
    throw new Error(`No order number found in reply. Provider=${String(confirm.provider ?? '')}. Reply:\n${confirmReply}`);
  }

  const { data: order, error } = await sb
    .from('orders')
    .select('id, order_number, customer_phone, status, items, total_price')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) throw new Error(`Supabase orders lookup failed: ${error.message}`);
  if (!order) throw new Error(`Order not found in DB: ${orderNumber}`);

  console.log(JSON.stringify({
    ok: true,
    scenario: 'followup_menu_selection',
    provider: confirm.provider ?? null,
    order_number: order.order_number,
    status: order.status,
    customer_phone: order.customer_phone,
    total_price: order.total_price,
  }, null, 2));

  if (args.cleanup) {
    const { error: delError } = await sb
      .from('orders')
      .delete()
      .eq('id', order.id);
    if (delError) {
      console.warn(`Cleanup failed (order left in DB): ${delError.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

