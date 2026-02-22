# MCP Server Setup

Exposes inventory tools to Claude Desktop and Claude.ai via the Model Context Protocol.

## Tools

| Tool | Description |
|------|-------------|
| `list_all_products` | Returns all products with current stock levels, prices, categories |
| `find_product_by_name` | Searches products by name (case-insensitive substring match) |

Both tools render an interactive UI (products table or card list) in Claude.

## Prerequisites

- Supabase backend configured (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env`)
- Node.js 18+

## Build

```bash
pnpm mcp:build
```

Outputs `mcp/dist/mcp-app.html` — single-file React UI bundled by Vite.

## Claude Desktop (STDIO)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "inventory-app": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/inventory-app/mcp/main.ts", "--stdio"],
      "env": {
        "VITE_SUPABASE_URL": "https://your-project.supabase.co",
        "VITE_SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

Or using pnpm:

```json
{
  "mcpServers": {
    "inventory-app": {
      "command": "pnpm",
      "args": ["--prefix", "/absolute/path/to/inventory-app", "mcp:stdio"],
      "env": {
        "VITE_SUPABASE_URL": "https://your-project.supabase.co",
        "VITE_SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

## HTTP Server

```bash
# Optional: set auth token and port
MCP_SECRET=your-secret MCP_PORT=3001 pnpm mcp:serve
```

Endpoints:
- `POST /mcp` — MCP requests
- `GET /mcp` — SSE stream
- `DELETE /mcp` — session teardown

## Architecture

```
mcp/
├── server.ts         # McpServer — tool + resource registration
├── main.ts           # Transport: STDIO (--stdio flag) or HTTP (default)
├── mcp-app.html      # Vite HTML entry
├── vite.config.ts    # Vite config: vite-plugin-singlefile output
├── tsconfig.server.json
└── src/
    └── mcp-app.tsx   # React client: useApp hook, renders product data
```

The server queries Supabase directly via `process.env` (not `import.meta.env`) so it works in Node.js without Vite.
