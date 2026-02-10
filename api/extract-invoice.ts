import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function resolveExtractUrl(): string | null {
  const configuredBaseUrl = process.env.INVOICE_API_URL || process.env.VITE_INVOICE_API_URL;
  if (!configuredBaseUrl) {
    return null;
  }

  if (configuredBaseUrl.endsWith('/extract')) {
    return configuredBaseUrl;
  }

  return `${configuredBaseUrl.replace(/\/$/, '')}/extract`;
}

function readBearerToken(req: VercelRequest): string | null {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
}

function isAuthRequired(): boolean {
  return process.env.INVOICE_PROXY_REQUIRE_AUTH !== 'false';
}

function createSupabaseAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const extractUrl = resolveExtractUrl();
  const apiKey = process.env.INVOICE_API_KEY;

  if (!extractUrl) {
    return res.status(500).json({ error: 'Missing INVOICE_API_URL server configuration' });
  }

  if (isAuthRequired()) {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    const supabase = createSupabaseAuthClient();
    if (!supabase) {
      return res.status(500).json({ error: 'Missing Supabase auth configuration for invoice proxy' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }
  }

  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Expected multipart/form-data request' });
  }

  const contentLengthHeader = req.headers['content-length'];
  const contentLength = typeof contentLengthHeader === 'string' ? Number(contentLengthHeader) : NaN;
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE_BYTES) {
    return res.status(413).json({ error: 'File size exceeds 10MB limit. Please upload a smaller file.' });
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      Accept: 'application/json',
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const upstreamResponse = await fetch(
      extractUrl,
      {
        method: 'POST',
        headers,
        body: req as unknown as BodyInit,
        // Required by Node.js fetch for streaming request bodies.
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }
    );

    const responseText = await upstreamResponse.text();
    const upstreamContentType = upstreamResponse.headers.get('content-type') || 'application/json';

    res.status(upstreamResponse.status);
    res.setHeader('Content-Type', upstreamContentType);
    return res.send(responseText);
  } catch (error) {
    console.error('Invoice proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ error: `Invoice extraction proxy failed: ${errorMessage}` });
  }
}
