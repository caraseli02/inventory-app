import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { VercelRequest } from '@vercel/node';

import { getAbsoluteUrl } from '../../../api/whatsapp/url.js';

function makeReq(args: { url?: string; headers?: Record<string, string> }): VercelRequest {
  return {
    url: args.url,
    headers: args.headers ?? {},
  } as unknown as VercelRequest;
}

describe('getAbsoluteUrl', () => {
  const original = process.env.TWILIO_WEBHOOK_URL;

  beforeEach(() => {
    delete process.env.TWILIO_WEBHOOK_URL;
  });

  afterEach(() => {
    if (original) process.env.TWILIO_WEBHOOK_URL = original;
    else delete process.env.TWILIO_WEBHOOK_URL;
  });

  it('uses forwarded proto/host and preserves query string', () => {
    const req = makeReq({
      url: '/api/whatsapp?foo=1&bar=2',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'example.com',
        host: 'internal.local',
      },
    });

    expect(getAbsoluteUrl(req)).toBe('https://example.com/api/whatsapp?foo=1&bar=2');
  });

  it('uses configured webhook URL override when present', () => {
    process.env.TWILIO_WEBHOOK_URL = 'https://shop.example.com/api/whatsapp';
    const req = makeReq({
      url: '/api/whatsapp?ignored=true',
      headers: {
        host: 'internal.local',
      },
    });

    expect(getAbsoluteUrl(req)).toBe('https://shop.example.com/api/whatsapp');
  });

  it('falls back to host header when forwarded host missing', () => {
    const req = makeReq({
      url: '/api/whatsapp',
      headers: {
        'x-forwarded-proto': 'http',
        host: 'localhost:3000',
      },
    });

    expect(getAbsoluteUrl(req)).toBe('http://localhost:3000/api/whatsapp');
  });
});
