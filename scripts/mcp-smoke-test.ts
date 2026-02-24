import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

const mcpUrl = process.env.MCP_URL ?? 'http://localhost:3001/mcp';
const secret = process.env.MCP_SECRET;
const toolToCall = process.env.MCP_TOOL ?? 'list_all_products';

const requestInit: RequestInit = secret
  ? { headers: { Authorization: `Bearer ${secret}` } }
  : {};

const client = new Client({ name: 'inventory-app-mcp-smoke', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), { requestInit });

try {
  await client.connect(transport);

  const tools = await client.request({ method: 'tools/list', params: {} }, ListToolsResultSchema);
  const toolNames = tools.tools.map((t) => t.name);
  console.log(`Connected. Tools (${toolNames.length}): ${toolNames.join(', ')}`);

  if (!toolNames.includes(toolToCall)) {
    throw new Error(`Tool not found: ${toolToCall}`);
  }

  // Optional: actually call a tool to verify Supabase creds + function runtime.
  // Set MCP_TOOL to choose tool name.
  const result = await client.request(
    { method: 'tools/call', params: { name: toolToCall, arguments: {} } },
    CallToolResultSchema,
  );
  console.log(`tools/call ok: ${toolToCall}`);
  console.log(JSON.stringify(result, null, 2).slice(0, 4000));
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await transport.close();
}
