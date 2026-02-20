import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import { createServer } from './server.js';

const isStdio = process.argv.includes('--stdio');

if (isStdio) {
  // STDIO transport — used by Claude Desktop
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else {
  // HTTP transport (stateless) — used for remote access
  const PORT = parseInt(process.env.MCP_PORT ?? '3001', 10);
  const SECRET = process.env.MCP_SECRET;

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Optional bearer token auth
  if (SECRET) {
    app.use('/mcp', (req, res, next) => {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${SECRET}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    });
  }

  // Stateless transport — each request pair is independent
  // Suitable for read-only inventory queries
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createServer();
  await server.connect(transport);

  app.post('/mcp', (req, res) => { void transport.handleRequest(req, res, req.body); });
  app.get('/mcp', (_req, res) => { void transport.handleRequest(_req, res); });
  app.delete('/mcp', (_req, res) => { void transport.handleRequest(_req, res); });

  app.listen(PORT, () => {
    console.error(`MCP HTTP server listening on :${PORT}`);
  });
}
