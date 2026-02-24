import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from '../mcp/server.js';

const SECRET = process.env.MCP_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — allow any MCP client (Claude, ChatGPT, Codex, etc.)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Bearer token auth — only enforced when MCP_SECRET is set.
  if (SECRET) {
    const auth = (req.headers.authorization ?? '') as string;
    const expected = Buffer.from(`Bearer ${SECRET}`);
    const provided = Buffer.from(auth);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      // Help MCP clients understand auth requirements.
      res.setHeader('WWW-Authenticate', 'Bearer');
      // Add minimal request metadata so Vercel logs can identify who is calling.
      // Never log the secret or Authorization header value.
      console.warn('MCP unauthorized request', {
        method: req.method,
        path: req.url,
        ua: req.headers['user-agent'],
        hasAuthorization: Boolean(req.headers.authorization),
        ip: req.headers['x-forwarded-for'],
      });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  // Inject Accept header for clients (e.g. ChatGPT) that don't send it.
  req.headers['accept'] = 'application/json, text/event-stream';

  // Stateless mode — fresh transport+server per request.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer();
  await server.connect(transport);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await transport.handleRequest(req as any, res as any, req.body);
}
