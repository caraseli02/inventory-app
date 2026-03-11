import type { VercelRequest } from '@vercel/node';

export function getAbsoluteUrl(req: VercelRequest): string {
  const configured = String(process.env.TWILIO_WEBHOOK_URL ?? '').trim();
  if (configured) return configured;

  const proto = getForwardedHeader(req.headers['x-forwarded-proto']) || 'https';
  const host = getForwardedHeader(req.headers['x-forwarded-host']) || getForwardedHeader(req.headers.host);
  const url = String(req.url ?? '/api/whatsapp');

  return `${proto}://${host}${url}`;
}

export function getForwardedHeader(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? '').split(',')[0]?.trim() ?? '';
}
