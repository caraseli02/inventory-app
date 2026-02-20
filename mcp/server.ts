import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');

const PRODUCTS_URI = 'ui://inventory/products-table.html';
const PRODUCT_CARD_URI = 'ui://inventory/product-card.html';

// Node.js Supabase client — uses process.env (not import.meta.env)
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment');
  }
  return createClient(url, key);
}

interface ProductRow {
  id: string;
  name: string;
  barcode: string | null;
  category: string | null;
  price: number | null;
  supplier: string | null;
  min_stock_level: number | null;
}

interface MovementRow {
  product_id: string;
  quantity: number;
}

async function fetchAllProducts() {
  const sb = getSupabase();

  const [{ data: products, error: pErr }, { data: movements, error: mErr }] =
    await Promise.all([
      sb.from('products').select('id, name, barcode, category, price, supplier, min_stock_level'),
      sb.from('stock_movements').select('product_id, quantity'),
    ]);

  if (pErr) throw new Error(`Products fetch failed: ${pErr.message}`);
  if (mErr) throw new Error(`Movements fetch failed: ${mErr.message}`);

  // Build stock map
  const stockMap: Record<string, number> = {};
  for (const m of (movements ?? []) as MovementRow[]) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + m.quantity;
  }

  return ((products ?? []) as ProductRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode ?? undefined,
    category: p.category ?? undefined,
    price: p.price ?? undefined,
    supplier: p.supplier ?? undefined,
    minStock: p.min_stock_level ?? undefined,
    currentStock: stockMap[p.id] ?? 0,
  }));
}

async function readHtml(uri: string) {
  const html = await fs.readFile(path.join(DIST_DIR, 'mcp-app.html'), 'utf-8');
  return { contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'Inventory App', version: '1.0.0' });

  registerAppTool(
    server,
    'list_all_products',
    {
      title: 'List All Products',
      description:
        'Returns all inventory products with current stock levels, prices, and categories.',
      _meta: { ui: { resourceUri: PRODUCTS_URI } },
    },
    async () => {
      const products = await fetchAllProducts();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ tool: 'list_all_products', products }),
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    'find_product_by_name',
    {
      title: 'Find Product by Name',
      description:
        'Search inventory products by name (case-insensitive substring match).',
      inputSchema: {
        name: z.string().describe('Search term to match against product names'),
      },
      _meta: { ui: { resourceUri: PRODUCT_CARD_URI } },
    },
    async ({ name }) => {
      const all = await fetchAllProducts();
      const matches = all.filter((p) =>
        p.name?.toLowerCase().includes(name.toLowerCase()),
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ tool: 'find_product_by_name', query: name, products: matches }),
          },
        ],
      };
    },
  );

  registerAppResource(
    server,
    'Products Table',
    PRODUCTS_URI,
    {},
    () => readHtml(PRODUCTS_URI),
  );

  registerAppResource(
    server,
    'Product Card',
    PRODUCT_CARD_URI,
    {},
    () => readHtml(PRODUCT_CARD_URI),
  );

  return server;
}
