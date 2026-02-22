import 'dotenv/config';
import crypto from 'node:crypto';
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

  const portRaw = parseInt(process.env.MCP_PORT ?? '3001', 10);
  if (!Number.isInteger(portRaw) || portRaw < 1 || portRaw > 65535) {
    console.error(`ERROR: Invalid MCP_PORT "${process.env.MCP_PORT}". Must be 1–65535.`);
    process.exit(1);
  }
  const PORT = portRaw;

  const SECRET = process.env.MCP_SECRET;
  if (!SECRET) {
    console.error('WARNING: MCP_SECRET not set — HTTP server running without authentication.');
  }

  const app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  // Bearer token auth — only enforced when MCP_SECRET is set.
  if (SECRET) {
    app.use('/mcp', (req, res, next) => {
      const auth = req.headers.authorization ?? '';
      const expected = Buffer.from(`Bearer ${SECRET}`);
      const provided = Buffer.from(auth);
      if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    });
  }

  // Stateless transport — each request pair is independent.
  // Suitable for read-only inventory queries; if write tools are used,
  // callers are responsible for compensating on partial failure.
  // Stateless mode: create a fresh transport+server per request so each
  // MCP session is independent (no shared state between requests).
  app.post('/mcp', async (req, res) => {
    // Some clients (e.g. ChatGPT) don't send the Accept header required by
    // StreamableHTTPServerTransport — inject it so the transport doesn't reject with 406.
    req.headers['accept'] = 'application/json, text/event-stream';
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.get('/mcp', async (_req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(_req, res);
  });
  app.delete('/mcp', async (_req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(_req, res);
  });

  app.listen(PORT, () => {
    console.error(`MCP HTTP server listening on :${PORT}`);
  });
}
