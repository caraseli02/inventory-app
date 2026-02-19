/**
 * Claude Chat Assistant
 *
 * Calls the Anthropic Messages API directly from the browser using tool use.
 * Claude can perform inventory operations on behalf of the grocery owner
 * through natural language.
 *
 * Required env var: VITE_ANTHROPIC_API_KEY
 * Model: claude-3-5-sonnet-20241022 (change to haiku for lower cost)
 */

import {
  getAllProducts,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  addStockMovement,
  getStockMovements,
} from '@/lib/api-provider';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-3-5-sonnet-20241022';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are a helpful inventory assistant for a small grocery store. You speak the same language as the user (detect it from their messages).

You can help the owner:
- View all products and stock levels
- Find a product by barcode
- Add new products to the inventory
- Update product details (name, price, category, supplier)
- Add or remove stock (record IN/OUT movements)
- View stock movement history
- Delete products (always confirm before doing this)

Guidelines:
- Be concise and friendly
- Display product lists in a clean readable format (use product name, stock level, price)
- When listing products, show: Name | Stock: X | Price: €Y
- Always confirm destructive actions (delete) before executing
- If the user seems to want to delete something, ask "Are you sure you want to delete [product name]?" first
- When showing prices, use €X.XX format
- If no API key is configured, explain how to set it up`;

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'list_all_products',
    description: 'Get all products in the inventory with their current stock levels and prices. Use this to show the user their inventory.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'find_product_by_barcode',
    description: 'Find a specific product by its barcode.',
    input_schema: {
      type: 'object' as const,
      properties: {
        barcode: { type: 'string', description: 'The barcode to search for' },
      },
      required: ['barcode'],
    },
  },
  {
    name: 'create_product',
    description: 'Create a new product in the inventory.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Product name (required)' },
        barcode: { type: 'string', description: 'Product barcode (optional, can be added later)' },
        category: { type: 'string', description: 'Category (e.g., Beverages, Snacks, Dairy, Produce, Meat, Household, General)' },
        price: { type: 'number', description: 'Selling price in EUR' },
        min_stock_level: { type: 'number', description: 'Minimum stock level before low-stock alert triggers' },
        supplier: { type: 'string', description: 'Supplier name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_product',
    description: 'Update details of an existing product. Provide only the fields to change.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'string', description: 'The product ID (get it from list_all_products or find_product_by_barcode)' },
        name: { type: 'string', description: 'New product name' },
        price: { type: 'number', description: 'New price in EUR' },
        category: { type: 'string', description: 'New category' },
        min_stock_level: { type: 'number', description: 'New minimum stock level' },
        supplier: { type: 'string', description: 'New supplier name' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'add_stock',
    description: 'Add stock units to a product (records a stock IN movement). Use when new items arrive.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'string', description: 'Product ID' },
        quantity: { type: 'number', description: 'Number of units to add (must be positive)' },
      },
      required: ['product_id', 'quantity'],
    },
  },
  {
    name: 'remove_stock',
    description: 'Remove stock units from a product (records a stock OUT movement). Use for sales or waste.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'string', description: 'Product ID' },
        quantity: { type: 'number', description: 'Number of units to remove (must be positive)' },
      },
      required: ['product_id', 'quantity'],
    },
  },
  {
    name: 'get_stock_history',
    description: 'Get the recent stock movement history for a product.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'string', description: 'Product ID' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'delete_product',
    description: 'Permanently delete a product from the inventory. Only call this after the user has explicitly confirmed the deletion.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'string', description: 'Product ID to delete' },
      },
      required: ['product_id'],
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'list_all_products': {
        const products = await getAllProducts();
        if (products.length === 0) return 'No products found in the inventory.';
        const lines = products.map((p) => {
          const stock = p.fields['Current Stock'] ?? 0;
          const price = p.fields.Price != null ? `€${p.fields.Price.toFixed(2)}` : 'no price';
          const category = p.fields.Category ?? 'General';
          return `• ${p.fields.Name} (ID: ${p.id}) | Stock: ${stock} | ${price} | ${category}`;
        });
        return `Found ${products.length} product(s):\n${lines.join('\n')}`;
      }

      case 'find_product_by_barcode': {
        const product = await getProductByBarcode(input.barcode as string);
        if (!product) return `No product found with barcode "${input.barcode}".`;
        const stock = product.fields['Current Stock'] ?? 0;
        const price = product.fields.Price != null ? `€${product.fields.Price.toFixed(2)}` : 'no price';
        return `Found: ${product.fields.Name} (ID: ${product.id}) | Stock: ${stock} | ${price} | Category: ${product.fields.Category ?? 'General'}`;
      }

      case 'create_product': {
        const created = await createProduct({
          Name: input.name as string,
          ...(input.barcode && { Barcode: input.barcode as string }),
          ...(input.category && { Category: input.category as string }),
          ...(input.price != null && { Price: input.price as number }),
          ...(input.min_stock_level != null && { 'Min Stock Level': input.min_stock_level as number }),
          ...(input.supplier && { Supplier: input.supplier as string }),
        });
        return `Product created: "${created.fields.Name}" (ID: ${created.id})`;
      }

      case 'update_product': {
        const updated = await updateProduct(input.product_id as string, {
          ...(input.name && { Name: input.name as string }),
          ...(input.price != null && { Price: input.price as number }),
          ...(input.category && { Category: input.category as string }),
          ...(input.min_stock_level != null && { 'Min Stock Level': input.min_stock_level as number }),
          ...(input.supplier && { Supplier: input.supplier as string }),
        });
        return `Product updated: "${updated.fields.Name}"`;
      }

      case 'add_stock': {
        await addStockMovement(input.product_id as string, input.quantity as number, 'IN');
        return `Added ${input.quantity} unit(s) to stock.`;
      }

      case 'remove_stock': {
        await addStockMovement(input.product_id as string, input.quantity as number, 'OUT');
        return `Removed ${input.quantity} unit(s) from stock.`;
      }

      case 'get_stock_history': {
        const movements = await getStockMovements(input.product_id as string);
        if (movements.length === 0) return 'No stock movements found for this product.';
        const lines = movements.slice(0, 10).map((m) => {
          const qty = m.fields.Quantity;
          const type = m.fields.Type;
          const date = m.fields.Date ? new Date(m.fields.Date).toLocaleDateString() : 'unknown date';
          return `• ${type} ${Math.abs(qty)} unit(s) on ${date}`;
        });
        return `Recent movements:\n${lines.join('\n')}`;
      }

      case 'delete_product': {
        await deleteProduct(input.product_id as string);
        return 'Product deleted successfully.';
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ─── Anthropic API types ──────────────────────────────────────────────────────

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicResponse {
  content: ContentBlock[];
  stop_reason: string;
}

// ─── Main chat function ───────────────────────────────────────────────────────

/**
 * Send conversation history to Claude and get a response.
 * Automatically executes any tool calls Claude makes.
 */
export async function processChat(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  if (!API_KEY) {
    return [
      'Chat assistant not configured.',
      '',
      'Add your Anthropic API key to get started:',
      '1. Get a free key at https://console.anthropic.com',
      '2. Add `VITE_ANTHROPIC_API_KEY=your-key` to your `.env` file',
      '3. Restart the dev server',
    ].join('\n');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: Array<{ role: string; content: any }> = conversationHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop: keep going until Claude returns a text-only response
  for (let i = 0; i < 10; i++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as AnthropicResponse;

    if (data.stop_reason === 'tool_use') {
      // Add Claude's tool-call message to history
      messages.push({ role: 'assistant', content: data.content });

      // Execute each tool call and collect results
      const toolResults = await Promise.all(
        data.content
          .filter((b) => b.type === 'tool_use')
          .map(async (b) => ({
            type: 'tool_result',
            tool_use_id: b.id!,
            content: await executeTool(b.name!, b.input ?? {}),
          })),
      );

      messages.push({ role: 'user', content: toolResults });
    } else {
      // Claude is done — extract the text response
      const textBlock = data.content.find((b) => b.type === 'text');
      return textBlock?.text ?? 'No response received.';
    }
  }

  return 'The assistant took too many steps. Please try again.';
}
