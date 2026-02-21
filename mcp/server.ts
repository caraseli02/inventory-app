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

// Validate env vars at startup — fail fast instead of on first tool call.
// VITE_ prefix is used here for consistency with the shared .env file;
// process.env doesn't filter by prefix so these work fine in Node.js.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'ERROR: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars. Exiting.',
  );
  process.exit(1);
}

// Single Supabase client instance — reused across all tool calls.
// Matches the singleton pattern in src/lib/supabase.ts.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// HTML asset for the MCP UI widget — read once, reused for all resource requests.
let htmlCache: string | null = null;
async function getHtml(): Promise<string> {
  if (!htmlCache) {
    htmlCache = await fs.readFile(path.join(DIST_DIR, 'mcp-app.html'), 'utf-8');
  }
  return htmlCache;
}

// Columns fetched from the product_stock view (aggregates stock_movements server-side).
const PRODUCT_SELECT =
  'id, name, barcode, category, price, supplier, min_stock_level, current_stock_level';

interface ProductStockRow {
  id: string;
  name: string;
  barcode: string | null;
  category: string | null;
  price: number | null;
  supplier: string | null;
  min_stock_level: number | null;
  current_stock_level: number;
}

interface MappedProduct {
  id: string;
  name: string;
  barcode?: string;
  category?: string;
  price?: number;
  supplier?: string;
  minStock?: number;
  currentStock: number;
}

function mapRow(row: ProductStockRow): MappedProduct {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode ?? undefined,
    category: row.category ?? undefined,
    price: row.price ?? undefined,
    supplier: row.supplier ?? undefined,
    minStock: row.min_stock_level ?? undefined,
    currentStock: row.current_stock_level,
  };
}

function jsonContent(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function makeHtmlResource(uri: string) {
  // Both resources serve the same single-file HTML bundle.
  // The React app inside uses the `tool` field in JSON data to switch views.
  return async () => {
    const html = await getHtml();
    return { contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
  };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'Inventory App', version: '1.0.0' });

  // ── list_all_products ────────────────────────────────────────────────────
  registerAppTool(
    server,
    'list_all_products',
    {
      title: 'List All Products',
      description:
        'Returns up to 200 inventory products. Fields: id, name, barcode, category, price (EUR), supplier, minStock, currentStock. Supports optional category filter and low-stock filter.',
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe('Filter by category (e.g. "Dairy", "Produce"). Omit for all categories.'),
        low_stock_only: z
          .boolean()
          .optional()
          .describe('If true, return only products at or below their min stock level.'),
      },
      _meta: { ui: { resourceUri: PRODUCTS_URI } },
    },
    async ({ category, low_stock_only }) => {
      const base = supabase.from('product_stock').select(PRODUCT_SELECT).limit(200);
      const { data, error } = await (category ? base.eq('category', category) : base);
      if (error) throw new Error(`Products fetch failed: ${error.message}`);

      let products = ((data ?? []) as ProductStockRow[]).map(mapRow);
      if (low_stock_only) {
        products = products.filter((p) => p.minStock != null && p.currentStock <= p.minStock);
      }
      return jsonContent({ tool: 'list_all_products', total: products.length, products });
    },
  );

  // ── find_product_by_name ─────────────────────────────────────────────────
  registerAppTool(
    server,
    'find_product_by_name',
    {
      title: 'Find Product by Name',
      description:
        'Search inventory by product name (case-insensitive substring match). Fields: id, name, barcode, category, price (EUR), supplier, minStock, currentStock.',
      inputSchema: {
        name: z
          .string()
          .min(1)
          .max(200)
          .describe('Search term to match against product names'),
      },
      _meta: { ui: { resourceUri: PRODUCT_CARD_URI } },
    },
    async ({ name }) => {
      const { data, error } = await supabase
        .from('product_stock')
        .select(PRODUCT_SELECT)
        .ilike('name', `%${name}%`)
        .limit(50);
      if (error) throw new Error(`Name search failed: ${error.message}`);
      return jsonContent({
        tool: 'find_product_by_name',
        query: name,
        products: ((data ?? []) as ProductStockRow[]).map(mapRow),
      });
    },
  );

  // ── find_product_by_barcode ──────────────────────────────────────────────
  registerAppTool(
    server,
    'find_product_by_barcode',
    {
      title: 'Find Product by Barcode',
      description:
        'Look up an inventory product by exact barcode (UPC, EAN-13, etc.). Fields: id, name, barcode, category, price (EUR), supplier, minStock, currentStock.',
      inputSchema: {
        barcode: z.string().min(1).max(100).describe('Exact barcode string'),
      },
      _meta: { ui: { resourceUri: PRODUCT_CARD_URI } },
    },
    async ({ barcode }) => {
      const { data, error } = await supabase
        .from('product_stock')
        .select(PRODUCT_SELECT)
        .eq('barcode', barcode)
        .maybeSingle();
      if (error) throw new Error(`Barcode lookup failed: ${error.message}`);
      return jsonContent({
        tool: 'find_product_by_barcode',
        query: barcode,
        products: data ? [mapRow(data as ProductStockRow)] : [],
      });
    },
  );

  // ── add_stock_movement ───────────────────────────────────────────────────
  // Write tools use server.tool() (no UI widget needed — result is plain JSON for Claude to read).
  server.tool(
    'add_stock_movement',
    'Record a stock IN or OUT movement for a product. Updates the product\'s current stock level.',
    {
      product_id: z
        .string()
        .uuid()
        .describe('Product ID (from list_all_products or find_product_by_name)'),
      quantity: z.number().int().positive().describe('Number of units (always positive)'),
      type: z.enum(['IN', 'OUT']).describe('IN to add stock, OUT to remove stock'),
      note: z.string().max(500).optional().describe('Optional note for this movement'),
    },
    async ({ product_id, quantity, type, note }) => {
      const signedQty = type === 'OUT' ? -quantity : quantity;
      const { error } = await supabase.from('stock_movements').insert({
        product_id,
        quantity: signedQty,
        type,
        date: new Date().toISOString().slice(0, 10),
        note: note ?? null,
      });
      if (error) throw new Error(`Stock movement failed: ${error.message}`);
      return jsonContent({ tool: 'add_stock_movement', success: true, product_id, quantity, type });
    },
  );

  // ── get_stock_history ────────────────────────────────────────────────────
  server.tool(
    'get_stock_history',
    'Returns recent stock movements for a product. Fields: quantity, type (IN/OUT), date, note.',
    {
      product_id: z.string().uuid().describe('Product ID'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe('Number of recent movements to return (max 50, default 20)'),
    },
    async ({ product_id, limit }) => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('quantity, type, date, note')
        .eq('product_id', product_id)
        .order('date', { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Stock history failed: ${error.message}`);
      return jsonContent({ tool: 'get_stock_history', product_id, movements: data ?? [] });
    },
  );

  // ── Resources ─────────────────────────────────────────────────────────────
  registerAppResource(server, 'Products Table', PRODUCTS_URI, {}, makeHtmlResource(PRODUCTS_URI));
  registerAppResource(server, 'Product Card', PRODUCT_CARD_URI, {}, makeHtmlResource(PRODUCT_CARD_URI));

  return server;
}
