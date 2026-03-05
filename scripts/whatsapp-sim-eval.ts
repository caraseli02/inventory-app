import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';

type Args = {
  baseUrl: string;
  mode: 'direct' | 'agent';
  cleanup: boolean;
  phone: string;
  name: string;
  secret: string;
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

async function pickInStockProductName(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data: products, error } = await sb
    .from('products')
    .select('id, name, price, price_50, price_70, price_100, markup')
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) throw new Error(`Supabase products query failed: ${error.message}`);
  const rows = (products as ProductRow[] | null) ?? [];
  if (!rows.length) throw new Error('No products found in Supabase');

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

  for (const p of rows) {
    const stock = stockMap[p.id] ?? 0;
    if (stock <= 0) continue;
    if (getStorePrice(p) == null) continue;
    return `${p.id}::${p.name}`;
  }

  throw new Error('No in-stock product with a price found (need stock_movements + price on at least one product)');
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

function parseArgs(argv: string[]): Args {
  const baseUrl = readArg(argv, '--base-url') ?? 'http://localhost:5173';
  const mode = (readArg(argv, '--mode') ?? 'direct') as Args['mode'];
  if (mode !== 'direct' && mode !== 'agent') throw new Error('Invalid --mode (use: direct|agent)');

  const secret = readArg(argv, '--secret')
    ?? process.env.WHATSAPP_SIMULATOR_SECRET
    ?? process.env.VITE_NOTIFY_SECRET
    ?? '';

  const cleanup = !readFlag(argv, '--no-cleanup');
  const phone = readArg(argv, '--phone') ?? '+40000000000';
  const name = readArg(argv, '--name') ?? 'Eval';

  return { baseUrl, mode, cleanup, phone, name, secret };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'agent') {
    requiredEnv('OPENAI_API_KEY');
  }

  const { url, key } = getSupabaseServerEnv();
  const sb = createClient(url, key);

  const picked = await pickInStockProductName(sb);
  const [productId, productName] = picked.split('::');
  if (!productId || !productName) throw new Error('Failed to pick in-stock product');
  const pickupTime = '18:30';

  const orderPayload = {
    customer_name: args.name,
    customer_phone: args.phone,
    items: [{ product_id: productId, name: productName, qty: 1 }],
    pickup_time: pickupTime,
  };

  const simulateUrl = `${args.baseUrl.replace(/\/$/, '')}/api/whatsapp-simulate`;

  await postJson(simulateUrl, args.secret, { phone: args.phone, reset: true });

  const text = args.mode === 'direct'
    ? `ORDER:${JSON.stringify(orderPayload)}`
    : `Vreau 1 ${productName}. Ridicare la ${pickupTime}. Confirm comanda.`;

  const result = await postJson<{ ok: boolean; reply?: string; provider?: string }>(
    simulateUrl,
    args.secret,
    { phone: args.phone, name: args.name, text, mode: args.mode }
  );

  const reply = String(result.reply ?? '');
  const orderNumber = parseOrderNumber(reply);
  if (!orderNumber) {
    throw new Error(`No order number found in reply. Provider=${String(result.provider ?? '')}. Reply:\n${reply}`);
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
    mode: args.mode,
    provider: result.provider ?? null,
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
